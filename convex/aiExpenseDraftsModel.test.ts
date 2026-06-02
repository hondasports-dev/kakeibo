import { describe, expect, it } from "vitest";
import {
  AI_EXPENSE_DRAFT_REVIEW_REASONS,
  AI_EXPENSE_DRAFT_STATUSES,
  resolveReceiptShopNameFromDraft,
} from "./aiExpenseDraftsModel";

describe("AI expense draft model", () => {
  it("下書き状態はキューから登録済みまでの固定状態に限定する", () => {
    expect(AI_EXPENSE_DRAFT_STATUSES).toEqual([
      "queued",
      "analyzing",
      "ready",
      "needs_review",
      "failed",
      "registered",
    ]);
  });

  it("reviewReasons は UI と分類ロジックで扱える固定理由に限定する", () => {
    expect(AI_EXPENSE_DRAFT_REVIEW_REASONS).toEqual([
      "low_confidence",
      "missing_required_field",
      "ambiguous_document_type",
      "ambiguous_category",
      "amount_mismatch",
      "parse_failed",
    ]);
  });

  it("レシート下書きは shopName を receipts.shopName に変換する", () => {
    expect(
      resolveReceiptShopNameFromDraft({
        documentType: "receipt",
        shopName: "スーパー青葉",
        paymentPlace: "支払場所",
        payeeName: "支払先",
        paymentPurpose: "支払内容",
      }),
    ).toBe("スーパー青葉");
  });

  it("コンビニ払込票下書きは支払先と支払内容を優先して receipts.shopName に変換する", () => {
    expect(
      resolveReceiptShopNameFromDraft({
        documentType: "convenience_payment",
        shopName: "セブンイレブン",
        paymentPlace: "セブンイレブン",
        payeeName: "東京都",
        paymentPurpose: "自動車税",
      }),
    ).toBe("東京都 自動車税");
  });

  it("コンビニ払込票で支払先がない場合は支払場所を receipts.shopName に変換する", () => {
    expect(
      resolveReceiptShopNameFromDraft({
        documentType: "convenience_payment",
        paymentPlace: "ローソン",
      }),
    ).toBe("ローソン");
  });
});
