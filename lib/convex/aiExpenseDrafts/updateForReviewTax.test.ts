import type { UserIdentity } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { updateForReviewHandler } from "../../../convex/aiExpenseDrafts/mutations";
import { applyReceiptTaxSettingsHandler } from "./applyReceiptTaxSettings";

const GROUP_ID = "group-001" as Id<"groups">;
const DRAFT_ID = "draft-tax" as Id<"aiExpenseDrafts">;
const CAT_ID = "cat-food" as Id<"categories">;

function createIdentity(): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|user-001",
    subject: "user-001",
    issuer: "https://issuer.example",
  };
}

type StoredDoc = Record<string, unknown> & { _id: string };

function createInMemoryMutationCtx(initial: { draft: StoredDoc; items: StoredDoc[] }): {
  ctx: MutationCtx;
  getDraft: () => StoredDoc;
  getItems: () => StoredDoc[];
} {
  const docs = new Map<string, StoredDoc>();
  docs.set(initial.draft._id, { ...initial.draft });
  for (const item of initial.items) {
    docs.set(item._id, { ...item });
  }
  let insertCounter = 0;

  const groupMember = {
    _id: "member-001",
    _creationTime: 1000,
    groupId: GROUP_ID,
    userId: createIdentity().tokenIdentifier,
    role: "owner",
  };

  const ctx = {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(createIdentity()),
    },
    db: {
      get: vi.fn(async (id: string) => docs.get(id) ?? null),
      patch: vi.fn(async (id: string, fields: Record<string, unknown>) => {
        const current = docs.get(id);
        if (current) {
          docs.set(id, { ...current, ...fields });
        }
      }),
      insert: vi.fn(async (_table: string, doc: Record<string, unknown>) => {
        insertCounter += 1;
        const id = `item-new-${insertCounter}`;
        docs.set(id, { _id: id, ...doc });
        return id;
      }),
      delete: vi.fn(async (id: string) => {
        docs.delete(id);
      }),
      query: vi.fn(() => ({
        withIndex: vi.fn((indexName: string, builder?: (q: unknown) => unknown) => {
          if (indexName === "by_user_id") {
            const q = { eq: vi.fn().mockImplementation(() => q) };
            builder?.(q);
            return { unique: vi.fn().mockResolvedValue(groupMember) };
          }
          const filters: Record<string, unknown> = {};
          const q = {
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              filters[field] = value;
              return q;
            }),
          };
          builder?.(q);
          const filtered = [...docs.values()].filter((doc) =>
            Object.entries(filters).every(([field, value]) => doc[field] === value),
          );
          return {
            order: vi.fn().mockReturnValue({
              take: vi.fn().mockResolvedValue(filtered),
              collect: vi.fn().mockResolvedValue(filtered),
            }),
          };
        }),
      })),
    },
  } as unknown as MutationCtx;

  docs.set(CAT_ID, { _id: CAT_ID, groupId: GROUP_ID, isActive: true });

  return {
    ctx,
    getDraft: () => docs.get(DRAFT_ID)!,
    getItems: () =>
      [...docs.values()].filter(
        (doc) => doc.draftId === DRAFT_ID && doc._id !== DRAFT_ID && doc._id !== CAT_ID,
      ),
  };
}

const externalTaxSummaries = [
  {
    taxRatePercent: 8 as const,
    taxMode: "external" as const,
    taxableAmountYen: 100,
    taxableAmountBasis: "tax_excluded" as const,
    taxYen: 8,
    roundingMethod: "unknown" as const,
    confidence: {},
    warnings: [] as string[],
  },
];

describe("updateForReviewHandler tax reinterpretation", () => {
  it("税サマリ付き下書きの明細更新後も税再解釈を実行し printedAmountYen を保持する", async () => {
    const { ctx, getDraft, getItems } = createInMemoryMutationCtx({
      draft: {
        _id: DRAFT_ID,
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        shopName: "テスト店",
        date: "2026-07-04",
        amountYen: 108,
        categoryId: CAT_ID,
        confidence: { shopName: 1, date: 1, amountYen: 1, categoryId: 1 },
        warnings: [],
        reviewReasons: ["user_confirmation_required"],
        taxSummaries: externalTaxSummaries,
        createdAt: 1,
        updatedAt: 1,
      },
      items: [
        {
          _id: "item-1",
          groupId: GROUP_ID,
          draftId: DRAFT_ID,
          itemName: "商品A",
          amountYen: 100,
          printedAmountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const result = await updateForReviewHandler(ctx, {
      draftId: DRAFT_ID,
      documentType: "receipt",
      shopName: "テスト店",
      date: "2026-07-04",
      amountYen: 108,
      categoryId: CAT_ID,
      items: [
        {
          itemName: "商品A",
          amountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
        },
      ],
    });

    expect(result.status).toBe("ready");
    const items = getItems();
    expect(items[0]?.printedAmountYen).toBe(100);
    expect(items[0]?.taxResolutionStatus).toBe("resolved");
    expect(getDraft().taxSummaries).toBeDefined();
  });

  it("外税レシートで一括適用後の明細手修正でも税状態が維持され ready になり得る", async () => {
    const { ctx, getItems } = createInMemoryMutationCtx({
      draft: {
        _id: DRAFT_ID,
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        shopName: "テスト店",
        date: "2026-07-04",
        amountYen: 108,
        categoryId: CAT_ID,
        confidence: { shopName: 1, date: 1, amountYen: 1, categoryId: 1 },
        warnings: [],
        reviewReasons: ["user_confirmation_required"],
        taxSummaries: externalTaxSummaries,
        createdAt: 1,
        updatedAt: 1,
      },
      items: [
        {
          _id: "item-1",
          groupId: GROUP_ID,
          draftId: DRAFT_ID,
          itemName: "商品A",
          amountYen: 100,
          printedAmountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await applyReceiptTaxSettingsHandler(ctx, { draftId: DRAFT_ID }, GROUP_ID);

    const afterBulk = getItems();
    expect(afterBulk[0]?.taxResolutionStatus).toBe("resolved");

    const result = await updateForReviewHandler(ctx, {
      draftId: DRAFT_ID,
      documentType: "receipt",
      shopName: "テスト店",
      date: "2026-07-04",
      amountYen: 108,
      categoryId: CAT_ID,
      items: [
        {
          itemName: "商品A",
          amountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(getItems()[0]?.taxResolutionStatus).toBe("resolved");
  });

  it("明細のみ修正で支払合計と不一致が残る場合は needs_review のまま", async () => {
    const { ctx, getDraft } = createInMemoryMutationCtx({
      draft: {
        _id: DRAFT_ID,
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        shopName: "テスト店",
        date: "2026-07-04",
        amountYen: 108,
        categoryId: CAT_ID,
        confidence: { shopName: 1, date: 1, amountYen: 1, categoryId: 1 },
        warnings: [],
        reviewReasons: [],
        taxSummaries: externalTaxSummaries,
        createdAt: 1,
        updatedAt: 1,
      },
      items: [
        {
          _id: "item-1",
          groupId: GROUP_ID,
          draftId: DRAFT_ID,
          itemName: "商品A",
          amountYen: 90,
          printedAmountYen: 90,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const result = await updateForReviewHandler(ctx, {
      draftId: DRAFT_ID,
      documentType: "receipt",
      shopName: "テスト店",
      date: "2026-07-04",
      amountYen: 108,
      categoryId: CAT_ID,
      items: [
        {
          itemName: "商品A",
          amountYen: 90,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
        },
      ],
    });

    expect(result.status).toBe("needs_review");
    expect(getDraft().reviewReasons).toContain("amount_mismatch");
  });

  it("明細金額の手修正は税再解釈後も printedAmountYen に保持される", async () => {
    const { ctx, getItems } = createInMemoryMutationCtx({
      draft: {
        _id: DRAFT_ID,
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        shopName: "テスト店",
        date: "2026-07-04",
        amountYen: 108,
        categoryId: CAT_ID,
        confidence: { shopName: 1, date: 1, amountYen: 1, categoryId: 1 },
        warnings: [],
        reviewReasons: ["user_confirmation_required"],
        taxSummaries: externalTaxSummaries,
        createdAt: 1,
        updatedAt: 1,
      },
      items: [
        {
          _id: "item-1",
          groupId: GROUP_ID,
          draftId: DRAFT_ID,
          itemName: "商品A",
          amountYen: 100,
          printedAmountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
          taxResolutionStatus: "unresolved",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await updateForReviewHandler(ctx, {
      draftId: DRAFT_ID,
      documentType: "receipt",
      shopName: "テスト店",
      date: "2026-07-04",
      amountYen: 108,
      categoryId: CAT_ID,
      items: [
        {
          itemName: "商品A",
          amountYen: 99,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
        },
      ],
    });

    const items = getItems();
    expect(items[0]?.printedAmountYen).toBe(99);
    expect(items[0]?.taxResolutionStatus).toBe("resolved");
  });

  it("外税一括適用後に印字金額を変えず保存すると ready になり得る", async () => {
    const { ctx, getDraft, getItems } = createInMemoryMutationCtx({
      draft: {
        _id: DRAFT_ID,
        groupId: GROUP_ID,
        status: "needs_review",
        documentType: "receipt",
        shopName: "テスト店",
        date: "2026-07-04",
        amountYen: 108,
        categoryId: CAT_ID,
        confidence: { shopName: 1, date: 1, amountYen: 1, categoryId: 1 },
        warnings: [],
        reviewReasons: ["user_confirmation_required"],
        taxSummaries: externalTaxSummaries,
        createdAt: 1,
        updatedAt: 1,
      },
      items: [
        {
          _id: "item-1",
          groupId: GROUP_ID,
          draftId: DRAFT_ID,
          itemName: "商品A",
          amountYen: 100,
          printedAmountYen: 100,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await applyReceiptTaxSettingsHandler(ctx, { draftId: DRAFT_ID }, GROUP_ID);
    const afterBulk = getItems()[0];
    expect(afterBulk?.taxResolutionStatus).toBe("resolved");
    expect(afterBulk?.printedAmountYen).toBe(100);

    const result = await updateForReviewHandler(ctx, {
      draftId: DRAFT_ID,
      documentType: "receipt",
      shopName: "テスト店",
      date: "2026-07-04",
      amountYen: 108,
      categoryId: CAT_ID,
      items: [
        {
          itemName: "商品A",
          amountYen: afterBulk!.printedAmountYen!,
          categoryId: CAT_ID,
          confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(getItems()[0]?.printedAmountYen).toBe(100);
    expect(getDraft().reviewReasons).not.toContain("amount_mismatch");
  });
});
