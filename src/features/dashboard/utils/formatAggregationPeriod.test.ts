import { describe, expect, it } from "vitest";
import { formatAggregationPeriod } from "./formatAggregationPeriod";

describe("formatAggregationPeriod", () => {
  it("集計期間をコンパクトな日本語形式で表示する", () => {
    expect(formatAggregationPeriod("2026-06-15", "2026-06-21")).toBe(
      "集計期間：6/15（月）〜6/21（日）",
    );
  });
});
