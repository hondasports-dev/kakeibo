import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  createExpenseEntriesFromDraftHandler,
  createExpenseEntriesHandler,
} from "./expenseEntries";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type CategoryDoc = {
  _id: string;
  _creationTime: number;
  groupId: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type AiExpenseDraftDoc = {
  _id: string;
  _creationTime: number;
  groupId: string;
  sourceType: "image_upload";
  sourceDocumentId?: string;
  status: "queued" | "analyzing" | "ready" | "needs_review" | "failed" | "registered";
  documentType: "receipt" | "convenience_payment" | "unknown";
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: string;
  confidence: Record<string, number | undefined>;
  warnings: string[];
  reviewReasons: string[];
  registeredReceiptId?: string;
  createdAt: number;
  updatedAt: number;
};

type AiExpenseDraftItemDoc = {
  _id: string;
  _creationTime: number;
  draftId: string;
  itemName?: string;
  amountYen: number;
  categoryId?: string;
  confidence: Record<string, number | undefined>;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

const catFoodId = "cat-food" as Id<"categories">;
const catDailyId = "cat-daily" as Id<"categories">;
const draftReadyId = "draft-ready" as Id<"aiExpenseDrafts">;
const sourceDocumentId = "source-doc-1" as Id<"sourceDocuments">;

const GROUP_ID = "group-001" as Id<"groups">;
const OTHER_GROUP_ID = "group-other" as Id<"groups">;

// ---------------------------------------------------------------------------
// テスト用ヘルパー
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
    getDocById?: Record<string, CategoryDoc | AiExpenseDraftDoc | AiExpenseDraftItemDoc | null>;
    groupId?: Id<"groups">;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-entry-id");
  const getDocById = opts.getDocById ?? {};
  const ctxGroupId = opts.groupId ?? GROUP_ID;

  const getMock = vi.fn().mockImplementation(async (id: string) => {
    return getDocById[id] ?? null;
  });

  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: ctxGroupId,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
        gte: vi.fn().mockImplementation(() => q),
        lte: vi.fn().mockImplementation(() => q),
      };
      builder(q);

      // groupMembers テーブルのクエリ
      if (_indexName === "by_user_id") {
        return { unique: vi.fn().mockResolvedValue(groupMember) };
      }

      return {
        take: vi.fn().mockResolvedValue([]),
        order: vi.fn().mockReturnValue({ take: vi.fn().mockResolvedValue([]) }),
      };
    });
  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: getMock,
      insert: insertMock,
      patch: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

const activeFoodCategory: CategoryDoc = {
  _id: "cat-food",
  _creationTime: 0,
  groupId: GROUP_ID,
  name: "食費",
  color: "#AAB7C4",
  isActive: true,
  sortOrder: 1,
  createdAt: 0,
  updatedAt: 0,
};

const activeDailyCategory: CategoryDoc = {
  _id: "cat-daily",
  _creationTime: 0,
  groupId: GROUP_ID,
  name: "日用品",
  color: "#A6B28B",
  isActive: true,
  sortOrder: 2,
  createdAt: 0,
  updatedAt: 0,
};

// ---------------------------------------------------------------------------
// createExpenseEntries
// ---------------------------------------------------------------------------

describe("createExpenseEntriesHandler", () => {
  it("単一支出項目を expenseEntries に保存できる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": activeFoodCategory },
    });

    await createExpenseEntriesHandler(ctx, {
      date: "2026-06-07",
      items: [{ categoryId: catFoodId, amountYen: 2000, title: "スーパー北浜", memo: undefined }],
    });

    expect(ctx.db.insert).toHaveBeenCalledTimes(1);
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "expenseEntries",
      expect.objectContaining({
        date: "2026-06-07",
        amount: 2000,
        categoryId: "cat-food",
        title: "スーパー北浜",
        entryType: "expense",
        source: "manual",
      }),
    );
  });

  it("複数支出項目をそれぞれ expenseEntries に保存できる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "cat-food": activeFoodCategory,
        "cat-daily": activeDailyCategory,
      },
    });

    await createExpenseEntriesHandler(ctx, {
      date: "2026-06-07",
      items: [
        { categoryId: catFoodId, amountYen: 3000, title: "食料品" },
        { categoryId: catDailyId, amountYen: 2000, title: "日用品" },
      ],
    });

    expect(ctx.db.insert).toHaveBeenCalledTimes(2);
    expect(ctx.db.insert).toHaveBeenNthCalledWith(
      1,
      "expenseEntries",
      expect.objectContaining({ amount: 3000, categoryId: "cat-food", title: "食料品" }),
    );
    expect(ctx.db.insert).toHaveBeenNthCalledWith(
      2,
      "expenseEntries",
      expect.objectContaining({ amount: 2000, categoryId: "cat-daily", title: "日用品" }),
    );
  });

  it("未認証の場合、ConvexError を投げる", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      createExpenseEntriesHandler(ctx, {
        date: "2026-06-07",
        items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("存在しないカテゴリIDの場合、ConvexError を投げる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": null },
    });

    await expect(
      createExpenseEntriesHandler(ctx, {
        date: "2026-06-07",
        items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("他のグループのカテゴリIDの場合、ConvexError を投げる", async () => {
    const otherGroupCategory: CategoryDoc = {
      ...activeFoodCategory,
      groupId: OTHER_GROUP_ID,
    };
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": otherGroupCategory },
    });

    await expect(
      createExpenseEntriesHandler(ctx, {
        date: "2026-06-07",
        items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("無効化されたカテゴリIDの場合、ConvexError を投げる", async () => {
    const inactiveCategory: CategoryDoc = { ...activeFoodCategory, isActive: false };
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": inactiveCategory },
    });

    await expect(
      createExpenseEntriesHandler(ctx, {
        date: "2026-06-07",
        items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("メモが指定された場合、memo フィールドに保存される", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": activeFoodCategory },
    });

    await createExpenseEntriesHandler(ctx, {
      date: "2026-06-07",
      items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品", memo: "特売日" }],
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "expenseEntries",
      expect.objectContaining({ memo: "特売日" }),
    );
  });

  it("sourceDocumentId が指定された場合、expenseEntries に紐付けて保存できる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": activeFoodCategory },
    });

    await createExpenseEntriesHandler(ctx, {
      date: "2026-06-07",
      sourceDocumentId,
      items: [{ categoryId: catFoodId, amountYen: 2000, title: "食料品" }],
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "expenseEntries",
      expect.objectContaining({ sourceDocumentId: "source-doc-1" }),
    );
  });
});

// ---------------------------------------------------------------------------
// createExpenseEntriesFromDraft
// ---------------------------------------------------------------------------

const readyDraft: AiExpenseDraftDoc = {
  _id: "draft-ready",
  _creationTime: 0,
  groupId: GROUP_ID,
  sourceType: "image_upload",
  status: "ready",
  documentType: "receipt",
  shopName: "スーパー青葉",
  date: "2026-06-01",
  amountYen: 1500,
  categoryId: "cat-food",
  confidence: { shopName: 0.92, date: 0.95, amountYen: 0.98, categoryId: 0.88 },
  warnings: [],
  reviewReasons: [],
  createdAt: 0,
  updatedAt: 0,
};

describe("createExpenseEntriesFromDraftHandler", () => {
  it("AI下書きのitemsから複数のexpenseEntriesを作成できる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": readyDraft,
        "cat-food": activeFoodCategory,
        "cat-daily": activeDailyCategory,
      },
    });

    const result = await createExpenseEntriesFromDraftHandler(ctx, {
      draftId: draftReadyId,
      items: [
        { itemName: "食料品", amountYen: 1000, categoryId: catFoodId },
        { itemName: "日用品", amountYen: 500, categoryId: catDailyId },
      ],
    });

    expect(ctx.db.insert).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(ctx.db.insert).toHaveBeenNthCalledWith(
      1,
      "expenseEntries",
      expect.objectContaining({
        date: "2026-06-01",
        amount: 1000,
        categoryId: "cat-food",
        title: "食料品",
        entryType: "expense",
        source: "ai_suggested",
      }),
    );
    expect(ctx.db.insert).toHaveBeenNthCalledWith(
      2,
      "expenseEntries",
      expect.objectContaining({
        date: "2026-06-01",
        amount: 500,
        categoryId: "cat-daily",
        title: "日用品",
        entryType: "expense",
        source: "ai_suggested",
      }),
    );
  });

  it("itemのcategoryIdがnullの場合、draftのcategoryIdをフォールバックする", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": readyDraft,
        "cat-food": activeFoodCategory,
      },
    });

    await createExpenseEntriesFromDraftHandler(ctx, {
      draftId: draftReadyId,
      items: [{ itemName: "不明な品目", amountYen: 1000, categoryId: undefined }],
    });

    expect(ctx.db.insert).toHaveBeenCalledTimes(1);
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "expenseEntries",
      expect.objectContaining({
        categoryId: "cat-food", // draftのcategoryIdが使用される
        title: "不明な品目",
      }),
    );
  });

  it("未認証の場合、ConvexErrorを投げる", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      createExpenseEntriesFromDraftHandler(ctx, {
        draftId: draftReadyId,
        items: [{ itemName: "テスト", amountYen: 1000, categoryId: catFoodId }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("他のグループの下書きの場合、ConvexErrorを投げる", async () => {
    const otherGroupDraft: AiExpenseDraftDoc = {
      ...readyDraft,
      groupId: OTHER_GROUP_ID,
    };
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "draft-ready": otherGroupDraft },
    });

    await expect(
      createExpenseEntriesFromDraftHandler(ctx, {
        draftId: draftReadyId,
        items: [{ itemName: "テスト", amountYen: 1000, categoryId: catFoodId }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("存在しない下書きIDの場合、ConvexErrorを投げる", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "draft-ready": null },
    });

    await expect(
      createExpenseEntriesFromDraftHandler(ctx, {
        draftId: draftReadyId,
        items: [{ itemName: "テスト", amountYen: 1000, categoryId: catFoodId }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("ready 以外の下書きからは expenseEntries を作成できない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": {
          ...readyDraft,
          status: "needs_review",
        },
      },
    });

    await expect(
      createExpenseEntriesFromDraftHandler(ctx, {
        draftId: draftReadyId,
        items: [{ itemName: "テスト", amountYen: 1000, categoryId: catFoodId }],
      }),
    ).rejects.toThrow("Only ready drafts can create expense entries");
  });

  it("日付が未確定の下書きからは expenseEntries を作成できない", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: {
        "draft-ready": {
          ...readyDraft,
          date: undefined,
        },
      },
    });

    await expect(
      createExpenseEntriesFromDraftHandler(ctx, {
        draftId: draftReadyId,
        items: [{ itemName: "テスト", amountYen: 1000, categoryId: catFoodId }],
      }),
    ).rejects.toThrow("Draft date is required");
  });
});
