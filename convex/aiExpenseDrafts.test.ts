import type { UserIdentity } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  analyzeReceiptImageToDraftHandler,
  createFailedDraftFromImageAnalysisHandler,
  createFromExtractionHandler,
  getWithItemsHandler,
  listByStatusHandler,
} from "./aiExpenseDrafts";

type DraftDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  sourceType: "image_upload";
  status: "queued" | "analyzing" | "ready" | "needs_review" | "failed" | "registered";
  documentType: "receipt" | "convenience_payment" | "unknown";
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: string;
  confidence: {
    documentType?: number;
    shopName?: number;
    paymentPlace?: number;
    payeeName?: number;
    paymentPurpose?: number;
    date?: number;
    amountYen?: number;
    categoryId?: number;
  };
  warnings: string[];
  reviewReasons: Array<
    | "low_confidence"
    | "missing_required_field"
    | "ambiguous_document_type"
    | "ambiguous_category"
    | "amount_mismatch"
    | "parse_failed"
  >;
  registeredReceiptId?: string;
  createdAt: number;
  updatedAt: number;
};

type DraftItemDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  draftId: string;
  itemName: string;
  amountYen: number;
  categoryId?: string;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryId?: number;
  };
  createdAt: number;
  updatedAt: number;
};

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
    getDocById?: Record<string, DraftDoc | DraftItemDoc | { userId: string } | null>;
    insertedDoc?: DraftDoc;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-draft-id");
  const getMock = vi.fn().mockImplementation(async (id: string) => {
    if (id === "new-draft-id" && opts.insertedDoc) {
      return opts.insertedDoc;
    }
    return opts.getDocById?.[id] ?? null;
  });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: getMock,
      insert: insertMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

function createQueryCtx(
  identity: UserIdentity | null,
  opts: {
    drafts?: DraftDoc[];
    items?: DraftItemDoc[];
    getDocById?: Record<string, DraftDoc | null>;
  } = {},
): QueryCtx {
  const withIndexMock = vi
    .fn()
    .mockImplementation((indexName: string, builder: (q: unknown) => unknown) => {
      const filters: Record<string, unknown> = {};
      const q = {
        eq: vi.fn().mockImplementation((field: string, value: unknown) => {
          filters[field] = value;
          return q;
        }),
      };
      builder(q);

      const sourceDocs =
        indexName === "by_user_id_and_draft_id" ? (opts.items ?? []) : (opts.drafts ?? []);
      const filteredDocs = sourceDocs.filter((doc) =>
        Object.entries(filters).every(([field, value]) => {
          return (doc as Record<string, unknown>)[field] === value;
        }),
      );
      const chain = {
        order: vi.fn(),
        take: vi.fn().mockImplementation(async (limit?: number) => {
          return typeof limit === "number" ? filteredDocs.slice(0, limit) : filteredDocs;
        }),
      };
      chain.order.mockReturnValue(chain);
      return chain;
    });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockImplementation(async (id: string) => opts.getDocById?.[id] ?? null),
      query: vi.fn().mockReturnValue({ withIndex: withIndexMock }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

function createActionCtx(
  identity: UserIdentity | null,
  hasConsent: boolean,
  opts: {
    runMutation?: ReturnType<typeof vi.fn>;
  } = {},
): ActionCtx {
  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    runQuery: vi.fn().mockResolvedValue({
      hasAcceptedExternalApiConsent: hasConsent,
      acceptedAt: hasConsent ? 1234567890 : null,
    }),
    runMutation:
      opts.runMutation ??
      vi.fn().mockResolvedValue({
        _id: "draft-created-by-action",
        status: "needs_review",
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ActionCtx;
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

const ownedDraft: DraftDoc = {
  _id: "draft-owned",
  _creationTime: 1000,
  userId: "https://issuer.example|user-001",
  sourceType: "image_upload",
  status: "needs_review",
  documentType: "receipt",
  shopName: "スーパー青葉",
  date: "2026-06-01",
  amountYen: 1200,
  confidence: {
    shopName: 0.92,
    date: 0.88,
    amountYen: 0.95,
  },
  warnings: ["日付の印字が薄い"],
  reviewReasons: ["low_confidence"],
  createdAt: 1000,
  updatedAt: 1000,
};

describe("aiExpenseDrafts", () => {
  it("画像解析成功時に抽出結果を receipt ではなく AI 支出下書きとして保存する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      insertedDoc: {
        ...ownedDraft,
        _id: "new-draft-id",
        status: "needs_review",
      },
    });

    const result = await createFromExtractionHandler(ctx, {
      documentType: "receipt",
      shopName: "スーパー青葉",
      date: "2026-06-01",
      amountYen: 1200,
      confidence: {
        shopName: 0.92,
        date: 0.88,
        amountYen: 0.95,
      },
      warnings: ["日付の印字が薄い"],
      reviewReasons: ["low_confidence"],
    });

    expect(result).toMatchObject({
      _id: "new-draft-id",
      userId: "https://issuer.example|user-001",
      status: "needs_review",
      warnings: ["日付の印字が薄い"],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "aiExpenseDrafts",
      expect.objectContaining({
        userId: "https://issuer.example|user-001",
        sourceType: "image_upload",
        status: "needs_review",
        documentType: "receipt",
        shopName: "スーパー青葉",
      }),
    );
    expect(dbInsert).not.toHaveBeenCalledWith("receipts", expect.anything());
    const insertedDraft = dbInsert.mock.calls[0][1] as Record<string, unknown>;
    expect(insertedDraft).not.toHaveProperty("imageDataUrl");
    expect(insertedDraft).not.toHaveProperty("image");
  });

  it("下書き保存時に抽出結果から登録準備OKを分類する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "category-food": {
          userId: "https://issuer.example|user-001",
        },
      },
      insertedDoc: {
        ...ownedDraft,
        _id: "new-draft-id",
        status: "ready",
        reviewReasons: [],
      },
    });

    await createFromExtractionHandler(ctx, {
      documentType: "receipt",
      shopName: "スーパー青葉",
      date: "2026-06-01",
      amountYen: 1200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "category-food" as any,
      confidence: {
        documentType: 0.92,
        shopName: 0.91,
        date: 0.93,
        amountYen: 0.96,
        categoryId: 0.9,
      },
      warnings: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "aiExpenseDrafts",
      expect.objectContaining({
        status: "ready",
        reviewReasons: [],
      }),
    );
  });

  it("画像解析失敗時に failed 状態の下書きを作成する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      insertedDoc: {
        ...ownedDraft,
        _id: "new-draft-id",
        status: "failed",
        documentType: "unknown",
        warnings: ["画像解析に失敗しました"],
        reviewReasons: ["parse_failed"],
      },
    });

    await createFailedDraftFromImageAnalysisHandler(ctx, {
      warning: "画像解析に失敗しました",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "aiExpenseDrafts",
      expect.objectContaining({
        userId: "https://issuer.example|user-001",
        status: "failed",
        documentType: "unknown",
        warnings: ["画像解析に失敗しました"],
        reviewReasons: ["parse_failed"],
      }),
    );
  });

  it("未認証ユーザーは下書きを作成できない", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      createFromExtractionHandler(ctx, {
        documentType: "receipt",
        confidence: {},
        warnings: [],
        reviewReasons: ["missing_required_field"],
      }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });

  it("同意がない場合は画像解析を実行せず、下書きも作成しない", async () => {
    const ctx = createActionCtx(createIdentity(), false);

    await expect(
      analyzeReceiptImageToDraftHandler(ctx, {
        imageDataUrl: "data:image/jpeg;base64,AAA",
      }),
    ).rejects.toMatchObject({ data: "Receipt image external API consent is required" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(ctx.runMutation as any as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("解析成功後の下書き保存失敗は解析失敗として握りつぶさない", async () => {
    await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
      const runMutation = vi.fn().mockRejectedValue(new Error("draft insert failed"));
      const ctx = createActionCtx(createIdentity(), true, { runMutation });

      await expect(
        analyzeReceiptImageToDraftHandler(ctx, {
          imageDataUrl: "data:image/jpeg;base64,AAA",
        }),
      ).rejects.toThrow("draft insert failed");

      expect(runMutation).toHaveBeenCalledTimes(1);
    });
  });

  it("listByStatus は認証ユーザー本人の下書きだけ返す", async () => {
    const ctx = createQueryCtx(createIdentity(), {
      drafts: [
        ownedDraft,
        {
          ...ownedDraft,
          _id: "draft-other",
          userId: "https://issuer.example|other-user",
        },
      ],
    });

    const result = await listByStatusHandler(ctx, { status: "needs_review" });

    expect(result).toEqual([ownedDraft]);
  });

  it("getWithItems は他ユーザーの下書きを参照できない", async () => {
    const ctx = createQueryCtx(createIdentity(), {
      getDocById: {
        "draft-other": {
          ...ownedDraft,
          _id: "draft-other",
          userId: "https://issuer.example|other-user",
        },
      },
    });

    await expect(
      getWithItemsHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftId: "draft-other" as any,
      }),
    ).rejects.toMatchObject({ data: "AI expense draft does not belong to the current user" });
  });
});
