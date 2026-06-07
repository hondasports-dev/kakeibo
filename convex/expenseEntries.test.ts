import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import { createExpenseEntriesHandler } from "./expenseEntries";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type CategoryDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

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
    getDocById?: Record<string, CategoryDoc | null>;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-entry-id");
  const getDocById = opts.getDocById ?? {};

  const getMock = vi.fn().mockImplementation(async (id: string) => {
    return getDocById[id] ?? null;
  });

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
        gte: vi.fn().mockImplementation(() => q),
        lte: vi.fn().mockImplementation(() => q),
      };
      builder(q);
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
  userId: "https://issuer.example|user-001",
  name: "食費",
  color: "#2563EB",
  isActive: true,
  sortOrder: 1,
  createdAt: 0,
  updatedAt: 0,
};

const activeDailyCategory: CategoryDoc = {
  _id: "cat-daily",
  _creationTime: 0,
  userId: "https://issuer.example|user-001",
  name: "日用品",
  color: "#16A34A",
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
      items: [{ categoryId: "cat-food", amountYen: 2000, title: "スーパー北浜", memo: undefined }],
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
        { categoryId: "cat-food", amountYen: 3000, title: "食料品" },
        { categoryId: "cat-daily", amountYen: 2000, title: "日用品" },
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
        items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品" }],
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
        items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("他のユーザーのカテゴリIDの場合、ConvexError を投げる", async () => {
    const otherUserCategory: CategoryDoc = {
      ...activeFoodCategory,
      userId: "https://issuer.example|other-user",
    };
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": otherUserCategory },
    });

    await expect(
      createExpenseEntriesHandler(ctx, {
        date: "2026-06-07",
        items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品" }],
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
        items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品" }],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("メモが指定された場合、memo フィールドに保存される", async () => {
    const ctx = createMutationCtx(createIdentity(), {
      getDocById: { "cat-food": activeFoodCategory },
    });

    await createExpenseEntriesHandler(ctx, {
      date: "2026-06-07",
      items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品", memo: "特売日" }],
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
      sourceDocumentId: "source-doc-1",
      items: [{ categoryId: "cat-food", amountYen: 2000, title: "食料品" }],
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "expenseEntries",
      expect.objectContaining({ sourceDocumentId: "source-doc-1" }),
    );
  });
});
