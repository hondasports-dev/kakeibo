import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  buildDraftRegistrationItems,
  reconcileDraftExpenseEntries,
} from "./reconcileExpenseEntries";

const groupId = "group-1" as Id<"groups">;
const draftId = "draft-1" as Id<"aiExpenseDrafts">;
const catFood = "cat-food" as Id<"categories">;
const catDaily = "cat-daily" as Id<"categories">;

function draft(overrides: Record<string, unknown> = {}) {
  return {
    _id: draftId,
    _creationTime: 1,
    groupId,
    sourceType: "image_upload",
    status: "ready",
    documentType: "receipt",
    shopName: "スーパー青葉",
    date: "2026-08-26",
    amountYen: 1200,
    categoryId: catFood,
    confidence: {},
    reviewReasons: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Doc<"aiExpenseDrafts">;
}

function item(id: string, amountYen: number, categoryId: Id<"categories">) {
  return {
    _id: id,
    _creationTime: 1,
    groupId,
    draftId,
    itemName: id,
    amountYen,
    categoryId,
    confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
    createdAt: 1,
    updatedAt: 1,
  } as Doc<"aiExpenseDraftItems">;
}

function createDb(initial: Array<Record<string, unknown>>) {
  const entries = new Map(initial.map((entry) => [entry._id as string, { ...entry }]));
  let sequence = initial.length;
  const db = {
    get: vi.fn(async (id: string) => {
      if (id === catFood || id === catDaily) return { _id: id, groupId, isActive: true };
      return entries.get(id) ?? null;
    }),
    query: vi.fn(() => ({
      withIndex: vi.fn(() => ({ take: vi.fn(async () => [...entries.values()]) })),
    })),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      entries.set(id, { ...entries.get(id), ...value });
    }),
    insert: vi.fn(async (_table: string, value: Record<string, unknown>) => {
      const id = `entry-${++sequence}`;
      entries.set(id, { _id: id, ...value });
      return id;
    }),
    delete: vi.fn(async (id: string) => {
      entries.delete(id);
    }),
  };
  return { db, entries };
}

describe("totalOnly registration contract", () => {
  it("明細合計が不一致でもユーザー確認済みレシート合計だけを登録対象にする", () => {
    const source = draft({
      amountYen: 9999,
      registrationMode: "totalOnly",
      receiptTotalResolution: {
        status: "verified",
        protectedAmountYen: 9999,
        candidates: [{ amountYen: 9999, source: "user_confirmed", evidence: "review.amountYen" }],
        reasons: [],
      },
      taxSummaries: undefined,
    });

    expect(buildDraftRegistrationItems(source, [item("ocr-1", 400, catDaily)])).toEqual([
      { itemName: "スーパー青葉", amountYen: 9999, categoryId: catFood },
    ]);
  });

  it("detailedからtotalOnlyへ切り替えても既存行を再利用し余分な行を削除する", async () => {
    const { db, entries } = createDb([
      { _id: "entry-food", groupId, aiExpenseDraftId: draftId, categoryId: catFood },
      { _id: "entry-daily", groupId, aiExpenseDraftId: draftId, categoryId: catDaily },
    ]);
    const ids = await reconcileDraftExpenseEntries({ db } as never, {
      draft: draft(),
      groupId,
      userId: "user-1",
      items: [{ itemName: "スーパー青葉", amountYen: 1200, categoryId: catFood }],
      now: 2,
    });

    expect(ids).toEqual(["entry-food"]);
    expect([...entries.values()]).toHaveLength(1);
    expect(entries.get("entry-food")).toMatchObject({ amount: 1200, categoryId: catFood });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("totalOnlyからdetailedへの切替と同内容の再送で重複行を作らない", async () => {
    const { db, entries } = createDb([
      { _id: "entry-1", groupId, aiExpenseDraftId: draftId, categoryId: catFood },
    ]);
    const args = {
      draft: draft(),
      groupId,
      userId: "user-1",
      items: [
        { itemName: "食品", amountYen: 400, categoryId: catFood },
        { itemName: "日用品", amountYen: 800, categoryId: catDaily },
      ],
      now: 2,
    };
    await reconcileDraftExpenseEntries({ db } as never, args);
    await reconcileDraftExpenseEntries({ db } as never, { ...args, now: 3 });

    expect([...entries.values()]).toHaveLength(2);
    expect([...entries.values()].reduce((sum, entry) => sum + Number(entry.amount), 0)).toBe(1200);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
