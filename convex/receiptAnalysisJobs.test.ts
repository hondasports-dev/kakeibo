import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  analyzeImageJobHandler,
  cancelImageJobHandler,
  createBatchHandler,
  listBatchesHandler,
  listJobsByBatchHandler,
  retryImageJobHandler,
  updateJobStatusHandler,
} from "./receiptAnalysisJobs";

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
  const queryMock = vi.fn().mockImplementation(() => ({
    withIndex: vi.fn().mockImplementation(() => ({
      collect: vi.fn().mockResolvedValue(opts.queryResult ?? []),
    })),
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

  const queryMock = vi.fn().mockImplementation(() => ({
    withIndex: vi.fn().mockImplementation(() => ({
      order: vi.fn().mockImplementation(() => ({
        take: vi.fn().mockResolvedValue(opts.queryResult ?? []),
        collect: vi.fn().mockResolvedValue(opts.queryResult ?? []),
      })),
    })),
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
        "new-batch-id": { _id: "new-batch-id", userId: "https://issuer.example|user-001" },
        "new-job-id-0": { _id: "new-job-id-0", userId: "https://issuer.example|user-001" },
        "new-job-id-1": { _id: "new-job-id-1", userId: "https://issuer.example|user-001" },
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

  it("他ユーザーの batch は拒否する", async () => {
    const ctx = createQueryCtx(createIdentity(), {
      docs: {
        "batch-1": { userId: "other-user", _id: "batch-1" },
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
        "job-1": { userId: "https://issuer.example|user-001", status: "ready" },
      },
    });
    await expect(
      retryImageJobHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> }),
    ).rejects.toThrow("Only failed jobs can be retried");
  });

  it("failed job を queued に戻す", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": { userId: "https://issuer.example|user-001", status: "failed" },
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
          userId: "https://issuer.example|user-001",
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
          userId: "https://issuer.example|user-001",
          status: "failed",
          draftId: "draft-1",
        },
        "draft-1": {
          _id: "draft-1",
          userId: "https://issuer.example|user-001",
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
          userId: "https://issuer.example|user-001",
          status: "cancelled",
        },
        "draft-1": {
          _id: "draft-1",
          userId: "https://issuer.example|user-001",
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
          "api.users.getReceiptImageConsent": { hasAcceptedExternalApiConsent: true },
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
        userId: "https://issuer.example|user-001",
        batchId: "batch-1",
        status: "queued",
      } as Doc<"receiptAnalysisImageJobs">;

      const runQueryMap: Record<string, unknown> = {
        "api.users.getReceiptImageConsent": { hasAcceptedExternalApiConsent: true },
        "internal.receiptAnalysisJobs.getJobById": jobDoc,
      };

      const draftDoc = {
        _id: "draft-1",
        status: "ready",
      } as Doc<"aiExpenseDrafts">;

      const runMutationMap: Record<string, unknown> = {
        "internal.aiExpenseDrafts.createFromExtraction": draftDoc,
      };

      const ctx = createActionCtx(createIdentity(), {
        runQueryResults: runQueryMap,
        runMutationResults: runMutationMap,
      });

      // runQuery は呼び出し回数で結果を変える必要がある
      let runQueryCallCount = 0;
      ctx.runQuery = vi.fn().mockImplementation(async (_ref: unknown, _args: unknown) => {
        const keys = Object.keys(runQueryMap);
        const result = runQueryMap[keys[Math.min(runQueryCallCount, keys.length - 1)]];
        runQueryCallCount += 1;
        return result;
      });

      let runMutationCallCount = 0;
      ctx.runMutation = vi.fn().mockImplementation(async (_ref: unknown, _args: unknown) => {
        const keys = Object.keys(runMutationMap);
        const result = runMutationMap[keys[Math.min(runMutationCallCount, keys.length - 1)]];
        runMutationCallCount += 1;
        return result;
      });

      await analyzeImageJobHandler(ctx, {
        jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      // updateJobStatus("running") -> (catch: createFailedDraft + updateJobStatus("failed")) -> incrementBatch -> finalizeBatch
      expect(ctx.runMutation).toHaveBeenCalledTimes(5);
    });
  });
});
