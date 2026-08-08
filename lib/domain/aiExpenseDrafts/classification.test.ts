import { describe, expect, it } from "vitest";
import { classifyCreatedDraft } from "./classification";

describe("classifyCreatedDraft", () => {
  it("画像解析直後は user_confirmation_required を付与して needs_review とする", () => {
    const result = classifyCreatedDraft({
      documentType: "receipt",
      shopName: "コンビニ",
      date: "2026-08-07",
      amountYen: 1000,
      confidence: {
        documentType: 0.99,
        shopName: 0.99,
        date: 0.99,
        amountYen: 0.99,
        categoryId: 0.99,
      },
      warnings: [],
    });
    expect(result.status).toBe("needs_review");
    expect(result.reviewReasons).toContain("user_confirmation_required");
  });

  it("既存の reviewReasons をマージする", () => {
    const result = classifyCreatedDraft({
      documentType: "unknown",
      confidence: {
        documentType: 0.3,
        shopName: 0.99,
        date: 0.99,
        amountYen: 0.99,
        categoryId: 0.99,
      },
      warnings: [],
      reviewReasons: ["amount_mismatch"],
    });
    expect(result.status).toBe("needs_review");
    expect(result.reviewReasons).toContain("user_confirmation_required");
    expect(result.reviewReasons).toContain("amount_mismatch");
    expect(result.reviewReasons).toContain("ambiguous_document_type");
  });
});
