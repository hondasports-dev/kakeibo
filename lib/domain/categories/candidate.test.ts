import { describe, expect, it } from "vitest";
import {
  buildCategoryCandidates,
  CATEGORY_CANDIDATE_MAX,
  resolveCategoryIdFromCandidates,
} from "./candidate";

describe("buildCategoryCandidates", () => {
  const categories = [
    { _id: "cat-1", name: "食費" },
    { _id: "cat-2", name: "外食" },
    { _id: "cat-3", name: "スーパー" },
    { _id: "cat-4", name: "交通費" },
  ];

  it("完全一致が最も優先度が高い", () => {
    const result = buildCategoryCandidates({
      documentType: "receipt",
      categoryName: "食費",
      categories,
    });
    expect(result[0]._id).toBe("cat-1");
  });

  it("キーワードがない場合は先頭から最大件数返す", () => {
    const result = buildCategoryCandidates({
      documentType: "unknown",
      categories,
    });
    expect(result.length).toBeLessThanOrEqual(CATEGORY_CANDIDATE_MAX);
    expect(result[0]._id).toBe("cat-1");
  });

  it("convenience_payment では paymentPurpose を優先", () => {
    const result = buildCategoryCandidates({
      documentType: "convenience_payment",
      paymentPurpose: "交通費",
      categories,
    });
    expect(result[0]._id).toBe("cat-4");
  });
});

describe("resolveCategoryIdFromCandidates", () => {
  it("候補からカテゴリ名に一致する ID を返す", () => {
    const candidates = [{ _id: "cat-1", name: "食費" }];
    expect(resolveCategoryIdFromCandidates("食費", candidates)).toBe("cat-1");
  });

  it("大文字小文字を無視する", () => {
    const candidates = [{ _id: "cat-1", name: "食費" }];
    expect(resolveCategoryIdFromCandidates("食費 ", candidates)).toBe("cat-1");
  });

  it("空・undefined なら undefined", () => {
    expect(resolveCategoryIdFromCandidates(undefined, [])).toBeUndefined();
    expect(resolveCategoryIdFromCandidates("  ", [])).toBeUndefined();
  });
});
