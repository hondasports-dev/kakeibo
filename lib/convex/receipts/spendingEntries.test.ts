import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import {
  getDateSpendingEntries,
  getMonthIncomeEntries,
  getMonthSpendingEntries,
  getWeekIncomeEntries,
  getWeekSpendingEntries,
  mapExpenseEntryToSpendingEntry,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
} from "./spendingEntries";

function makeExpenseEntry(
  overrides: Partial<Doc<"expenseEntries">> & { _id: Id<"expenseEntries"> },
): Doc<"expenseEntries"> {
  return {
    _creationTime: 0,
    groupId: "group-1" as Id<"groups">,
    sourceDocumentId: undefined,
    aiExpenseDraftId: undefined,
    date: "2024-01-10",
    amount: 1000,
    categoryId: "cat-1" as Id<"categories">,
    title: "スーパー",
    memo: undefined,
    entryType: "expense",
    source: "manual",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"expenseEntries">;
}

function makeReceipt(
  overrides: Partial<Doc<"receipts">> & { _id: Id<"receipts"> },
): Doc<"receipts"> {
  return {
    _creationTime: 0,
    groupId: "group-1" as Id<"groups">,
    date: "2024-01-10",
    type: "expense",
    shopName: "スーパー",
    bankName: undefined,
    amountYen: 1000,
    categoryId: "cat-1" as Id<"categories">,
    memo: undefined,
    weekStartDate: "2024-01-08",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"receipts">;
}

function makeSourceDocument(
  overrides: Partial<Doc<"sourceDocuments">> & { _id: Id<"sourceDocuments"> },
): Doc<"sourceDocuments"> {
  return {
    _creationTime: 0,
    groupId: groupId,
    sourceType: "manual",
    status: "finalized",
    date: "2024-01-10",
    totalAmount: 3000,
    shopName: "スーパー北浜",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"sourceDocuments">;
}

function makeAiExpenseDraft(
  overrides: Partial<Doc<"aiExpenseDrafts">> & { _id: Id<"aiExpenseDrafts"> },
): Doc<"aiExpenseDrafts"> {
  return {
    _creationTime: 0,
    groupId,
    sourceType: "image_upload",
    status: "registered",
    documentType: "receipt",
    shopName: "スーパー北浜",
    amountYen: 3000,
    confidence: {},
    warnings: [],
    reviewReasons: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"aiExpenseDrafts">;
}

function makeAiExpenseDraftItem(
  overrides: Partial<Doc<"aiExpenseDraftItems">> & { _id: Id<"aiExpenseDraftItems"> },
): Doc<"aiExpenseDraftItems"> {
  return {
    _creationTime: 0,
    groupId,
    draftId: "draft-1" as Id<"aiExpenseDrafts">,
    itemName: "たっぷりホイップあんぱん",
    amountYen: 1200,
    categoryId: "cat-1" as Id<"categories">,
    confidence: {},
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"aiExpenseDraftItems">;
}

function createQueryCtx({
  expenseEntries = [],
  receipts = [],
  sourceDocuments = [],
  aiExpenseDrafts = [],
  aiExpenseDraftItems = [],
}: {
  expenseEntries?: Doc<"expenseEntries">[];
  receipts?: Doc<"receipts">[];
  sourceDocuments?: Doc<"sourceDocuments">[];
  aiExpenseDrafts?: Doc<"aiExpenseDrafts">[];
  aiExpenseDraftItems?: Doc<"aiExpenseDraftItems">[];
} = {}): QueryCtx {
  const makeQueryBuilder = (docs: unknown[]) => {
    const q: {
      eq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
    };
    q.eq.mockReturnValue(q);
    q.gte.mockReturnValue(q);
    q.lte.mockReturnValue(q);

    const chain: {
      [Symbol.asyncIterator](): AsyncIterator<unknown>;
      order: (direction: "asc" | "desc") => typeof chain;
      take: (limit: number) => Promise<unknown[]>;
    } = {
      [Symbol.asyncIterator]: async function* () {
        yield* docs;
      },
      order: () => chain,
      take: async (limit) => docs.slice(0, limit),
    };

    return { q, chain };
  };

  const query = vi.fn().mockImplementation((tableName: string) => {
    const docs =
      tableName === "expenseEntries"
        ? (expenseEntries as unknown[])
        : tableName === "receipts"
          ? (receipts as unknown[])
          : (aiExpenseDraftItems as unknown[]);
    return {
      withIndex: (_indexName: string, builder: (q: unknown) => unknown) => {
        const { q, chain } = makeQueryBuilder(docs);
        builder(q);
        return chain;
      },
    };
  });

  return {
    db: {
      query,
      get: vi.fn().mockImplementation(async (id: string) => {
        return (
          sourceDocuments.find((document) => document._id === id) ??
          aiExpenseDrafts.find((draft) => draft._id === id) ??
          null
        );
      }),
    },
  } as unknown as QueryCtx;
}

const groupId = "group-1" as Id<"groups">;

describe("mapReceiptToSpendingEntry", () => {
  it("支出レシートを SpendingEntry に変換する", () => {
    const receipt = makeReceipt({
      _id: "r1" as Id<"receipts">,
      type: "expense",
      shopName: "コンビニ",
      amountYen: 500,
    });
    expect(mapReceiptToSpendingEntry(receipt)).toEqual({
      _id: "r1",
      date: "2024-01-10",
      type: "expense",
      shopName: "コンビニ",
      bankName: undefined,
      amountYen: 500,
      categoryId: "cat-1",
      memo: undefined,
      recordType: "receipt",
    });
  });

  it("収入レシートを SpendingEntry に変換する", () => {
    const receipt = makeReceipt({
      _id: "r2" as Id<"receipts">,
      type: "income",
      shopName: undefined,
      bankName: "三菱UFJ",
      amountYen: 200000,
    });
    expect(mapReceiptToSpendingEntry(receipt)).toEqual({
      _id: "r2",
      date: "2024-01-10",
      type: "income",
      shopName: undefined,
      bankName: "三菱UFJ",
      amountYen: 200000,
      categoryId: "cat-1",
      memo: undefined,
      recordType: "receipt",
    });
  });

  it("type が undefined のレシートも変換する", () => {
    const receipt = makeReceipt({ _id: "r3" as Id<"receipts">, type: undefined });
    expect(mapReceiptToSpendingEntry(receipt).type).toBeUndefined();
  });
});

describe("mapExpenseEntryToSpendingEntry", () => {
  it("支出エントリを SpendingEntry に変換する", () => {
    const entry = makeExpenseEntry({
      _id: "e1" as Id<"expenseEntries">,
      entryType: "expense",
      title: "スーパー",
      amount: 1500,
    });
    expect(mapExpenseEntryToSpendingEntry(entry)).toEqual({
      _id: "e1",
      date: "2024-01-10",
      type: "expense",
      shopName: "スーパー",
      bankName: undefined,
      amountYen: 1500,
      categoryId: "cat-1",
      memo: undefined,
      recordType: "expenseEntry",
    });
  });

  it("収入エントリを SpendingEntry に変換する", () => {
    const entry = makeExpenseEntry({
      _id: "e2" as Id<"expenseEntries">,
      entryType: "income",
      title: "給与",
      amount: 300000,
      categoryId: "cat-1" as Id<"categories">,
    });
    expect(mapExpenseEntryToSpendingEntry(entry)).toEqual({
      _id: "e2",
      date: "2024-01-10",
      type: "income",
      shopName: undefined,
      bankName: "給与",
      amountYen: 300000,
      categoryId: "cat-1",
      memo: undefined,
      recordType: "expenseEntry",
    });
  });

  it("categoryId が undefined ならエラーを投げる", () => {
    const entry = makeExpenseEntry({
      _id: "e3" as Id<"expenseEntries">,
      categoryId: undefined,
      entryType: "expense",
    });
    expect(() => mapExpenseEntryToSpendingEntry(entry)).toThrow(
      "Expense entry category is required for spending aggregation",
    );
  });
});

describe("mapIncomeExpenseEntryToListEntry", () => {
  it("収入エントリを IncomeListEntry に変換する", () => {
    const entry = makeExpenseEntry({
      _id: "e1" as Id<"expenseEntries">,
      entryType: "income",
      title: "銀行",
      amount: 5000,
    });
    expect(mapIncomeExpenseEntryToListEntry(entry)).toEqual({
      _id: "e1",
      date: "2024-01-10",
      type: "income",
      bankName: "銀行",
      amountYen: 5000,
      memo: undefined,
      recordType: "expenseEntry",
    });
  });
});

describe("mapReceiptToIncomeListEntry", () => {
  it("収入レシートを IncomeListEntry に変換する", () => {
    const receipt = makeReceipt({
      _id: "r1" as Id<"receipts">,
      type: "income",
      bankName: "三菱UFJ",
      amountYen: 100000,
    });
    expect(mapReceiptToIncomeListEntry(receipt)).toEqual({
      _id: "r1",
      date: "2024-01-10",
      type: "income",
      bankName: "三菱UFJ",
      amountYen: 100000,
      memo: undefined,
      recordType: "receipt",
    });
  });
});

describe("getWeekIncomeEntries", () => {
  it("expenseEntries に収入があれば receipt は無視する", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({
          _id: "e1" as Id<"expenseEntries">,
          entryType: "income",
          title: "給与",
          amount: 100000,
        }),
      ],
      receipts: [
        makeReceipt({
          _id: "r1" as Id<"receipts">,
          type: "income",
          bankName: "銀行",
          amountYen: 1,
        }),
      ],
    });

    const result = await getWeekIncomeEntries(ctx, groupId, "2024-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("e1");
    expect(result[0].amountYen).toBe(100000);
  });

  it("expenseEntries があり支出のみなら空配列を返す", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e1" as Id<"expenseEntries">, entryType: "expense" }),
      ],
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, type: "income" })],
    });

    const result = await getWeekIncomeEntries(ctx, groupId, "2024-01-08");
    expect(result).toEqual([]);
  });

  it("expenseEntries が空なら receipt の収入を返す", async () => {
    const ctx = createQueryCtx({
      receipts: [
        makeReceipt({
          _id: "r1" as Id<"receipts">,
          type: "income",
          bankName: "銀行",
          amountYen: 5000,
        }),
      ],
    });

    const result = await getWeekIncomeEntries(ctx, groupId, "2024-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r1");
  });

  it("expenseEntries も receipts も空なら空配列", async () => {
    const ctx = createQueryCtx();
    const result = await getWeekIncomeEntries(ctx, groupId, "2024-01-08");
    expect(result).toEqual([]);
  });
});

describe("getWeekSpendingEntries", () => {
  it("expenseEntries に支出があれば receipt は無視する", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({
          _id: "e1" as Id<"expenseEntries">,
          entryType: "expense",
          title: "スーパー",
          amount: 1500,
        }),
      ],
      receipts: [
        makeReceipt({
          _id: "r1" as Id<"receipts">,
          type: "expense",
          shopName: "コンビニ",
          amountYen: 1,
        }),
      ],
    });

    const result = await getWeekSpendingEntries(ctx, groupId, "2024-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("e1");
  });

  it("expenseEntries が空なら receipt の支出を返す", async () => {
    const ctx = createQueryCtx({
      receipts: [
        makeReceipt({
          _id: "r1" as Id<"receipts">,
          type: "expense",
          shopName: "コンビニ",
          amountYen: 500,
        }),
      ],
    });

    const result = await getWeekSpendingEntries(ctx, groupId, "2024-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r1");
  });

  it("sourceDocument が同じ支出をレシートグループとして返す", async () => {
    const sourceDocumentId = "source-1" as Id<"sourceDocuments">;
    const result = await getWeekSpendingEntries(
      createQueryCtx({
        expenseEntries: [
          makeExpenseEntry({
            _id: "e-food" as Id<"expenseEntries">,
            sourceDocumentId,
            title: "食料品",
            amount: 2000,
          }),
          makeExpenseEntry({
            _id: "e-daily" as Id<"expenseEntries">,
            sourceDocumentId,
            title: "洗剤",
            amount: 1000,
          }),
        ],
        sourceDocuments: [makeSourceDocument({ _id: sourceDocumentId })],
      }),
      groupId,
      "2024-01-08",
    );

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.receiptGroupId)).toEqual([
      "sourceDocument:source-1",
      "sourceDocument:source-1",
    ]);
    expect(result.map((entry) => entry.itemName)).toEqual(["食料品", "洗剤"]);
    expect(result[0]).toMatchObject({
      receiptShopName: "スーパー北浜",
      receiptTotalAmountYen: 3000,
    });
  });

  it("AI下書きの明細名を履歴用の商品名として返す", async () => {
    const draftId = "draft-1" as Id<"aiExpenseDrafts">;
    const result = await getWeekSpendingEntries(
      createQueryCtx({
        expenseEntries: [
          makeExpenseEntry({
            _id: "e-bread" as Id<"expenseEntries">,
            aiExpenseDraftId: draftId,
            title: "ジャパン 明石稲美店",
            amount: 1200,
          }),
        ],
        aiExpenseDrafts: [makeAiExpenseDraft({ _id: draftId })],
        aiExpenseDraftItems: [
          makeAiExpenseDraftItem({
            _id: "draft-item-1" as Id<"aiExpenseDraftItems">,
            draftId,
          }),
        ],
      }),
      groupId,
      "2024-01-08",
    );

    expect(result[0]).toMatchObject({
      itemName: "たっぷりホイップあんぱん",
      receiptShopName: "スーパー北浜",
    });
  });
});

describe("getDateSpendingEntries", () => {
  it("expenseEntries あり支出はそちらを優先", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e1" as Id<"expenseEntries">, entryType: "expense" }),
      ],
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, type: "expense" })],
    });

    const result = await getDateSpendingEntries(ctx, groupId, "2024-01-10");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("e1");
  });

  it("expenseEntries 空なら receipt の支出を返す", async () => {
    const ctx = createQueryCtx({
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, type: "expense" })],
    });

    const result = await getDateSpendingEntries(ctx, groupId, "2024-01-10");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r1");
  });
});

describe("getMonthSpendingEntries", () => {
  it("expenseEntries あり支出はそちらを優先", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e1" as Id<"expenseEntries">, entryType: "expense" }),
      ],
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, type: "expense" })],
    });

    const result = await getMonthSpendingEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("e1");
  });

  it("月の終了日を含む範囲で receipt を返す", async () => {
    const ctx = createQueryCtx({
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, date: "2024-01-31", type: "expense" })],
    });

    const result = await getMonthSpendingEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r1");
  });

  it("収入だけの expenseEntries がある月は旧 receipt の支出を補完する", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e-income" as Id<"expenseEntries">, entryType: "income" }),
      ],
      receipts: [makeReceipt({ _id: "r1" as Id<"receipts">, type: "expense" })],
    });

    const result = await getMonthSpendingEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r1");
  });

  it("新形式の収入と旧形式の支出が同じ月にあれば両方を返す", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e-income" as Id<"expenseEntries">, entryType: "income" }),
      ],
      receipts: [makeReceipt({ _id: "r-expense" as Id<"receipts">, type: "expense" })],
    });

    const result = await getMonthSpendingEntries(ctx, groupId, "2024-01-01");
    expect(result.map((entry) => entry._id)).toEqual(["r-expense"]);
  });
});

describe("getMonthIncomeEntries", () => {
  it("expenseEntries がある月は expenseEntries の収入だけを返す", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e-income" as Id<"expenseEntries">, entryType: "income" }),
        makeExpenseEntry({ _id: "e-expense" as Id<"expenseEntries">, entryType: "expense" }),
      ],
      receipts: [makeReceipt({ _id: "r-income" as Id<"receipts">, type: "income" })],
    });

    const result = await getMonthIncomeEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("e-income");
  });

  it("expenseEntries が空なら旧 receipt の収入を返す", async () => {
    const ctx = createQueryCtx({
      receipts: [makeReceipt({ _id: "r-income" as Id<"receipts">, type: "income" })],
    });

    const result = await getMonthIncomeEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r-income");
  });

  it("新形式が支出だけの月は旧 receipt の収入を補完する", async () => {
    const ctx = createQueryCtx({
      expenseEntries: [
        makeExpenseEntry({ _id: "e-expense" as Id<"expenseEntries">, entryType: "expense" }),
      ],
      receipts: [makeReceipt({ _id: "r-income" as Id<"receipts">, type: "income" })],
    });

    const result = await getMonthIncomeEntries(ctx, groupId, "2024-01-01");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("r-income");
  });
});
