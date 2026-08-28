import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  buildDraftRegistrationItems,
  reconcileDraftExpenseEntries,
} from "./reconcileExpenseEntries";
import {
  receiptTaxGoldenCaseLedger,
  type ReceiptTaxGoldenCase,
} from "../../domain/receipt/tax/fixtures/receiptTaxGoldenCaseLedger";
import { interpretReceiptTax } from "../../domain/receipt/tax/interpretReceiptTax";

const groupId = "golden-group" as Id<"groups">;
const draftId = "golden-draft" as Id<"aiExpenseDrafts">;
const categoryId = "golden-category" as Id<"categories">;

function getCase(id: string): ReceiptTaxGoldenCase & {
  input: NonNullable<ReceiptTaxGoldenCase["input"]>;
} {
  const testCase = receiptTaxGoldenCaseLedger.find((candidate) => candidate.id === id);
  if (!testCase?.input) {
    throw new Error(id + " golden case is incomplete");
  }
  return testCase as ReceiptTaxGoldenCase & {
    input: NonNullable<ReceiptTaxGoldenCase["input"]>;
  };
}

function draftFor(testCase: ReturnType<typeof getCase>): Doc<"aiExpenseDrafts"> {
  const interpretation = interpretReceiptTax(testCase.input);
  return {
    _id: draftId,
    _creationTime: 1,
    groupId,
    sourceType: "image_upload",
    status: "ready",
    documentType: "receipt",
    shopName: "匿名レシート",
    date: "2026-08-28",
    amountYen: testCase.expected.registeredAmountYen ?? testCase.input.amountYen,
    categoryId,
    registrationMode:
      testCase.expected.registrationMode === "requiresUserConfirmation"
        ? "detailed"
        : testCase.expected.registrationMode,
    receiptTotalResolution: interpretation.receiptTotalResolution,
    confidence: { documentType: 1, amountYen: 1, categoryId: 1 },
    reviewReasons: [],
    createdAt: 1,
    updatedAt: 1,
  } as Doc<"aiExpenseDrafts">;
}

function itemsFor(testCase: ReturnType<typeof getCase>): Doc<"aiExpenseDraftItems">[] {
  const interpretation = interpretReceiptTax(testCase.input);
  return testCase.input.items.map((sourceItem, index) => {
    const interpretedItem = interpretation.items[index];
    if (!interpretedItem) {
      throw new Error(`${testCase.id} item ${index} is missing from the interpretation`);
    }
    return {
      _id: ("golden-item-" + index) as Id<"aiExpenseDraftItems">,
      _creationTime: 1,
      groupId,
      draftId,
      itemName: sourceItem.itemName,
      amountYen: sourceItem.printedAmountYen,
      printedAmountYen: sourceItem.printedAmountYen,
      normalizedAmountYen: interpretedItem.normalizedAmountYen,
      categoryId,
      confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
      createdAt: 1,
      updatedAt: 1,
    };
  }) as Doc<"aiExpenseDraftItems">[];
}

function createDb() {
  const entries = new Map<string, Record<string, unknown>>();
  let sequence = 0;
  const db = {
    get: vi.fn(async (id: string) => {
      if (id === categoryId) {
        return { _id: categoryId, groupId, isActive: true };
      }
      return entries.get(id) ?? null;
    }),
    query: vi.fn(() => ({
      withIndex: vi.fn(() => ({
        take: vi.fn(async () => [...entries.values()]),
      })),
    })),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      entries.set(id, { ...entries.get(id), _id: id, ...value });
    }),
    insert: vi.fn(async (_table: string, value: Record<string, unknown>) => {
      const id = "golden-entry-" + ++sequence;
      entries.set(id, { _id: id, ...value });
      return id;
    }),
    delete: vi.fn(async (id: string) => {
      entries.delete(id);
    }),
  };
  return { db, entries };
}

describe("Issue #672 golden case registration boundary", () => {
  it("R015/R018は確認済みtotalOnlyの金額を実登録し、再送で重複しない", async () => {
    for (const id of ["R015", "R018"]) {
      const testCase = getCase(id);
      const draft = draftFor(testCase);
      const items = itemsFor(testCase);
      const registrationItems = buildDraftRegistrationItems(draft, items);
      const expectedAmount = testCase.expected.registeredAmountYen;

      expect(draft.registrationMode).toBe("totalOnly");
      expect(expectedAmount).not.toBeNull();
      expect(registrationItems).toEqual([
        { itemName: "匿名レシート", amountYen: expectedAmount, categoryId },
      ]);

      const { db, entries } = createDb();
      const args = {
        draft,
        groupId,
        userId: "golden-user",
        items: registrationItems,
        now: 2,
      };
      const firstIds = await reconcileDraftExpenseEntries({ db } as never, args);
      const secondIds = await reconcileDraftExpenseEntries({ db } as never, {
        ...args,
        now: 3,
      });

      expect(secondIds).toEqual(firstIds);
      expect([...entries.values()]).toHaveLength(1);
      expect([...entries.values()][0]).toMatchObject({
        amount: expectedAmount,
        aiExpenseDraftId: draftId,
        categoryId,
      });
      expect(db.insert).toHaveBeenCalledTimes(1);
    }
  });

  it("R020は補正済み明細をカテゴリ集計して再登録しても一行に保つ", async () => {
    const testCase = getCase("R020");
    const draft = draftFor(testCase);
    const registrationItems = buildDraftRegistrationItems(draft, itemsFor(testCase));
    const { db, entries } = createDb();

    expect(draft.registrationMode).toBe("detailed");
    expect(registrationItems).toEqual([{ itemName: "商品A", amountYen: 110, categoryId }]);

    const args = {
      draft,
      groupId,
      userId: "golden-user",
      items: registrationItems,
      now: 2,
    };
    await reconcileDraftExpenseEntries({ db } as never, args);
    await reconcileDraftExpenseEntries({ db } as never, { ...args, now: 3 });

    expect([...entries.values()]).toHaveLength(1);
    expect([...entries.values()][0]).toMatchObject({
      amount: testCase.expected.registeredAmountYen,
      title: "商品A",
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
