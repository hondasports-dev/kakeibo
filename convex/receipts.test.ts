import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { calculateWeekStartDate } from "./utils";
import {
  createReceiptHandler,
  deleteReceiptHandler,
  getReceiptsByDateHandler,
  getReceiptsByWeekHandler,
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  updateReceiptHandler,
} from "./receipts";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type ReceiptDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  date: string;
  shopName: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
  weekStartDate: string;
  createdAt: number;
  updatedAt: number;
};

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

/**
 * MutationCtx の最小モックを生成する。
 *
 * - ctx.db.get(id) は getDocById で解決する
 * - ctx.db.insert() は "new-receipt-id" を返す。ただし insert 後の get は
 *   insertedDoc を返すよう構成する
 * - ctx.db.patch() / ctx.db.delete() は vi.fn()
 * - ctx.db.query().withIndex().take() は queryDocs を返す
 */
function createMutationCtx(
  identity: UserIdentity | null,
  opts: {
    getDocById?: Record<string, ReceiptDoc | CategoryDoc | null>;
    insertedDoc?: ReceiptDoc;
    updatedDoc?: ReceiptDoc;
    queryDocs?: ReceiptDoc[];
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-receipt-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);

  const getDocById = opts.getDocById ?? {};
  const insertedDoc = opts.insertedDoc ?? null;
  const updatedDoc = opts.updatedDoc ?? null;

  // insert 後の get と通常の get を区別するために呼び出し回数を追跡
  let insertCalled = false;
  let patchCalled = false;

  const getMock = vi.fn().mockImplementation(async (id: string) => {
    // insert が完了した後の get は insertedDoc を返す
    if (id === "new-receipt-id" && insertCalled && insertedDoc !== null) {
      return insertedDoc;
    }
    // patch が完了した後の get は updatedDoc を返す
    if (patchCalled && updatedDoc !== null && id === updatedDoc._id) {
      return updatedDoc;
    }
    return getDocById[id] ?? null;
  });

  // insert / patch の後に insertCalled / patchCalled を設定するラッパー
  const insertWrapper = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await insertMock(...args);
    insertCalled = true;
    return result;
  });

  const patchWrapper = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await patchMock(...args);
    patchCalled = true;
    return result;
  });

  const takeMock = vi.fn().mockResolvedValue(opts.queryDocs ?? []);
  const queryChain = { take: takeMock, order: vi.fn() };
  queryChain.order.mockReturnValue(queryChain);
  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
      };
      builder(q);
      return queryChain;
    });
  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: getMock,
      insert: insertWrapper,
      patch: patchWrapper,
      delete: deleteMock,
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

/**
 * QueryCtx の最小モックを生成する。
 */
function createQueryCtx(identity: UserIdentity | null, queryDocs: ReceiptDoc[] = []): QueryCtx {
  const takeMock = vi.fn().mockResolvedValue(queryDocs);
  const queryChain = { take: takeMock, order: vi.fn() };
  queryChain.order.mockReturnValue(queryChain);
  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
      };
      builder(q);
      return queryChain;
    });
  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

/**
 * QueryCtx の最小モックを生成する（receipts + categories の2クエリ対応）。
 * query() の呼び出し順序（1回目=receipts、2回目=categories）を利用して
 * それぞれ異なるデータを返す。
 */
function createQueryCtxForSummary(
  identity: UserIdentity | null,
  receiptDocs: ReceiptDoc[] = [],
  categoryDocs: CategoryDoc[] = [],
): QueryCtx {
  let queryCallCount = 0;

  const makeChain = (docs: unknown[], supportsCollect: boolean) => {
    const collectMock = vi.fn().mockResolvedValue(docs);
    const takeMock = vi.fn().mockImplementation(async (limit?: number) => {
      return typeof limit === "number" ? docs.slice(0, limit) : docs;
    });
    const chain: Record<string, unknown> = {
      take: takeMock,
      order: vi.fn(),
    };
    if (supportsCollect) {
      chain.collect = collectMock;
    }
    (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    const withIndexMock = vi
      .fn()
      .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
        const filters: Record<string, unknown> = {};
        const q = {
          eq: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] = value;
            return q;
          }),
        };
        builder(q);
        const filteredDocs = docs.filter((doc) => {
          if (typeof doc !== "object" || doc === null) {
            return true;
          }
          return Object.entries(filters).every(([field, value]) => {
            if (!(field in doc)) {
              return true;
            }
            return (doc as Record<string, unknown>)[field] === value;
          });
        });
        const filteredChain: Record<string, unknown> = {
          take: vi.fn().mockImplementation(async (limit?: number) => {
            return typeof limit === "number" ? filteredDocs.slice(0, limit) : filteredDocs;
          }),
          order: vi.fn(),
        };
        if (supportsCollect) {
          filteredChain.collect = vi.fn().mockResolvedValue(filteredDocs);
        }
        (filteredChain.order as ReturnType<typeof vi.fn>).mockReturnValue(filteredChain);
        return filteredChain;
      });
    return { withIndex: withIndexMock };
  };

  const queryMock = vi.fn().mockImplementation(() => {
    queryCallCount++;
    // 1回目: receipts（take 用）、2回目: categories（collect 用）
    if (queryCallCount === 1) return makeChain(receiptDocs, false);
    return makeChain(categoryDocs, true);
  });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      query: queryMock,
      get: vi.fn().mockImplementation(async (id: string) => {
        return categoryDocs.find((category) => category._id === id) ?? null;
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

// ---------------------------------------------------------------------------
// テスト用フィクスチャ
// ---------------------------------------------------------------------------

const USER_ID = "https://issuer.example|user-001";
const OTHER_USER_ID = "https://issuer.example|user-002";

const sampleCategory: CategoryDoc = {
  _id: "cat-001",
  _creationTime: 1000,
  userId: USER_ID,
  name: "食費",
  color: "#FF6B6B",
  isActive: true,
  sortOrder: 1,
  createdAt: 1000,
  updatedAt: 1000,
};

const otherUserCategory: CategoryDoc = {
  _id: "cat-other",
  _creationTime: 1000,
  userId: OTHER_USER_ID,
  name: "外食",
  color: "#FFE66D",
  isActive: true,
  sortOrder: 3,
  createdAt: 1000,
  updatedAt: 1000,
};

const sampleReceipt: ReceiptDoc = {
  _id: "receipt-001",
  _creationTime: 1000,
  userId: USER_ID,
  date: "2024-01-10",
  shopName: "スーパー",
  amountYen: 1500,
  categoryId: "cat-001",
  weekStartDate: "2024-01-08",
  createdAt: 1000,
  updatedAt: 1000,
};

const otherUserReceipt: ReceiptDoc = {
  _id: "receipt-other",
  _creationTime: 1000,
  userId: OTHER_USER_ID,
  date: "2024-01-10",
  shopName: "コンビニ",
  amountYen: 500,
  categoryId: "cat-other",
  weekStartDate: "2024-01-08",
  createdAt: 1000,
  updatedAt: 1000,
};

// ---------------------------------------------------------------------------
// calculateWeekStartDate テスト
// ---------------------------------------------------------------------------

describe("calculateWeekStartDate", () => {
  it("月曜日の場合: その日が返される", () => {
    expect(calculateWeekStartDate("2024-01-08")).toBe("2024-01-08");
  });

  it("日曜日の場合: 前の月曜日が返される", () => {
    expect(calculateWeekStartDate("2024-01-14")).toBe("2024-01-08");
  });

  it("水曜日の場合: 当週月曜日が返される", () => {
    expect(calculateWeekStartDate("2024-01-10")).toBe("2024-01-08");
  });

  it("火曜日の場合: 当週月曜日が返される", () => {
    expect(calculateWeekStartDate("2024-01-09")).toBe("2024-01-08");
  });

  it("土曜日の場合: 当週月曜日が返される", () => {
    expect(calculateWeekStartDate("2024-01-13")).toBe("2024-01-08");
  });
});

// ---------------------------------------------------------------------------
// createReceipt テスト
// ---------------------------------------------------------------------------

describe("createReceipt", () => {
  it("正常系: receipt が作成されて返される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const createdReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "new-receipt-id",
    };

    const ctx = createMutationCtx(identity, {
      getDocById: {
        "cat-001": sampleCategory,
      },
      insertedDoc: createdReceipt,
    });

    const result = await createReceiptHandler(ctx, {
      date: "2024-01-10",
      shopName: "スーパー",
      amountYen: 1500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-001" as any,
    });

    expect(result).toEqual(createdReceipt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledOnce();
    expect(dbInsert).toHaveBeenCalledWith(
      "receipts",
      expect.objectContaining({
        userId: USER_ID,
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      createReceiptHandler(ctx, {
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-001" as any,
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      createReceiptHandler(ctx, {
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-001" as any,
      }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });

  it("別ユーザーのカテゴリを使用時: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "cat-other": otherUserCategory,
      },
    });

    await expect(
      createReceiptHandler(ctx, {
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-other" as any,
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      createReceiptHandler(ctx, {
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-other" as any,
      }),
    ).rejects.toMatchObject({
      data: "Category does not belong to the current user",
    });
  });

  it("無効化済みカテゴリを使用時: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "cat-001": { ...sampleCategory, isActive: false },
      },
    });

    await expect(
      createReceiptHandler(ctx, {
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-001" as any,
      }),
    ).rejects.toMatchObject({
      data: "Inactive category cannot be used for new receipts",
    });
  });
});

// ---------------------------------------------------------------------------
// getReceiptsByWeek テスト
// ---------------------------------------------------------------------------

describe("getReceiptsByWeek", () => {
  it("正常系: 指定週のレシートが返される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const docs = [sampleReceipt];
    const ctx = createQueryCtx(identity, docs);

    const result = await getReceiptsByWeekHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(docs);
  });

  it("別ユーザーのレシートが返らない", async () => {
    const identity = createIdentity({ tokenIdentifier: OTHER_USER_ID });
    // OTHER_USER_ID のコンテキストでは queryDocs を空にして別ユーザーのデータが混入しないことを表現
    const ctx = createQueryCtx(identity, []);

    const result = await getReceiptsByWeekHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    // USER_ID のレシートは含まれない
    expect(result).not.toContainEqual(expect.objectContaining({ userId: USER_ID }));
    expect(result).toHaveLength(0);
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null);

    await expect(
      getReceiptsByWeekHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getReceiptsByWeekHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// getReceiptsByDate テスト
// ---------------------------------------------------------------------------

describe("getReceiptsByDate", () => {
  it("正常系: 指定日のレシートが返される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const docs = [sampleReceipt];
    const ctx = createQueryCtx(identity, docs);

    const result = await getReceiptsByDateHandler(ctx, { date: "2024-01-10" });

    expect(result).toEqual(docs);
  });
});

// ---------------------------------------------------------------------------
// updateReceipt テスト
// ---------------------------------------------------------------------------

describe("updateReceipt", () => {
  it("正常系: receipt が更新される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const updatedReceipt: ReceiptDoc = {
      ...sampleReceipt,
      shopName: "イオン",
      amountYen: 2000,
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-001": sampleReceipt,
      },
      updatedDoc: updatedReceipt,
    });

    const result = await updateReceiptHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      receiptId: "receipt-001" as any,
      shopName: "イオン",
      amountYen: 2000,
    });

    expect(result).toEqual(updatedReceipt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledOnce();
    expect(dbPatch).toHaveBeenCalledWith(
      "receipt-001",
      expect.objectContaining({
        shopName: "イオン",
        amountYen: 2000,
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("別ユーザーの receipt 更新試みる: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-other": otherUserReceipt,
      },
    });

    await expect(
      updateReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-other" as any,
        shopName: "新しい店",
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      updateReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-other" as any,
        shopName: "新しい店",
      }),
    ).rejects.toMatchObject({
      data: "Receipt does not belong to the current user",
    });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      updateReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-001" as any,
        shopName: "新しい店",
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      updateReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-001" as any,
        shopName: "新しい店",
      }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });

  it("無効化済みカテゴリへの変更は拒否する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-001": sampleReceipt,
        "cat-inactive": {
          ...sampleCategory,
          _id: "cat-inactive",
          isActive: false,
        },
      },
    });

    await expect(
      updateReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-001" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-inactive" as any,
      }),
    ).rejects.toMatchObject({
      data: "Inactive category cannot be used for new receipts",
    });
  });

  it("既存 receipt と同じ無効化済みカテゴリは保持したまま更新できる", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const inactiveCategory: CategoryDoc = {
      ...sampleCategory,
      isActive: false,
    };
    const receiptWithInactiveCategory: ReceiptDoc = {
      ...sampleReceipt,
      categoryId: "cat-001",
    };
    const updatedReceipt: ReceiptDoc = {
      ...receiptWithInactiveCategory,
      shopName: "更新後店舗",
      updatedAt: 9999,
    };
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-001": receiptWithInactiveCategory,
        "cat-001": inactiveCategory,
      },
      updatedDoc: updatedReceipt,
    });

    const result = await updateReceiptHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      receiptId: "receipt-001" as any,
      shopName: "更新後店舗",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-001" as any,
    });

    expect(result).toEqual(updatedReceipt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "receipt-001",
      expect.objectContaining({
        shopName: "更新後店舗",
        categoryId: "cat-001",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteReceipt テスト
// ---------------------------------------------------------------------------

describe("deleteReceipt", () => {
  it("正常系: receipt が削除される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-001": sampleReceipt,
      },
    });

    await expect(
      deleteReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-001" as any,
      }),
    ).resolves.toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbDelete = (ctx.db as any).delete as ReturnType<typeof vi.fn>;
    expect(dbDelete).toHaveBeenCalledOnce();
    expect(dbDelete).toHaveBeenCalledWith("receipt-001");
  });

  it("別ユーザーの receipt 削除試みる: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-other": otherUserReceipt,
      },
    });

    await expect(
      deleteReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-other" as any,
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      deleteReceiptHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receiptId: "receipt-other" as any,
      }),
    ).rejects.toMatchObject({
      data: "Receipt does not belong to the current user",
    });
  });
});

// ---------------------------------------------------------------------------
// getWeekSummary テスト
// ---------------------------------------------------------------------------

describe("getWeekSummary", () => {
  it("レシートが0件のとき: { count: 0, totalAmountYen: 0 } を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtx(identity, []);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({ count: 0, totalAmountYen: 0 });
  });

  it("複数レシートがあるとき: 件数と合計金額を正しく返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receipt1: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-001",
      amountYen: 1500,
    };
    const receipt2: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-002",
      amountYen: 800,
    };
    const docs = [receipt1, receipt2];
    const ctx = createQueryCtx(identity, docs);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({ count: 2, totalAmountYen: 2300 });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null);

    await expect(
      getWeekSummaryHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(getWeekSummaryHandler(ctx, { weekStartDate: "2024-01-08" })).rejects.toMatchObject(
      { data: "Not authenticated" },
    );
  });
});

// ---------------------------------------------------------------------------
// getWeekSummaryWithCategories テスト
// ---------------------------------------------------------------------------

describe("getWeekSummaryWithCategories", () => {
  it("レシートが0件のとき: 空の集計を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtxForSummary(identity, [], []);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({
      count: 0,
      totalAmountYen: 0,
      byCategory: [],
      prevWeekTotalAmountYen: null,
      receipts: [],
    });
  });

  it("単一カテゴリのレシートがあるとき: カテゴリ別集計が返る", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receipt1: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-001",
      amountYen: 1500,
      categoryId: "cat-001",
    };
    const receipt2: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-002",
      amountYen: 800,
      categoryId: "cat-001",
    };
    const ctx = createQueryCtxForSummary(identity, [receipt1, receipt2], [sampleCategory]);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.count).toBe(2);
    expect(result.totalAmountYen).toBe(2300);
    expect(result.byCategory).toHaveLength(1);
    expect(result.byCategory[0]).toMatchObject({
      categoryId: "cat-001",
      categoryName: "食費",
      categoryColor: "#FF6B6B",
      totalAmountYen: 2300,
      count: 2,
    });
    expect(result.receipts).toHaveLength(2);
  });

  it("複数カテゴリのレシートがあるとき: カテゴリごとに集計される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const category2: CategoryDoc = {
      _id: "cat-002",
      _creationTime: 1000,
      userId: USER_ID,
      name: "外食",
      color: "#FFE66D",
      isActive: true,
      sortOrder: 2,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const receipt1: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-001",
      amountYen: 1500,
      categoryId: "cat-001",
    };
    const receipt2: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-002",
      amountYen: 3000,
      categoryId: "cat-002",
    };
    const ctx = createQueryCtxForSummary(
      identity,
      [receipt1, receipt2],
      [sampleCategory, category2],
    );

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.count).toBe(2);
    expect(result.totalAmountYen).toBe(4500);
    expect(result.byCategory).toHaveLength(2);
    // 金額降順でソートされていること
    expect(result.byCategory[0].totalAmountYen).toBeGreaterThanOrEqual(
      result.byCategory[1].totalAmountYen,
    );
  });

  it("前週合計を返すとき: prevWeekTotalAmountYen が含まれる", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receipt1: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-001",
      amountYen: 1000,
      categoryId: "cat-001",
      weekStartDate: "2024-01-08",
    };
    const ctx = createQueryCtxForSummary(identity, [receipt1], [sampleCategory]);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
      prevWeekTotalAmountYen: 5000,
    });

    expect(result.prevWeekTotalAmountYen).toBe(5000);
  });

  it("無効化済みカテゴリを参照する既存レシートでもカテゴリ名と色を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const inactiveCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-inactive",
      name: "旧カテゴリ",
      color: "#64748B",
      isActive: false,
    };
    const receipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-inactive-category",
      categoryId: "cat-inactive",
    };
    const ctx = createQueryCtxForSummary(identity, [receipt], [inactiveCategory]);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.byCategory).toEqual([
      {
        categoryId: "cat-inactive",
        categoryName: "旧カテゴリ",
        categoryColor: "#64748B",
        totalAmountYen: 1500,
        count: 1,
      },
    ]);
    expect(result.receipts[0]).toMatchObject({
      categoryId: "cat-inactive",
      categoryName: "旧カテゴリ",
      categoryColor: "#64748B",
    });
  });

  it("101件目以降のカテゴリを参照する既存レシートでもカテゴリ名と色を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const targetCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-target-over-100",
      name: "101件目カテゴリ",
      color: "#0F766E",
      sortOrder: 101,
    };
    const firstOneHundredCategories = Array.from({ length: 100 }, (_, index) => ({
      ...sampleCategory,
      _id: `cat-${String(index + 1).padStart(3, "0")}`,
      name: `カテゴリ${index + 1}`,
      sortOrder: index + 1,
    }));
    const receipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-over-100-category",
      categoryId: "cat-target-over-100",
    };
    const ctx = createQueryCtxForSummary(
      identity,
      [receipt],
      [...firstOneHundredCategories, targetCategory],
    );

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.receipts[0]).toMatchObject({
      categoryId: "cat-target-over-100",
      categoryName: "101件目カテゴリ",
      categoryColor: "#0F766E",
    });
    expect(result.byCategory[0]).toMatchObject({
      categoryId: "cat-target-over-100",
      categoryName: "101件目カテゴリ",
      categoryColor: "#0F766E",
    });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtxForSummary(null, [], []);

    await expect(
      getWeekSummaryWithCategoriesHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getWeekSummaryWithCategoriesHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});
