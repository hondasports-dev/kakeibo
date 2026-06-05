import type { UserIdentity } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  analyzeReceiptImageToDraftHandler,
  createFailedDraftFromImageAnalysisHandler,
  createFromExtractionHandler,
  getWithItemsHandler,
  listByStatusHandler,
  registerReadyDraftsHandler,
  updateForReviewHandler,
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
    getDocById?: Record<
      string,
      DraftDoc | DraftItemDoc | { userId: string; isActive?: boolean } | null
    >;
    insertedDoc?: DraftDoc;
    insertedIds?: string[];
  } = {},
): MutationCtx {
  const insertedIds = opts.insertedIds ?? ["new-draft-id"];
  let insertCallCount = 0;
  const insertMock = vi.fn().mockImplementation(async () => {
    const nextId = insertedIds[Math.min(insertCallCount, insertedIds.length - 1)];
    insertCallCount += 1;
    return nextId;
  });
  const patchMock = vi.fn().mockResolvedValue(undefined);
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
      patch: patchMock,
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

const readyDraft: DraftDoc = {
  ...ownedDraft,
  _id: "draft-ready",
  status: "ready",
  reviewReasons: [],
  warnings: [],
  categoryId: "cat-food",
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

  it("登録準備OKの下書きを receipts としてまとめて登録し、下書きを registered に更新する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": readyDraft,
        "draft-payment": {
          ...readyDraft,
          _id: "draft-payment",
          documentType: "convenience_payment",
          shopName: "セブンイレブン",
          payeeName: "東京都",
          paymentPurpose: "自動車税",
          amountYen: 39100,
        },
        "cat-food": {
          userId: "https://issuer.example|user-001",
          isActive: true,
        },
      },
      insertedIds: ["receipt-001", "receipt-002"],
    });

    const result = await registerReadyDraftsHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draftIds: ["draft-ready", "draft-payment"] as any,
    });

    expect(result).toEqual({
      registeredDraftIds: ["draft-ready", "draft-payment"],
      registeredReceiptIds: ["receipt-001", "receipt-002"],
      alreadyRegisteredDraftIds: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenNthCalledWith(
      1,
      "receipts",
      expect.objectContaining({
        userId: "https://issuer.example|user-001",
        date: "2026-06-01",
        type: "expense",
        shopName: "スーパー青葉",
        amountYen: 1200,
        categoryId: "cat-food",
      }),
    );
    expect(dbInsert).toHaveBeenNthCalledWith(
      2,
      "receipts",
      expect.objectContaining({
        shopName: "東京都 自動車税",
        amountYen: 39100,
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledTimes(2);
    expect(dbPatch).toHaveBeenCalledWith(
      "draft-ready",
      expect.objectContaining({
        status: "registered",
        registeredReceiptId: "receipt-001",
      }),
    );
    expect(dbPatch).toHaveBeenCalledWith(
      "draft-payment",
      expect.objectContaining({
        status: "registered",
        registeredReceiptId: "receipt-002",
      }),
    );
  });

  it("すでに登録済みの下書きは再登録せず、未登録の ready 下書きだけ登録する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": readyDraft,
        "draft-registered": {
          ...readyDraft,
          _id: "draft-registered",
          status: "registered",
          registeredReceiptId: "receipt-already",
        },
        "cat-food": {
          userId: "https://issuer.example|user-001",
          isActive: true,
        },
      },
      insertedIds: ["receipt-003"],
    });

    const result = await registerReadyDraftsHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draftIds: ["draft-ready", "draft-registered", "draft-ready"] as any,
    });

    expect(result).toEqual({
      registeredDraftIds: ["draft-ready"],
      registeredReceiptIds: ["receipt-003"],
      alreadyRegisteredDraftIds: ["draft-registered"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledTimes(1);
  });

  it("ready 以外の下書きが含まれる場合はまとめて登録を拒否する", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": readyDraft,
        "draft-review": {
          ...readyDraft,
          _id: "draft-review",
          status: "needs_review",
          reviewReasons: ["low_confidence"],
        },
      },
    });

    await expect(
      registerReadyDraftsHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftIds: ["draft-ready", "draft-review"] as any,
      }),
    ).rejects.toMatchObject({ data: "Only ready drafts can be registered" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.db as any).insert as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.db as any).patch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("他ユーザーの下書きはまとめて登録できない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-other": {
          ...readyDraft,
          _id: "draft-other",
          userId: "https://issuer.example|other-user",
        },
      },
    });

    await expect(
      registerReadyDraftsHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftIds: ["draft-other"] as any,
      }),
    ).rejects.toMatchObject({ data: "AI expense draft does not belong to the current user" });
  });

  it("確認が必要な下書きを編集して登録準備OKへ戻す", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-owned": ownedDraft,
        "cat-food": {
          userId: "https://issuer.example|user-001",
          isActive: true,
        },
      },
    });

    await updateForReviewHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draftId: "draft-owned" as any,
      documentType: "receipt",
      shopName: "スーパー青葉 北浜店",
      paymentPlace: "北浜",
      payeeName: "スーパー青葉",
      paymentPurpose: "食料品",
      date: "2026-06-02",
      amountYen: 1680,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-food" as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "draft-owned",
      expect.objectContaining({
        status: "ready",
        reviewReasons: [],
        shopName: "スーパー青葉 北浜店",
        paymentPlace: "北浜",
        payeeName: "スーパー青葉",
        paymentPurpose: "食料品",
        date: "2026-06-02",
        amountYen: 1680,
        categoryId: "cat-food",
      }),
    );
  });

  it("他ユーザーの確認下書きは編集できない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-other": {
          ...ownedDraft,
          _id: "draft-other",
          userId: "https://issuer.example|other-user",
        },
        "cat-food": {
          userId: "https://issuer.example|user-001",
          isActive: true,
        },
      },
    });

    await expect(
      updateForReviewHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftId: "draft-other" as any,
        documentType: "receipt",
        shopName: "スーパー青葉",
        date: "2026-06-02",
        amountYen: 1680,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-food" as any,
      }),
    ).rejects.toMatchObject({ data: "AI expense draft does not belong to the current user" });
  });

  it("書類種別が未判定の確認下書きは登録準備OKへ戻せない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-owned": ownedDraft,
        "cat-food": {
          userId: "https://issuer.example|user-001",
          isActive: true,
        },
      },
    });

    await expect(
      updateForReviewHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftId: "draft-owned" as any,
        documentType: "unknown",
        shopName: "スーパー青葉",
        date: "2026-06-02",
        amountYen: 1680,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-food" as any,
      }),
    ).rejects.toMatchObject({ data: "Draft document type must be selected to mark ready" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.db as any).patch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("無効化済みカテゴリでは確認下書きを登録準備OKへ戻せない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-owned": ownedDraft,
        "cat-inactive": {
          userId: "https://issuer.example|user-001",
          isActive: false,
        },
      },
    });

    await expect(
      updateForReviewHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftId: "draft-owned" as any,
        documentType: "receipt",
        shopName: "スーパー青葉",
        date: "2026-06-02",
        amountYen: 1680,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-inactive" as any,
      }),
    ).rejects.toMatchObject({ data: "Inactive category cannot be used for reviewed drafts" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.db as any).patch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
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
