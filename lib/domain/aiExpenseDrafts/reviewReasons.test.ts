import { describe, expect, it } from "vitest";
import { mergeReviewReasons, nonTaxReviewReasons } from "./reviewReasons";

describe("mergeReviewReasons", () => {
  it("重複を除いて定義順にマージする", () => {
    expect(
      mergeReviewReasons(["amount_mismatch", "missing_required_field"], ["low_confidence"]),
    ).toEqual(["low_confidence", "missing_required_field", "amount_mismatch"]);
  });

  it("空配列も扱える", () => {
    expect(mergeReviewReasons([], [])).toEqual([]);
    expect(mergeReviewReasons([], ["ambiguous_category"])).toEqual(["ambiguous_category"]);
  });
});

describe("nonTaxReviewReasons", () => {
  it("user_confirmation_required と amount_mismatch を除外する", () => {
    expect(
      nonTaxReviewReasons([
        "low_confidence",
        "user_confirmation_required",
        "amount_mismatch",
        "missing_required_field",
      ]),
    ).toEqual(["low_confidence", "missing_required_field"]);
  });
});
