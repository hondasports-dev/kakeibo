import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { analyzeImageJobHandler, checkAiReviewRequiredHandler } from "./actions";
import {
  countNeedsReviewJobsByBatchIdHandler,
  deleteReceiptAnalysisDataByUserBatchHandler,
  finalizeAnalysisAttemptHandler,
  finalizeBatchStatusHandler,
  getBatchByIdHandler,
  getJobByIdHandler,
  incrementBatchProcessedCountHandler,
  scheduleAiReviewNotificationIfNeeded,
  updateJobStatusHandler,
} from "./internal";
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
  const runAfterMock = vi.fn().mockResolvedValue(undefined);
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
    scheduler: {
      runAfter: runAfterMock,
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

function createInternalCtx({
  docs = {},
  jobs = [],
  batches = [],
}: {
  docs?: Record<string, unknown>;
  jobs?: unknown[];
  batches?: unknown[];
} = {}) {
  const get = vi.fn().mockImplementation(async (id: string) => docs[id] ?? null);
  const patch = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  const runAfter = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockImplementation((tableName: string) => ({
    withIndex: vi
      .fn()
      .mockImplementation((_indexName: string, builder?: (q: unknown) => unknown) => {
        const q = {
          eq: vi.fn().mockImplementation(() => q),
        };
        builder?.(q);
        const rows = tableName === "receiptAnalysisBatches" ? batches : jobs;
        return {
          order: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(rows),
          take: vi
            .fn()
            .mockImplementation(async (limit: number) =>
              tableName === "receiptAnalysisBatches" ? rows.slice(0, limit) : rows,
            ),
        };
      }),
  }));

  return {
    db: { get, patch, delete: remove, query },
    scheduler: { runAfter },
  } as unknown as MutationCtx & QueryCtx;
}

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
    const identity = createIdentity();
    const ctx = createMutationCtx(identity, {
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
    expect(ctx.db.insert).toHaveBeenNthCalledWith(
      1,
      "receiptAnalysisBatches",
      expect.objectContaining({ createdByUserId: identity.tokenIdentifier }),
    );
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

  it("job が needs_review になったら batch に 60 分後の通知をスケジュールする", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          batchId: "batch-1",
          status: "running",
        },
        "batch-1": {
          _id: "batch-1",
          groupId: GROUP_ID,
          createdByUserId: "https://issuer.example|user-001",
        },
      },
    });

    await updateJobStatusHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      status: "needs_review",
      draftId: "draft-1" as Id<"aiExpenseDrafts">,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "needs_review" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ aiReviewNotificationScheduledAt: expect.any(Number) }),
    );
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      60 * 60 * 1000,
      expect.anything(),
      expect.objectContaining({ batchId: "batch-1" }),
    );
  });

  it("通知スケジュール済みの batch には重複スケジュールしない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          batchId: "batch-1",
          status: "running",
        },
        "batch-1": {
          _id: "batch-1",
          groupId: GROUP_ID,
          createdByUserId: "https://issuer.example|user-001",
          aiReviewNotificationScheduledAt: 1000,
        },
      },
    });

    await updateJobStatusHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      status: "needs_review",
      draftId: "draft-1" as Id<"aiExpenseDrafts">,
    });

    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("running への遷移では通知をスケジュールしない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          batchId: "batch-1",
          status: "queued",
        },
        "batch-1": {
          _id: "batch-1",
          groupId: GROUP_ID,
          createdByUserId: "https://issuer.example|user-001",
        },
      },
    });

    await updateJobStatusHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      status: "running",
    });

    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("期待した旧draftから既に切り替わっていれば遅延startを拒否する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      docs: {
        "job-1": {
          _id: "job-1",
          groupId: GROUP_ID,
          batchId: "batch-1",
          status: "ready",
          draftId: "draft-new",
        },
      },
    });

    const result = await updateJobStatusHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      status: "running",
      expectedDraftId: "draft-old" as Id<"aiExpenseDrafts">,
    });

    expect(result).toEqual({ applied: false });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe("finalizeAnalysisAttemptHandler", () => {
  it("成功attemptだけがjobを切り替え、後着の失敗attemptは自分のdraftだけ片付ける", async () => {
    const docs = new Map<string, Record<string, unknown>>([
      [
        "job-1",
        {
          _id: "job-1",
          groupId: GROUP_ID,
          batchId: "batch-1",
          status: "running",
          draftId: "draft-old",
        },
      ],
      ["batch-1", { _id: "batch-1", processedCount: 0, totalCount: 1 }],
      ["draft-old", { _id: "draft-old", groupId: GROUP_ID }],
      ["draft-success", { _id: "draft-success", groupId: GROUP_ID }],
      ["draft-failed", { _id: "draft-failed", groupId: GROUP_ID }],
    ]);
    const removed: string[] = [];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => docs.get(id) ?? null),
        patch: vi.fn(async (id: string, values: Record<string, unknown>) => {
          docs.set(id, { ...(docs.get(id) ?? {}), ...values });
        }),
        delete: vi.fn(async (id: string) => {
          removed.push(id);
          docs.delete(id);
        }),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => []),
            order: vi.fn(() => ({ take: vi.fn(async () => []) })),
          })),
        })),
      },
      scheduler: { runAfter: vi.fn() },
    } as unknown as MutationCtx;

    const success = await finalizeAnalysisAttemptHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      expectedDraftId: "draft-old" as Id<"aiExpenseDrafts">,
      newDraftId: "draft-success" as Id<"aiExpenseDrafts">,
      status: "ready",
    });
    const staleFailure = await finalizeAnalysisAttemptHandler(ctx, {
      jobId: "job-1" as Id<"receiptAnalysisImageJobs">,
      expectedDraftId: "draft-old" as Id<"aiExpenseDrafts">,
      newDraftId: "draft-failed" as Id<"aiExpenseDrafts">,
      status: "failed",
      error: "遅延失敗",
    });

    expect(success).toEqual({ applied: true });
    expect(staleFailure).toEqual({ applied: false });
    expect(docs.get("job-1")).toMatchObject({ status: "ready", draftId: "draft-success" });
    expect(removed).toEqual(expect.arrayContaining(["draft-old", "draft-failed"]));
    expect(removed).not.toContain("draft-success");
  });
});

describe("receipt analysis internal handlers", () => {
  it("batch/job取得とneeds_review件数を処理する", async () => {
    const batch = { _id: "batch-1", processedCount: 0, totalCount: 2 };
    const job = { _id: "job-1", batchId: "batch-1", status: "needs_review" };
    const ctx = createInternalCtx({
      docs: { "batch-1": batch, "job-1": job },
      jobs: [job, { status: "ready" }],
    });

    await expect(
      getBatchByIdHandler(ctx, { batchId: "batch-1" as Id<"receiptAnalysisBatches"> }),
    ).resolves.toBe(batch);
    await expect(
      getJobByIdHandler(ctx, { jobId: "job-1" as Id<"receiptAnalysisImageJobs"> }),
    ).resolves.toBe(job);
    await expect(
      countNeedsReviewJobsByBatchIdHandler(ctx, {
        batchId: "batch-1" as Id<"receiptAnalysisBatches">,
      }),
    ).resolves.toBe(1);
    await expect(
      getJobByIdHandler(createInternalCtx(), {
        jobId: "missing" as Id<"receiptAnalysisImageJobs">,
      }),
    ).rejects.toThrow("Job not found");
  });

  it("終端状態で未スケジュールのbatchだけ通知を予約する", async () => {
    const ctx = createInternalCtx({
      docs: { "batch-1": { _id: "batch-1" } },
    });

    await scheduleAiReviewNotificationIfNeeded(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
      status: "running",
    });
    expect(ctx.db.patch).not.toHaveBeenCalled();

    await scheduleAiReviewNotificationIfNeeded(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
      status: "failed",
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ aiReviewNotificationScheduledAt: expect.any(Number) }),
    );
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);

    await scheduleAiReviewNotificationIfNeeded(ctx, {
      batchId: "missing" as Id<"receiptAnalysisBatches">,
      status: "failed",
    });
  });

  it("batch処理件数を増やし、未完了・実行中・失敗の状態を分岐する", async () => {
    const ctx = createInternalCtx({
      docs: {
        "batch-1": { _id: "batch-1", processedCount: 0, totalCount: 1 },
        "batch-incomplete": { _id: "batch-incomplete", processedCount: 0, totalCount: 2 },
        "batch-running": { _id: "batch-running", processedCount: 1, totalCount: 1 },
        "batch-failed": { _id: "batch-failed", processedCount: 1, totalCount: 1 },
      },
      jobs: [{ status: "failed" }],
    });

    await incrementBatchProcessedCountHandler(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ processedCount: 1, status: "running" }),
    );
    await expect(
      incrementBatchProcessedCountHandler(createInternalCtx(), {
        batchId: "missing" as Id<"receiptAnalysisBatches">,
      }),
    ).rejects.toThrow("Batch not found");

    await finalizeBatchStatusHandler(ctx, {
      batchId: "batch-incomplete" as Id<"receiptAnalysisBatches">,
    });
    await finalizeBatchStatusHandler(ctx, {
      batchId: "batch-running" as Id<"receiptAnalysisBatches">,
    });
    await finalizeBatchStatusHandler(ctx, {
      batchId: "batch-failed" as Id<"receiptAnalysisBatches">,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "batch-failed",
      expect.objectContaining({ status: "partially_failed" }),
    );
    await finalizeBatchStatusHandler(ctx, {
      batchId: "missing" as Id<"receiptAnalysisBatches">,
    });
    await expect(
      updateJobStatusHandler(createInternalCtx(), {
        jobId: "missing" as Id<"receiptAnalysisImageJobs">,
        status: "ready",
      }),
    ).rejects.toThrow("Job not found");
  });

  it("ユーザー所有の解析データを上限付きで削除する", async () => {
    const ctx = createInternalCtx({
      batches: [{ _id: "batch-1" }, { _id: "batch-2" }],
      jobs: [{ _id: "job-1" }, { _id: "job-2" }],
    });

    await expect(
      deleteReceiptAnalysisDataByUserBatchHandler(ctx, {
        groupId: "group-1" as Id<"groups">,
        userId: "user-1",
        limit: 1,
      }),
    ).resolves.toEqual({ deletedBatchCount: 1, deletedJobCount: 2, hasMore: true });
    expect(ctx.db.delete).toHaveBeenCalledWith("job-1");
    expect(ctx.db.delete).toHaveBeenCalledWith("batch-1");
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

  it("通常draft保存に失敗した後の失敗draft保存もtelemetryへ記録する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const jobDoc = {
        _id: "job-save-failure",
        groupId: GROUP_ID,
        batchId: "batch-1",
        status: "queued",
        fileName: "long-receipt.jpg",
      } as Doc<"receiptAnalysisImageJobs">;
      const failedDraft = {
        _id: "draft-failed",
        status: "failed",
        warnings: ["database unavailable"],
      } as Doc<"aiExpenseDrafts">;
      const ctx = createActionCtx(createIdentity());
      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce(jobDoc)
        .mockResolvedValueOnce([]);
      ctx.runMutation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("database unavailable"))
        .mockResolvedValueOnce(failedDraft)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await analyzeImageJobHandler(ctx, {
        jobId: "job-save-failure" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      expect(info).toHaveBeenCalledWith(
        "receipt_extraction_stage",
        expect.objectContaining({
          telemetryId: "job-save-failure",
          stage: "save",
          outcome: "failure",
          failureKind: "draft_save",
          saveKind: "result_draft",
        }),
      );
      expect(info).toHaveBeenCalledWith(
        "receipt_extraction_stage",
        expect.objectContaining({
          telemetryId: "job-save-failure",
          stage: "save",
          outcome: "success",
          saveKind: "failure_draft",
        }),
      );
    });
  });

  it("再解析成功時はuser overrideを新draftへ継承してから旧draftを削除する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const receiptUserOverride = {
        source: "user" as const,
        updatedAt: 10,
        fields: ["amountYen"],
        values: {
          status: "needs_review" as const,
          documentType: "receipt" as const,
          shopName: "ユーザー店舗",
          date: "2026-07-03",
          amountYen: 7803,
          categoryId: "cat-food",
          confidence: { amountYen: 1 },
          warnings: [],
          reviewReasons: ["amount_mismatch" as const],
          items: [],
        },
      };
      const jobDoc = {
        _id: "job-retry",
        groupId: GROUP_ID,
        batchId: "batch-1",
        status: "failed",
        draftId: "draft-old",
      } as Doc<"receiptAnalysisImageJobs">;
      const oldDraft = {
        _id: "draft-old",
        groupId: GROUP_ID,
        receiptUserOverride,
      } as Doc<"aiExpenseDrafts">;
      const newDraft = { _id: "draft-new", status: "needs_review" } as Doc<"aiExpenseDrafts">;
      const ctx = createActionCtx(createIdentity());
      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce(jobDoc)
        .mockResolvedValueOnce({ draft: oldDraft, items: [] })
        .mockResolvedValueOnce([
          { _id: "cat-food", name: "食費", color: "#fff", isActive: true, sortOrder: 1 },
        ]);
      ctx.runMutation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(newDraft)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await analyzeImageJobHandler(ctx, {
        jobId: "job-retry" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      expect((ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({ preservedUserOverride: receiptUserOverride }),
      );
      expect((ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls[2]?.[1]).toMatchObject({
        expectedDraftId: "draft-old",
        newDraftId: "draft-new",
        status: "needs_review",
      });
      expect(
        (ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls.some(
          (call) => call[1]?.draftId === "draft-old" && Object.keys(call[1]).length === 1,
        ),
      ).toBe(false);
    });
  });

  it("旧契約でもuser_confirmed合計は再解析時に遅延変換して維持する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const jobDoc = {
        _id: "job-retry",
        groupId: GROUP_ID,
        batchId: "batch-1",
        status: "failed",
        draftId: "draft-old",
      } as Doc<"receiptAnalysisImageJobs">;
      const oldDraft = {
        _id: "draft-old",
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        amountYen: 7803,
        receiptTotalResolution: {
          status: "resolved",
          protectedAmountYen: 7803,
          candidates: [
            { amountYen: 7803, source: "user_confirmed", evidence: "legacy confirmation" },
          ],
          reasons: [],
        },
        confidence: { amountYen: 1 },
        reviewReasons: [],
        updatedAt: 10,
      } as Doc<"aiExpenseDrafts">;
      const newDraft = { _id: "draft-new", status: "ready" } as Doc<"aiExpenseDrafts">;
      const ctx = createActionCtx(createIdentity());
      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce(jobDoc)
        .mockResolvedValueOnce({ draft: oldDraft, items: [] })
        .mockResolvedValueOnce([]);
      ctx.runMutation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(newDraft)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await analyzeImageJobHandler(ctx, {
        jobId: "job-retry" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      expect((ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({
          preservedUserOverride: expect.objectContaining({
            source: "user",
            fields: ["amountYen", "receiptTotalResolution"],
            values: expect.objectContaining({ amountYen: 7803 }),
          }),
        }),
      );
    });
  });

  it("再解析失敗時は旧draftを残して失敗draftだけを削除する", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const jobDoc = {
        _id: "job-retry",
        groupId: GROUP_ID,
        batchId: "batch-1",
        status: "failed",
        draftId: "draft-old",
      } as Doc<"receiptAnalysisImageJobs">;
      const oldDraft = {
        _id: "draft-old",
        groupId: GROUP_ID,
        receiptUserOverride: { source: "user", updatedAt: 1, fields: [], values: {} },
      } as unknown as Doc<"aiExpenseDrafts">;
      const failedDraft = {
        _id: "draft-failed-new",
        status: "failed",
        warnings: ["解析失敗"],
      } as Doc<"aiExpenseDrafts">;
      const ctx = createActionCtx(createIdentity());
      ctx.runQuery = vi
        .fn()
        .mockResolvedValueOnce({ hasAcceptedExternalApiConsent: true })
        .mockResolvedValueOnce({ _id: GROUP_ID })
        .mockResolvedValueOnce(jobDoc)
        .mockResolvedValueOnce({ draft: oldDraft, items: [] })
        .mockResolvedValueOnce([]);
      ctx.runMutation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(failedDraft)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await analyzeImageJobHandler(ctx, {
        jobId: "job-retry" as Id<"receiptAnalysisImageJobs">,
        imageDataUrl: VALID_IMAGE_DATA_URL,
      });

      expect((ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls[2]?.[1]).toMatchObject({
        expectedDraftId: "draft-old",
        newDraftId: "draft-failed-new",
        status: "failed",
        error: "解析失敗",
      });
      expect(
        (ctx.runMutation as ReturnType<typeof vi.fn>).mock.calls.some(
          (call) => call[1]?.draftId === "draft-old" && Object.keys(call[1]).length === 1,
        ),
      ).toBe(false);
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

describe("checkAiReviewRequiredHandler", () => {
  it("needs_review 待ちがあれば作成者へ ai_review_required メールを enqueue する", async () => {
    const ctx = createActionCtx(createIdentity());

    ctx.runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "batch-1",
        createdByUserId: "https://issuer.example|user-001",
      })
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce({
        userId: "https://issuer.example|user-001",
        email: "user@example.com",
        displayName: "ユーザー",
      });

    ctx.runMutation = vi.fn().mockResolvedValueOnce("email-job-1");

    await checkAiReviewRequiredHandler(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
    });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        templateType: "ai_review_required",
        payloadJson: JSON.stringify({ pendingCount: 2 }),
        recipientEmail: "user@example.com",
      }),
    );
  });

  it("needs_review 待ちが 0 なら何もしない", async () => {
    const ctx = createActionCtx(createIdentity());

    ctx.runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "batch-1",
        createdByUserId: "https://issuer.example|user-001",
      })
      .mockResolvedValueOnce(0);

    ctx.runMutation = vi.fn();

    await checkAiReviewRequiredHandler(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
    });

    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("作成者の email が未設定なら何もしない", async () => {
    const ctx = createActionCtx(createIdentity());

    ctx.runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "batch-1",
        createdByUserId: "https://issuer.example|user-001",
      })
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce({
        userId: "https://issuer.example|user-001",
        email: null,
        displayName: "ユーザー",
      });

    ctx.runMutation = vi.fn();

    await checkAiReviewRequiredHandler(ctx, {
      batchId: "batch-1" as Id<"receiptAnalysisBatches">,
    });

    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
