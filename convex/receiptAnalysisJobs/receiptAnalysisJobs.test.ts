import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { analyzeImageJobHandler } from "./actions";
import { updateJobStatusHandler } from "./internal";
import { cancelImageJobHandler, createBatchHandler, retryImageJobHandler } from "./mutations";
import { listBatchesHandler, listJobsByBatchHandler } from "./queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|user-001",
    subject: "user-001",
    issuer: "https://issuer.example",
    ...overrides,
  };
}

const GROUP_ID = "group-001";

function createMutationCtx(
  identity: UserIdentity | null,
  opts: {
    docs?: Record<string, unknown>;
    insertedIds?: string[];
    queryResult?: unknown[];
  } = {},
): MutationCtx {
  const insertedIds = opts.insertedIds ?? ["new-batch-id", "new-job-id-0", "new-job-id-1"];
  let insertCallCount = 0;
  const insertMock = vi.fn().mockImplementation(async () => {
    const nextId = insertedIds[Math.min(insertCallCount, insertedIds.length - 1)];
    insertCallCount += 1;
    return nextId;
  });
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn().mockImplementation(async (id: string) => {
    if (opts.docs && id in opts.docs) {
      return opts.docs[id];
    }
    return null;
  });

  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: GROUP_ID,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  const queryMock = vi.fn().mockImplementation((_tableName: string) => ({
    withIndex: vi
      .fn()
      .mockImplementation((_indexName: string, builder?: (q: unknown) => unknown) => {
        // groupMembers の by_user_id クエリはグループメンバーを返す
        if (_indexName === "by_user_id") {
          if (builder) {
            const q = { eq: vi.fn().mockImplementation(() => q) };
            builder(q);
          }
          return { unique: vi.fn().mockResolvedValue(groupMember) };
        }
        return {
          collect: vi.fn().mockResolvedValue(opts.queryResult ?? []),
          unique: vi.fn().mockResolvedValue(null),
        };
      }),
  }));

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      insert: insertMock,
      patch: patchMock,
      get: getMock,
      delete: deleteMock,
      query: queryMock,
    },
  } as unknown as MutationCtx;
}

function createQueryCtx(
  identity: UserIdentity | null,
  opts: {
    docs?: Record<string, unknown>;
    queryResult?: unknown[];
  } = {},
): QueryCtx {
  const getMock = vi.fn().mockImplementation(async (id: string) => {
    if (opts.docs && id in opts.docs) {
      return opts.docs[id];
    }
    return null;
  });

  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: GROUP_ID,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  const queryMock = vi.fn().mockImplementation((_tableName: string) => ({
    withIndex: vi
      .fn()
      .mockImplementation((_indexName: string, builder?: (q: unknown) => unknown) => {
        // groupMembers の by_user_id クエリはグループメンバーを返す
        if (_indexName === "by_user_id") {
          if (builder) {
            const q = { eq: vi.fn().mockImplementation(() => q) };
            builder(q);
          }
          return { unique: vi.fn().mockResolvedValue(groupMember) };
        }
        return {
          order: vi.fn().mockImplementation(() => ({
            take: vi.fn().mockResolvedValue(opts.queryResult ?? []),
            collect: vi.fn().mockResolvedValue(opts.queryResult ?? []),
          })),
          unique: vi.fn().mockResolvedValue(null),
        };
      }),
  }));

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      get: getMock,
      query: queryMock,
    },
  } as unknown as QueryCtx;
}

function createActionCtx(
  identity: UserIdentity | null,
  opts: {
    runQueryResults?: Record<string, unknown>;
    runMutationResults?: Record<string, unknown>;
  } = {},
): ActionCtx {
  const runQueryMock = vi.fn().mockImplementation(async (_ref: unknown, _args: unknown) => {
    return opts.runQueryResults ?? {};
  });
  const runMutationMock = vi.fn().mockImplementation(async (_ref: unknown, _args: unknown) => {
    return opts.runMutationResults ?? {};
  });

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    runQuery: runQueryMock,
    runMutation: runMutationMock,
  } as unknown as ActionCtx;
}

async function withEnv(
  envVars: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(envVars)) {
    original[key] = process.env[key];
    if (envVars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envVars[key];
    }
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

const VALID_IMAGE_DATA_URL = "data:image/jpeg;base64," + "A".repeat(100);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createBatchHandler", () => {
  it("未認証ユーザーは実行できない", async () => {
    const ctx = createMutationCtx(null);
    await expect(createBatchHandler(ctx, { fileNames: ["a.png"] })).rejects.toThrow(ConvexError);
  });

  it("空の fileNames は拒否する", async () => {
    const ctx = createMutationCtx(createIdentity());
    await expect(createBatchHandler(ctx, { fileNames: [] })).rejects.toThrow(ConvexError);
  });

  it("batch と jobs を作成する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "new-batch-id": { _id: "new-batch-id", groupId: GROUP_ID },
        "new-job-id-0": { _id: "new-job-id-0", groupId: GROUP_ID },
        "new-job-id-1": { _id: "new-job-id-1", groupId: GROUP_ID },
      },
    });
    const result = await createBatchHandler(ctx, { fileNames: ["a.png", "b.png"] });
    expect(result.batch).toBeTruthy();
    expect(result.jobs).toHaveLength(2);
    expect(ctx.db.insert).toHaveBeenCalledTimes(3); // batch + 2 jobs
  });
});

describe("listBatchesHandler", () => {
  it("未認証ユーザーは実行できない", async () => {
    const ctx = createQueryCtx(null);
    await expect(listBatchesHandler(ctx)).rejects.toThrow(ConvexError);
  });
});

describe("listJobsByBatchHandler", () => {
  it("未認証ユーザーは実行できない", async () => {
    const ctx = createQueryCtx(null);
    await expect(
      listJobsByBatchHandler(ctx, { batchId: "batch-1" as Id<"receiptAnalysisBatches"> }),
    ).rejects.toThrow(ConvexError);
  });

  it("他グループの batch は拒否する", async () => {
    const ctx = createQueryCtx(createIdentity(), {
      docs: {
        "batch-1": { groupId: "group-other", _id: "batch-1" },
      },
    });
    await expect(
      listJobsByBatchHandler(ctx, { batchId: "batch-1" as Id<"receiptAnalysisBatches"> }),
    ).rejects.toThrow(ConvexError);
  });
});

describe("retryImageJobHandler", () => {
  it("未認証ユーザーは実行できない", async () => {
    const ctx = createMutationCtx(null);
    await expect(
      retryImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> }),
    ).rejects.toThrow(ConvexError);
  });

  it("failed 以外の job は再試行できない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": { groupId: GROUP_ID, status: "ready" },
      },
    });
    await expect(
      retryImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> }),
    ).rejects.toThrow("Only failed jobs can be retried");
  });

  it("failed job を queued に戻す", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": { groupId: GROUP_ID, status: "failed" },
      },
    });
    await retryImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "queued", error: undefined }),
    );
  });
});

describe("cancelImageJobHandler", () => {
  it("未認証ユーザーは実行できない", async () => {
    const ctx = createMutationCtx(null);
    await expect(
      cancelImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> }),
    ).rejects.toThrow(ConvexError);
  });

  it("running job を cancelled にしてキューから外せる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          status: "running",
        },
      },
    });

    await cancelImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled", draftId: undefined }),
    );
  });

  it("draft 付き failed job は下書きと明細を削除して cancelled にする", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          status: "failed",
          draftId: "draft-1",
        },
        "draft-1": {
          _id: "draft-1",
          groupId: GROUP_ID,
          status: "failed",
        },
      },
      queryResult: [{ _id: "item-1" }],
    });

    await cancelImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> });

    expect(ctx.db.delete).toHaveBeenCalledWith("item-1");
    expect(ctx.db.delete).toHaveBeenCalledWith("draft-1");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled" }),
    );
  });
});

describe("updateJobStatusHandler", () => {
  it("cancelled job に後続の解析結果が戻っても draft を残さない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          status: "cancelled",
        },
        "draft-1": {
          _id: "draft-1",
          groupId: GROUP_ID,
          status: "ready",
        },
      },
      queryResult: [{ _id: "item-1" }],
    });

    await updateJobStatusHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      status: "ready",
      draftId: "draft-1" as Id<"aiExpenseDrafts">,
    });

    expect(ctx.db.delete).toHaveBeenCalledWith("item-1");
    expect(ctx.db.delete).toHaveBeenCalledWith("draft-1");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe("analyzeImageJobHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証ユーザーは実行できない", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const ctx = createActionCtx(null, {
        runQueryResults: {
          "api.users.queries.getReceiptImageConsent": { hasAcceptedExternalApiConsent: true },
        },
      });
      await expect(
        analyzeImageJobHandler(ctx, {
          jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
          imageDataUrl: VALID_IMAGE_DATA_URL,
        }),
      ).rejects.toThrow(ConvexError);
    });
  });

  it("mock extractor で成功し draft と job を更新する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const jobDoc = {
        _id: "job-1",
        groupId: GROUP_ID,
        batchId: "batch-1",
        status: "queued",
      } as Doc<"receiptAnalysisImageJobs">;

      const draftDoc = {
        _id: "draft-1",
        status: "ready",
      } as Doc<"aiExpenseDrafts">;

      const ctx = createActionCtx(createIdentity(), {
        runQueryResults: {},
        runMutationResults: {},
      });

      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce(jobDoc)
        .mockResolvedValueOnce([
          { _id: "cat-food", name: "食費", color: "#F4A27A", isActive: true, sortOrder: 1 },
          { _id: "cat-daily", name: "日用品", color: "#A6B28B", isActive: true, sortOrder: 2 },
        ]);

      ctx.runMutation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(draftDoc)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await analyzeImageJobHandler(ctx, {
        jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      expect(ctx.runMutation).toHaveBeenCalledTimes(5);
      expect((ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({
          categoryId: "cat-food",
          imageFileName: undefined,
          items: [
            expect.objectContaining({
              itemName: "サンプル食品",
              amountYen: 734,
              categoryId: "cat-food",
            }),
            expect.objectContaining({
              itemName: "サンプル日用品",
              amountYen: 500,
              categoryId: "cat-daily",
            }),
          ],
        }),
      );
    });
  });

  it("他グループの job は running に更新せず拒否する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const ctx = createActionCtx(createIdentity());
      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce({
          _id: "job-other",
          groupId: "group-other",
          batchId: "batch-1",
          status: "queued",
        });
      ctx.runMutation = vi.fn();

      await expect(
        analyzeImageJobHandler(ctx, {
          jobId: "job-other" as Id<"receiptAnalysisImageJobs">,
          imageDataUrl: VALID_IMAGE_DATA_URL,
        }),
      ).rejects.toThrow("Job not found");

      expect(ctx.runMutation).not.toHaveBeenCalled();
    });
  });
});
