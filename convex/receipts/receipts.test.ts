import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { calculateWeekStartDate } from "../lib/weekDates";
import {
  createReceiptHandler,
  deleteReceiptHandler,
  getReceiptsByDateHandler,
  getReceiptsByWeekHandler,
  updateReceiptHandler,
} from "./crud";
import {
  getDailySpendingTrendHandler,
  getFourWeeksSummaryHandler,
  getMonthlyExpensesSummaryHandler,
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
} from "./summaries";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type ReceiptDoc = {
  _id: string;
  _creationTime: number;
  groupId: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
  weekStartDate: string;
  createdAt: number;
  updatedAt: number;
};

type ExpenseEntryDoc = {
  _id: string;
  _creationTime: number;
  groupId: string;
  sourceDocumentId?: string;
  aiExpenseDraftId?: string;
  date: string;
  amount: number;
  categoryId: string;
  title: string;
  memo?: string;
  entryType: "expense" | "income";
  source: "manual" | "ai_suggested" | "imported";
  createdAt: number;
  updatedAt: number;
};

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

const GROUP_ID = "group-001";
const OTHER_GROUP_ID = "group-other";

/**
 * MutationCtx の最小モックを生成する。
 *
 * - ctx.db.get(id) は getDocById で解決する
 * - ctx.db.insert() は "new-receipt-id" を返す。ただし insert 後の get は
 *   insertedDoc を返すよう構成する
 * - ctx.db.patch() / ctx.db.delete() は vi.fn()
 * - ctx.db.query().withIndex().take() は queryDocs を返す
 * - groupMembers テーブルの by_user_id クエリは groupMember を返す
 */
function createMutationCtx(
  identity: UserIdentity | null,
  opts: {
    getDocById?: Record<string, ReceiptDoc | CategoryDoc | null>;
    insertedDoc?: ReceiptDoc;
    updatedDoc?: ReceiptDoc;
    queryDocs?: ReceiptDoc[];
    groupId?: string;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-receipt-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);

  const getDocById = opts.getDocById ?? {};
  const insertedDoc = opts.insertedDoc ?? null;
  const updatedDoc = opts.updatedDoc ?? null;
  const ctxGroupId = opts.groupId ?? GROUP_ID;

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
        gte: vi.fn().mockImplementation(() => q),
        lte: vi.fn().mockImplementation(() => q),
      };
      builder(q);
      // groupMembers テーブルの by_user_id クエリはグループメンバーを返す
      if (_indexName === "by_user_id") {
        return { unique: vi.fn().mockResolvedValue(groupMember) };
      }
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
 * groupMembers テーブルの by_user_id クエリはグループメンバーを返す。
 */
function createQueryCtx(
  identity: UserIdentity | null,
  queryDocs: ReceiptDoc[] = [],
  expenseEntryDocs: ExpenseEntryDoc[] = [],
  groupId: string = GROUP_ID,
): QueryCtx {
  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  const makeChain = (docs: Array<Record<string, unknown>>) => ({
    withIndex: vi
      .fn()
      .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
        // groupMembers テーブルのクエリ
        if (_indexName === "by_user_id") {
          const q = { eq: vi.fn().mockImplementation(() => q) };
          builder(q);
          return { unique: vi.fn().mockResolvedValue(groupMember) };
        }

        const filters: Record<string, { eq?: unknown; gte?: unknown; lte?: unknown }> = {};
        const q = {
          eq: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].eq = value;
            return q;
          }),
          gte: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].gte = value;
            return q;
          }),
          lte: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].lte = value;
            return q;
          }),
        };
        builder(q);
        const filteredDocs = docs.filter((doc) =>
          Object.entries(filters).every(([field, condition]) => {
            if (!(field in doc)) {
              return true;
            }
            const value = (doc as Record<string, unknown>)[field];
            if (condition.eq !== undefined && value !== condition.eq) {
              return false;
            }
            if (condition.gte !== undefined && String(value) < String(condition.gte)) {
              return false;
            }
            if (condition.lte !== undefined && String(value) > String(condition.lte)) {
              return false;
            }
            return true;
          }),
        );
        const queryChain = {
          take: vi.fn().mockImplementation(async (limit?: number) => {
            return typeof limit === "number" ? filteredDocs.slice(0, limit) : filteredDocs;
          }),
          order: vi.fn(),
          async *[Symbol.asyncIterator]() {
            yield* filteredDocs;
          },
        };
        queryChain.order.mockReturnValue(queryChain);
        return queryChain;
      }),
  });

  const queryMock = vi.fn().mockImplementation((tableName: string) => {
    if (tableName === "groupMembers") {
      return makeChain([]);
    }
    if (tableName === "expenseEntries") {
      return makeChain(expenseEntryDocs as Record<string, unknown>[]);
    }
    return makeChain(queryDocs as Record<string, unknown>[]);
  });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockResolvedValue(null),
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

/**
 * QueryCtx の最小モックを生成する（receipts + categories の2クエリ対応）。
 * query() の呼び出し順序（1回目=receipts、2回目=categories）を利用して
 * それぞれ異なるデータを返す。
 * groupMembers テーブルの by_user_id クエリはグループメンバーを返す。
 */
function createQueryCtxForSummary(
  identity: UserIdentity | null,
  receiptDocs: ReceiptDoc[] = [],
  categoryDocs: CategoryDoc[] = [],
  expenseEntryDocs: ExpenseEntryDoc[] = [],
  groupId: string = GROUP_ID,
): QueryCtx {
  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  const makeChain = (docs: unknown[], supportsCollect: boolean) => {
    const collectMock = vi.fn().mockResolvedValue(docs);
    const takeMock = vi.fn().mockImplementation(async (limit?: number) => {
      return typeof limit === "number" ? docs.slice(0, limit) : docs;
    });
    const chain: Record<string, unknown> = {
      take: takeMock,
      order: vi.fn(),
      async *[Symbol.asyncIterator]() {
        yield* docs;
      },
    };
    if (supportsCollect) {
      chain.collect = collectMock;
    }
    (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    const withIndexMock = vi
      .fn()
      .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
        // groupMembers テーブルの by_user_id クエリはグループメンバーを返す
        if (_indexName === "by_user_id") {
          const q = { eq: vi.fn().mockImplementation(() => q) };
          builder(q);
          return { unique: vi.fn().mockResolvedValue(groupMember) };
        }

        const filters: Record<string, { eq?: unknown; gte?: unknown; lte?: unknown }> = {};
        const q = {
          eq: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].eq = value;
            return q;
          }),
          gte: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].gte = value;
            return q;
          }),
          lte: vi.fn().mockImplementation((field: string, value: unknown) => {
            filters[field] ??= {};
            filters[field].lte = value;
            return q;
          }),
        };
        builder(q);
        const filteredDocs = docs.filter((doc) => {
          if (typeof doc !== "object" || doc === null) {
            return true;
          }
          return Object.entries(filters).every(([field, condition]) => {
            if (!(field in doc)) {
              return true;
            }
            const value = (doc as Record<string, unknown>)[field];
            if (condition.eq !== undefined && value !== condition.eq) {
              return false;
            }
            if (condition.gte !== undefined && String(value) < String(condition.gte)) {
              return false;
            }
            if (condition.lte !== undefined && String(value) > String(condition.lte)) {
              return false;
            }
            return true;
          });
        });
        const filteredChain: Record<string, unknown> = {
          take: vi.fn().mockImplementation(async (limit?: number) => {
            return typeof limit === "number" ? filteredDocs.slice(0, limit) : filteredDocs;
          }),
          order: vi.fn(),
          async *[Symbol.asyncIterator]() {
            yield* filteredDocs;
          },
        };
        if (supportsCollect) {
          filteredChain.collect = vi.fn().mockResolvedValue(filteredDocs);
        }
        (filteredChain.order as ReturnType<typeof vi.fn>).mockReturnValue(filteredChain);
        return filteredChain;
      });
    return { withIndex: withIndexMock };
  };

  const queryMock = vi.fn().mockImplementation((tableName: string) => {
    if (tableName === "groupMembers") {
      return makeChain([], false);
    }
    if (tableName === "receipts") {
      return makeChain(receiptDocs, false);
    }
    if (tableName === "expenseEntries") {
      return makeChain(expenseEntryDocs, false);
    }
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
  groupId: GROUP_ID,
  name: "食費",
  color: "#8B5E3C",
  isActive: true,
  sortOrder: 1,
  createdAt: 1000,
  updatedAt: 1000,
};

const otherGroupCategory: CategoryDoc = {
  _id: "cat-other",
  _creationTime: 1000,
  groupId: OTHER_GROUP_ID,
  name: "外食",
  color: "#F4A27A",
  isActive: true,
  sortOrder: 3,
  createdAt: 1000,
  updatedAt: 1000,
};

const sampleReceipt: ReceiptDoc = {
  _id: "receipt-001",
  _creationTime: 1000,
  groupId: GROUP_ID,
  date: "2024-01-10",
  shopName: "スーパー",
  amountYen: 1500,
  categoryId: "cat-001",
  weekStartDate: "2024-01-08",
  createdAt: 1000,
  updatedAt: 1000,
};

const otherGroupReceipt: ReceiptDoc = {
  _id: "receipt-other",
  _creationTime: 1000,
  groupId: OTHER_GROUP_ID,
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
        groupId: GROUP_ID,
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

  it("別グループのカテゴリを使用時: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "cat-other": otherGroupCategory,
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
      data: "Category does not belong to the current group",
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

  it("収入: bankName で receipt が作成されて返される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const createdReceipt: ReceiptDoc = {
      _id: "new-receipt-id",
      _creationTime: 1000,
      groupId: GROUP_ID,
      date: "2024-01-10",
      type: "income",
      bankName: "三菱UFJ銀行",
      amountYen: 200000,
      categoryId: "cat-001",
      weekStartDate: "2024-01-08",
      createdAt: 1000,
      updatedAt: 1000,
    };

    const ctx = createMutationCtx(identity, {
      getDocById: { "cat-001": sampleCategory },
      insertedDoc: createdReceipt,
    });

    const result = await createReceiptHandler(ctx, {
      type: "income",
      date: "2024-01-10",
      bankName: "三菱UFJ銀行",
      amountYen: 200000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-001" as any,
    });

    expect(result).toEqual(createdReceipt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "receipts",
      expect.objectContaining({
        groupId: GROUP_ID,
        date: "2024-01-10",
        type: "income",
        bankName: "三菱UFJ銀行",
        amountYen: 200000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
      }),
    );
  });

  it("支出: shopName が空の場合 ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: { "cat-001": sampleCategory },
    });

    await expect(
      createReceiptHandler(ctx, {
        type: "expense",
        date: "2024-01-10",
        shopName: "",
        amountYen: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-001" as any,
      } as Parameters<typeof createReceiptHandler>[1]),
    ).rejects.toMatchObject({ data: "shopName is required for expense receipts" });
  });

  it("収入: bankName が空の場合 ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: { "cat-001": sampleCategory },
    });

    await expect(
      createReceiptHandler(ctx, {
        type: "income",
        date: "2024-01-10",
        bankName: "",
        amountYen: 200000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-001" as any,
      }),
    ).rejects.toMatchObject({ data: "bankName is required for income receipts" });
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

  it("別グループのレシートが返らない", async () => {
    const identity = createIdentity({ tokenIdentifier: OTHER_USER_ID });
    // OTHER_GROUP_ID のコンテキストでは queryDocs を空にして別グループのデータが混入しないことを表現
    const ctx = createQueryCtx(identity, [], [], OTHER_GROUP_ID);

    const result = await getReceiptsByWeekHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    // GROUP_ID のレシートは含まれない
    expect(result).not.toContainEqual(expect.objectContaining({ groupId: GROUP_ID }));
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

  it("別グループの receipt 更新試みる: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-other": otherGroupReceipt,
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
      data: "Receipt does not belong to the current group",
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

  it("別グループの receipt 削除試みる: ConvexError が throw される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, {
      getDocById: {
        "receipt-other": otherGroupReceipt,
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
      data: "Receipt does not belong to the current group",
    });
  });
});

// ---------------------------------------------------------------------------
// getWeekSummary テスト
// ---------------------------------------------------------------------------

describe("getWeekSummary", () => {
  it("レシートが0件のとき: 空の集計と前週データなしを返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtx(identity, []);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({
      count: 0,
      totalAmountYen: 0,
      prevWeekReceiptCount: 0,
      prevWeekTotalAmountYen: null,
    });
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

    expect(result).toEqual({
      count: 2,
      totalAmountYen: 2300,
      prevWeekReceiptCount: 0,
      prevWeekTotalAmountYen: null,
    });
  });

  it("expenseEntries があるときは receipts ではなく expenseEntries を集計する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "legacy-receipt",
      amountYen: 1500,
    };
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-001",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        amount: 4280,
        categoryId: "cat-food",
        title: "スーパー北浜",
        entryType: "expense",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "entry-002",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-11",
        amount: 2000,
        categoryId: "cat-daily",
        title: "ドラッグストア南",
        entryType: "expense",
        source: "manual",
        createdAt: 1001,
        updatedAt: 1001,
      },
      {
        _id: "entry-003",
        _creationTime: 1002,
        groupId: GROUP_ID,
        date: "2024-01-11",
        amount: 9999,
        categoryId: "cat-daily",
        title: "給与",
        entryType: "income",
        source: "manual",
        createdAt: 1002,
        updatedAt: 1002,
      },
    ];
    const ctx = createQueryCtx(identity, [receipt], expenseEntries);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({
      count: 2,
      totalAmountYen: 6280,
      prevWeekReceiptCount: 0,
      prevWeekTotalAmountYen: null,
    });
  });

  it("expenseEntries が 500 件を超えても全件を集計する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const expenseEntries: ExpenseEntryDoc[] = Array.from({ length: 501 }, (_, index) => ({
      _id: `entry-${String(index + 1).padStart(3, "0")}`,
      _creationTime: 1000 + index,
      groupId: GROUP_ID,
      date: "2024-01-10",
      amount: 1,
      categoryId: "cat-daily",
      title: `明細${index + 1}`,
      entryType: "expense",
      source: "manual",
      createdAt: 1000 + index,
      updatedAt: 1000 + index,
    }));
    const ctx = createQueryCtx(identity, [], expenseEntries);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.count).toBe(501);
    expect(result.totalAmountYen).toBe(501);
  });

  it("前週レシートがあるとき: 前週件数と合計金額を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const currentReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-current",
      amountYen: 2300,
      weekStartDate: "2024-01-08",
    };
    const prevReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-prev",
      amountYen: 5000,
      weekStartDate: "2024-01-01",
    };
    const ctx = createQueryCtx(identity, [currentReceipt, prevReceipt]);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual({
      count: 1,
      totalAmountYen: 2300,
      prevWeekReceiptCount: 1,
      prevWeekTotalAmountYen: 5000,
    });
  });

  it("前週レシートが201件以上あるときも全件を集計する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const currentReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-current",
      amountYen: 1000,
      weekStartDate: "2024-01-08",
    };
    const prevReceipts: ReceiptDoc[] = Array.from({ length: 201 }, (_, index) => ({
      ...sampleReceipt,
      _id: `receipt-prev-${index}`,
      amountYen: 100,
      weekStartDate: "2024-01-01",
    }));
    const ctx = createQueryCtx(identity, [currentReceipt, ...prevReceipts]);

    const result = await getWeekSummaryHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.prevWeekReceiptCount).toBe(201);
    expect(result.prevWeekTotalAmountYen).toBe(20100);
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
      totalIncomeYen: 0,
      incomeCount: 0,
      byCategory: [],
      prevWeekReceiptCount: 0,
      prevWeekTotalAmountYen: null,
      receipts: [],
      incomes: [],
    });
  });

  it("収入の expenseEntries が週次サマリーに含まれ、支出集計には混入しない", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-expense-001",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        amount: 1500,
        categoryId: "cat-001",
        title: "スーパー",
        entryType: "expense",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "entry-income-001",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-11",
        amount: 300000,
        categoryId: "cat-001",
        title: "給与",
        entryType: "income",
        source: "manual",
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];
    const ctx = createQueryCtxForSummary(identity, [], [sampleCategory], expenseEntries);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.count).toBe(1);
    expect(result.totalAmountYen).toBe(1500);
    expect(result.totalIncomeYen).toBe(300000);
    expect(result.incomeCount).toBe(1);
    expect(result.incomes).toEqual([
      {
        _id: "entry-income-001",
        date: "2024-01-11",
        type: "income",
        bankName: "給与",
        amountYen: 300000,
        recordType: "expenseEntry",
      },
    ]);
  });

  it("expenseEntries 収入がない週はレガシー receipts 収入をフォールバックする", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const legacyIncomeReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-income-001",
      type: "income",
      bankName: "給与振込",
      amountYen: 250000,
      shopName: undefined,
    };
    const ctx = createQueryCtxForSummary(identity, [legacyIncomeReceipt], [sampleCategory], []);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.totalIncomeYen).toBe(250000);
    expect(result.incomeCount).toBe(1);
    expect(result.incomes[0]).toMatchObject({
      _id: "receipt-income-001",
      type: "income",
      bankName: "給与振込",
      amountYen: 250000,
      recordType: "receipt",
    });
  });

  it("expenseEntries が存在する週ではレガシー receipts 収入を返さない", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-expense-only",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        amount: 1000,
        categoryId: "cat-001",
        title: "コンビニ",
        entryType: "expense",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const legacyIncomeReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-income-legacy",
      type: "income",
      bankName: "賞与",
      amountYen: 50000,
      shopName: undefined,
    };
    const ctx = createQueryCtxForSummary(
      identity,
      [legacyIncomeReceipt],
      [sampleCategory],
      expenseEntries,
    );

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.totalIncomeYen).toBe(0);
    expect(result.incomeCount).toBe(0);
    expect(result.incomes).toEqual([]);
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
      categoryColor: "#8B5E3C",
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
      groupId: GROUP_ID,
      name: "外食",
      color: "#F4A27A",
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

  it("expenseEntries があるときはカテゴリ別集計を expenseEntries ベースで返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const legacyReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "legacy-receipt",
      amountYen: 1500,
    };
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-food",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        amount: 4280,
        categoryId: "cat-food",
        title: "スーパー北浜",
        entryType: "expense",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "entry-daily",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-11",
        amount: 2000,
        categoryId: "cat-daily",
        title: "ドラッグストア南",
        entryType: "expense",
        source: "manual",
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];
    const category2: CategoryDoc = {
      _id: "cat-daily",
      _creationTime: 1000,
      groupId: GROUP_ID,
      name: "日用品",
      color: "#A6B28B",
      isActive: true,
      sortOrder: 2,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const ctx = createQueryCtxForSummary(
      identity,
      [legacyReceipt],
      [
        {
          ...sampleCategory,
          _id: "cat-food",
          name: "食費",
          color: "#AAB7C4",
        },
        category2,
      ],
      expenseEntries,
    );

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.count).toBe(2);
    expect(result.totalAmountYen).toBe(6280);
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: "cat-food",
          categoryName: "食費",
          categoryColor: "#AAB7C4",
          totalAmountYen: 4280,
          count: 1,
        }),
        expect.objectContaining({
          categoryId: "cat-daily",
          categoryName: "日用品",
          categoryColor: "#A6B28B",
          totalAmountYen: 2000,
          count: 1,
        }),
      ]),
    );
    expect(result.receipts).toHaveLength(2);
    expect(result.receipts[0]).toMatchObject({
      categoryName: "食費",
      categoryColor: "#AAB7C4",
      amountYen: 4280,
    });
  });

  it("AI下書き由来のカテゴリ別expenseEntriesが週次カテゴリ別集計に反映される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-ai-food-1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        aiExpenseDraftId: "draft-ai-receipt",
        date: "2024-01-10",
        amount: 400,
        categoryId: "cat-food",
        title: "ドラッグストアA",
        entryType: "expense",
        source: "ai_suggested",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "entry-ai-medical",
        _creationTime: 1001,
        groupId: GROUP_ID,
        aiExpenseDraftId: "draft-ai-receipt",
        date: "2024-01-10",
        amount: 980,
        categoryId: "cat-medical",
        title: "ドラッグストアA",
        entryType: "expense",
        source: "ai_suggested",
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];
    const foodCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-food",
      name: "食費",
      color: "#AAB7C4",
    };
    const medicalCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-medical",
      name: "医療費",
      color: "#C4AAB7",
      sortOrder: 2,
    };
    const ctx = createQueryCtxForSummary(
      identity,
      [],
      [foodCategory, medicalCategory],
      expenseEntries,
    );

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.totalAmountYen).toBe(1380);
    expect(result.count).toBe(2);
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: "cat-food",
          categoryName: "食費",
          totalAmountYen: 400,
        }),
        expect.objectContaining({
          categoryId: "cat-medical",
          categoryName: "医療費",
          totalAmountYen: 980,
        }),
      ]),
    );
    expect(result.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "entry-ai-food-1",
          amountYen: 400,
          categoryName: "食費",
          shopName: "ドラッグストアA",
        }),
        expect.objectContaining({
          _id: "entry-ai-medical",
          amountYen: 980,
          categoryName: "医療費",
          shopName: "ドラッグストアA",
        }),
      ]),
    );
  });

  it("前週レシートがあるとき: prevWeekTotalAmountYen が含まれる", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receipt1: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-001",
      amountYen: 1000,
      categoryId: "cat-001",
      weekStartDate: "2024-01-08",
    };
    const prevReceipt: ReceiptDoc = {
      ...sampleReceipt,
      _id: "receipt-prev",
      amountYen: 5000,
      categoryId: "cat-001",
      weekStartDate: "2024-01-01",
    };
    const ctx = createQueryCtxForSummary(identity, [receipt1, prevReceipt], [sampleCategory]);

    const result = await getWeekSummaryWithCategoriesHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result.prevWeekReceiptCount).toBe(1);
    expect(result.prevWeekTotalAmountYen).toBe(5000);
  });

  it("無効化済みカテゴリを参照する既存レシートでもカテゴリ名と色を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const inactiveCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-inactive",
      name: "旧カテゴリ",
      color: "#765F4F",
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
        categoryColor: "#765F4F",
        totalAmountYen: 1500,
        count: 1,
      },
    ]);
    expect(result.receipts[0]).toMatchObject({
      categoryId: "cat-inactive",
      categoryName: "旧カテゴリ",
      categoryColor: "#765F4F",
    });
  });

  it("101件目以降のカテゴリを参照する既存レシートでもカテゴリ名と色を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const targetCategory: CategoryDoc = {
      ...sampleCategory,
      _id: "cat-target-over-100",
      name: "101件目カテゴリ",
      color: "#8B5E3C",
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
      categoryColor: "#8B5E3C",
    });
    expect(result.byCategory[0]).toMatchObject({
      categoryId: "cat-target-over-100",
      categoryName: "101件目カテゴリ",
      categoryColor: "#8B5E3C",
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

// ---------------------------------------------------------------------------
// getFourWeeksSummary
// ---------------------------------------------------------------------------

describe("getFourWeeksSummaryHandler", () => {
  it("基準週を含む直近4週の合計支出を古い順で返す", async () => {
    // 2024-01-08（月）を基準週とし、そこから3週前まで4週分のレシートを用意
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-w0-1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-08",
        shopName: "shop-A",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r-w0-2",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-10",
        shopName: "shop-B",
        amountYen: 2000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1001,
        updatedAt: 1001,
      },
      {
        _id: "r-w1",
        _creationTime: 1002,
        groupId: GROUP_ID,
        date: "2024-01-01",
        shopName: "shop-C",
        amountYen: 500,
        categoryId: "cat-001",
        weekStartDate: "2024-01-01",
        createdAt: 1002,
        updatedAt: 1002,
      },
      {
        _id: "r-w2",
        _creationTime: 1003,
        groupId: GROUP_ID,
        date: "2023-12-25",
        shopName: "shop-D",
        amountYen: 3000,
        categoryId: "cat-001",
        weekStartDate: "2023-12-25",
        createdAt: 1003,
        updatedAt: 1003,
      },
      // 4週前はレシートなし（2023-12-18）
    ];

    const ctx = createQueryCtx(createIdentity(), receiptDocs);
    const result = await getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" });

    // 4週分返る
    expect(result.weeks).toHaveLength(4);

    // 古い順（昇順）で並んでいること
    expect(result.weeks[0].weekStartDate).toBe("2023-12-18");
    expect(result.weeks[1].weekStartDate).toBe("2023-12-25");
    expect(result.weeks[2].weekStartDate).toBe("2024-01-01");
    expect(result.weeks[3].weekStartDate).toBe("2024-01-08");

    // 各週の合計支出が正しいこと
    expect(result.weeks[0].totalAmountYen).toBe(0);
    expect(result.weeks[1].totalAmountYen).toBe(3000);
    expect(result.weeks[2].totalAmountYen).toBe(500);
    expect(result.weeks[3].totalAmountYen).toBe(3000); // 1000 + 2000

    // weekCount はデータがある週の数
    expect(result.weekCount).toBe(3);
  });

  it("各週のカテゴリ別内訳を返す", async () => {
    const dailyCategory: CategoryDoc = {
      _id: "cat-002",
      _creationTime: 1000,
      groupId: GROUP_ID,
      name: "日用品",
      color: "#A6B28B",
      isActive: true,
      sortOrder: 2,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-w0-food",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-08",
        shopName: "shop-A",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r-w0-daily",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-09",
        shopName: "shop-B",
        amountYen: 2000,
        categoryId: "cat-002",
        weekStartDate: "2024-01-08",
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];

    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtxForSummary(identity, receiptDocs, [sampleCategory, dailyCategory]);
    const result = await getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" });

    const currentWeek = result.weeks.find((week) => week.weekStartDate === "2024-01-08");
    expect(currentWeek?.byCategory).toEqual([
      {
        categoryId: "cat-002",
        categoryName: "日用品",
        categoryColor: "#A6B28B",
        totalAmountYen: 2000,
        count: 1,
      },
      {
        categoryId: "cat-001",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 1000,
        count: 1,
      },
    ]);
  });

  it("全週レシートなしの場合: 4週分の空データを返す", async () => {
    const ctx = createQueryCtx(createIdentity(), []);
    const result = await getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" });

    expect(result.weeks).toHaveLength(4);
    result.weeks.forEach((w) => expect(w.totalAmountYen).toBe(0));
    expect(result.weekCount).toBe(0);
  });

  it("1週分のみデータがある場合: weekCount が 1 を返す", async () => {
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-only",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-08",
        shopName: "shop-only",
        amountYen: 9999,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createQueryCtx(createIdentity(), receiptDocs);
    const result = await getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" });

    expect(result.weekCount).toBe(1);
    // 基準週のみデータあり
    const baseWeek = result.weeks.find((w) => w.weekStartDate === "2024-01-08");
    expect(baseWeek?.totalAmountYen).toBe(9999);
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null, []);

    await expect(
      getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getFourWeeksSummaryHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// getMonthlyExpensesSummary テスト用ヘルパー
// ---------------------------------------------------------------------------

type UserDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  displayName: string;
  email?: string;
  monthlyIncome?: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * getMonthlyExpensesSummaryHandler が必要とする QueryCtx の最小モックを生成する。
 * receipts テーブルと users テーブルの2つをクエリする。
 * receipts は by_user_id_and_date インデックス + async iteration
 * users は by_token_identifier インデックス + unique()
 */
function createQueryCtxForMonthlySummary(
  identity: UserIdentity | null,
  receiptDocs: ReceiptDoc[] = [],
  userDoc: UserDoc | null = null,
  expenseEntryDocs: ExpenseEntryDoc[] = [],
): QueryCtx {
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

  const queryMock = vi.fn().mockImplementation((tableName: string) => {
    if (tableName === "groupMembers") {
      // groupMembers: withIndex("by_user_id") → unique() でgroupMemberを返す
      const withIndexMock = vi.fn().mockReturnValue({
        unique: vi.fn().mockResolvedValue(groupMember),
      });
      return { withIndex: withIndexMock };
    } else if (tableName === "receipts") {
      // receipts: withIndex → collect() で全件返す
      const withIndexMock = vi
        .fn()
        .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
          const filters: Record<string, { eq?: unknown; gte?: unknown; lte?: unknown }> = {};
          const q = {
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].eq = value;
              return q;
            }),
            gte: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].gte = value;
              return q;
            }),
            lte: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].lte = value;
              return q;
            }),
          };
          builder(q);
          const filteredDocs = receiptDocs.filter((doc) =>
            Object.entries(filters).every(([field, condition]) => {
              if (!(field in doc)) return true;
              const value = (doc as Record<string, unknown>)[field];
              if (condition.eq !== undefined && value !== condition.eq) {
                return false;
              }
              if (condition.gte !== undefined && String(value) < String(condition.gte)) {
                return false;
              }
              if (condition.lte !== undefined && String(value) > String(condition.lte)) {
                return false;
              }
              return true;
            }),
          );
          return {
            collect: vi.fn().mockResolvedValue(filteredDocs),
            order: vi.fn().mockReturnThis(),
            take: vi.fn().mockResolvedValue(filteredDocs),
            async *[Symbol.asyncIterator]() {
              yield* filteredDocs;
            },
          };
        });
      return { withIndex: withIndexMock };
    } else if (tableName === "expenseEntries") {
      const withIndexMock = vi
        .fn()
        .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
          const filters: Record<string, { eq?: unknown; gte?: unknown; lte?: unknown }> = {};
          const q = {
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].eq = value;
              return q;
            }),
            gte: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].gte = value;
              return q;
            }),
            lte: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] ??= {};
              filters[field].lte = value;
              return q;
            }),
          };
          builder(q);
          const filteredDocs = expenseEntryDocs.filter((doc) =>
            Object.entries(filters).every(([field, condition]) => {
              if (!(field in doc)) return true;
              const value = (doc as Record<string, unknown>)[field];
              if (condition.eq !== undefined && value !== condition.eq) {
                return false;
              }
              if (condition.gte !== undefined && String(value) < String(condition.gte)) {
                return false;
              }
              if (condition.lte !== undefined && String(value) > String(condition.lte)) {
                return false;
              }
              return true;
            }),
          );
          return {
            collect: vi.fn().mockResolvedValue(filteredDocs),
            order: vi.fn().mockReturnThis(),
            take: vi.fn().mockResolvedValue(filteredDocs),
            async *[Symbol.asyncIterator]() {
              yield* filteredDocs;
            },
          };
        });
      return { withIndex: withIndexMock };
    } else {
      // users: withIndex → unique() でuserDocを返す
      const withIndexMock = vi.fn().mockReturnValue({
        unique: vi.fn().mockResolvedValue(userDoc),
      });
      return { withIndex: withIndexMock };
    }
  });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockResolvedValue(null),
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

// ---------------------------------------------------------------------------
// getMonthlyExpensesSummary テスト
// ---------------------------------------------------------------------------

describe("getMonthlyExpensesSummary", () => {
  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtxForMonthlySummary(null, [], null);

    await expect(
      getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });

  it("receipt.date ベースで月次集計される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-jan-1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-02-01",
        shopName: "スーパーA",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-29", // 2024-02 に属する
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r-jan-2",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-02-20",
        shopName: "コンビニB",
        amountYen: 500,
        categoryId: "cat-001",
        weekStartDate: "2024-02-19", // 2024-02 に属する
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createQueryCtxForMonthlySummary(identity, receiptDocs, null);

    const result = await getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-02" });

    expect(result.totalExpensesYen).toBe(1500);
    expect(result.monthlyIncome).toBeNull();
    expect(result.remainingBalanceYen).toBeNull();
  });

  it("別月のレシートは含まれない", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-jan",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        shopName: "スーパーA",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08", // 2024-01
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r-feb",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-02-05",
        shopName: "コンビニB",
        amountYen: 2000,
        categoryId: "cat-001",
        weekStartDate: "2024-02-05", // 2024-02 → 除外
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createQueryCtxForMonthlySummary(identity, receiptDocs, null);

    const result = await getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" });

    expect(result.totalExpensesYen).toBe(1000); // janのみ
  });

  it("income のレシートは月次集計から除外される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-expense",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        shopName: "スーパーA",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r-income",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-15",
        type: "income",
        bankName: "給与",
        amountYen: 50000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-15",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createQueryCtxForMonthlySummary(identity, receiptDocs, null);

    const result = await getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" });

    expect(result.totalExpensesYen).toBe(1000);
  });

  it("monthlyIncome が設定されている場合の残金計算", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r-1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-10",
        shopName: "スーパー",
        amountYen: 50000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const userDoc: UserDoc = {
      _id: "user-001",
      _creationTime: 1000,
      userId: USER_ID,
      displayName: "テストユーザー",
      monthlyIncome: 300000,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const ctx = createQueryCtxForMonthlySummary(identity, receiptDocs, userDoc);

    const result = await getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" });

    expect(result.totalExpensesYen).toBe(50000);
    expect(result.monthlyIncome).toBe(300000);
    expect(result.remainingBalanceYen).toBe(250000);
  });

  it("monthlyIncome が null の場合は remainingBalance も null", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const userDoc: UserDoc = {
      _id: "user-001",
      _creationTime: 1000,
      userId: USER_ID,
      displayName: "テストユーザー",
      // monthlyIncome なし
      createdAt: 1000,
      updatedAt: 1000,
    };
    const ctx = createQueryCtxForMonthlySummary(identity, [], userDoc);

    const result = await getMonthlyExpensesSummaryHandler(ctx, { monthStartDate: "2024-01" });

    expect(result.monthlyIncome).toBeNull();
    expect(result.remainingBalanceYen).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDailySpendingTrend
// ---------------------------------------------------------------------------

describe("getDailySpendingTrendHandler", () => {
  it("今週と前週の各日の合計支出が正しく返る", async () => {
    const receiptDocs: ReceiptDoc[] = [
      {
        _id: "r1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-08",
        shopName: "shop-A",
        amountYen: 1000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "r2",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-10",
        shopName: "shop-B",
        amountYen: 2000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1001,
        updatedAt: 1001,
      },
      {
        _id: "r-income",
        _creationTime: 1005,
        groupId: GROUP_ID,
        date: "2024-01-10",
        type: "income",
        bankName: "給与",
        amountYen: 9999,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1005,
        updatedAt: 1005,
      },
      {
        _id: "r3",
        _creationTime: 1002,
        groupId: GROUP_ID,
        date: "2024-01-12",
        shopName: "shop-C",
        amountYen: 500,
        categoryId: "cat-001",
        weekStartDate: "2024-01-08",
        createdAt: 1002,
        updatedAt: 1002,
      },
      {
        _id: "r4",
        _creationTime: 1003,
        groupId: GROUP_ID,
        date: "2024-01-01",
        shopName: "shop-D",
        amountYen: 3000,
        categoryId: "cat-001",
        weekStartDate: "2024-01-01",
        createdAt: 1003,
        updatedAt: 1003,
      },
      {
        _id: "r5",
        _creationTime: 1004,
        groupId: GROUP_ID,
        date: "2024-01-03",
        shopName: "shop-E",
        amountYen: 1500,
        categoryId: "cat-001",
        weekStartDate: "2024-01-01",
        createdAt: 1004,
        updatedAt: 1004,
      },
    ];

    const ctx = createQueryCtx(createIdentity(), receiptDocs);
    const result = await getDailySpendingTrendHandler(ctx, { weekStartDate: "2024-01-08" });

    expect(result.currentWeek).toHaveLength(7);
    expect(result.previousWeek).toHaveLength(7);

    expect(result.currentWeek[0]).toEqual({ date: "2024-01-08", totalAmountYen: 1000 });
    expect(result.currentWeek[1]).toEqual({ date: "2024-01-09", totalAmountYen: 0 });
    expect(result.currentWeek[2]).toEqual({ date: "2024-01-10", totalAmountYen: 2000 });
    expect(result.currentWeek[3]).toEqual({ date: "2024-01-11", totalAmountYen: 0 });
    expect(result.currentWeek[4]).toEqual({ date: "2024-01-12", totalAmountYen: 500 });
    expect(result.currentWeek[5]).toEqual({ date: "2024-01-13", totalAmountYen: 0 });
    expect(result.currentWeek[6]).toEqual({ date: "2024-01-14", totalAmountYen: 0 });

    expect(result.previousWeek[0]).toEqual({ date: "2024-01-01", totalAmountYen: 3000 });
    expect(result.previousWeek[1]).toEqual({ date: "2024-01-02", totalAmountYen: 0 });
    expect(result.previousWeek[2]).toEqual({ date: "2024-01-03", totalAmountYen: 1500 });
    expect(result.previousWeek[3]).toEqual({ date: "2024-01-04", totalAmountYen: 0 });
    expect(result.previousWeek[4]).toEqual({ date: "2024-01-05", totalAmountYen: 0 });
    expect(result.previousWeek[5]).toEqual({ date: "2024-01-06", totalAmountYen: 0 });
    expect(result.previousWeek[6]).toEqual({ date: "2024-01-07", totalAmountYen: 0 });
  });

  it("レシートなしの場合は全て0を返す", async () => {
    const ctx = createQueryCtx(createIdentity(), []);
    const result = await getDailySpendingTrendHandler(ctx, { weekStartDate: "2024-01-08" });

    expect(result.currentWeek).toHaveLength(7);
    expect(result.previousWeek).toHaveLength(7);
    result.currentWeek.forEach((d) => expect(d.totalAmountYen).toBe(0));
    result.previousWeek.forEach((d) => expect(d.totalAmountYen).toBe(0));
  });

  it("expenseEntries があるときは日別推移も expenseEntries ベースで返る", async () => {
    const expenseEntries: ExpenseEntryDoc[] = [
      {
        _id: "entry-1",
        _creationTime: 1000,
        groupId: GROUP_ID,
        date: "2024-01-08",
        amount: 1000,
        categoryId: "cat-food",
        title: "スーパーA",
        entryType: "expense",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "entry-2",
        _creationTime: 1001,
        groupId: GROUP_ID,
        date: "2024-01-10",
        amount: 2000,
        categoryId: "cat-daily",
        title: "ドラッグストアB",
        entryType: "expense",
        source: "manual",
        createdAt: 1001,
        updatedAt: 1001,
      },
      {
        _id: "entry-3",
        _creationTime: 1002,
        groupId: GROUP_ID,
        date: "2024-01-01",
        amount: 3000,
        categoryId: "cat-food",
        title: "スーパーC",
        entryType: "expense",
        source: "manual",
        createdAt: 1002,
        updatedAt: 1002,
      },
    ];
    const ctx = createQueryCtx(createIdentity(), [], expenseEntries);
    const result = await getDailySpendingTrendHandler(ctx, { weekStartDate: "2024-01-08" });

    expect(result.currentWeek[0]).toEqual({ date: "2024-01-08", totalAmountYen: 1000 });
    expect(result.currentWeek[2]).toEqual({ date: "2024-01-10", totalAmountYen: 2000 });
    expect(result.previousWeek[0]).toEqual({ date: "2024-01-01", totalAmountYen: 3000 });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null, []);

    await expect(
      getDailySpendingTrendHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);
  });
});
