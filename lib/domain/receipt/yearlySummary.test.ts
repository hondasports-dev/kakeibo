import { describe, expect, it } from "vitest";
import { summarizeYearlyTrend } from "./yearlySummary";

const food = { name: "食費", color: "#8B5E3C" };
const utilities = { name: "光熱費", color: "#4F7CAC" };

describe("summarizeYearlyTrend", () => {
  it("12ヶ月の収支とカテゴリ積み上げを集計する", () => {
    const result = summarizeYearlyTrend({
      year: "2026",
      months: [
        {
          month: "2026-01",
          expenses: [
            { amountYen: 1200, categoryId: "food" },
            { amountYen: 8000, categoryId: "utilities" },
          ],
          incomes: [{ amountYen: 200000 }],
        },
        {
          month: "2026-08",
          expenses: [{ amountYen: 3000, categoryId: "food" }],
          incomes: [{ amountYen: 180000 }],
        },
      ],
      categoryInfoMap: new Map([
        ["food", food],
        ["utilities", utilities],
      ]),
    });

    expect(result.year).toBe("2026");
    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toMatchObject({
      month: "2026-01",
      totalAmountYen: 9200,
      totalIncomeYen: 200000,
      netAmountYen: 190800,
      count: 2,
      incomeCount: 1,
    });
    expect(result.months[7]).toMatchObject({
      month: "2026-08",
      totalAmountYen: 3000,
      totalIncomeYen: 180000,
      netAmountYen: 177000,
      count: 1,
    });
    expect(result.months[1]).toMatchObject({
      month: "2026-02",
      totalAmountYen: 0,
      totalIncomeYen: 0,
      netAmountYen: 0,
      count: 0,
      incomeCount: 0,
      byCategory: [],
    });
    expect(result.totalAmountYen).toBe(12200);
    expect(result.totalIncomeYen).toBe(380000);
    expect(result.netAmountYen).toBe(367800);
    expect(result.count).toBe(3);
    expect(result.incomeCount).toBe(2);
    expect(result.byCategory).toEqual([
      {
        categoryId: "utilities",
        categoryName: "光熱費",
        categoryColor: "#4F7CAC",
        totalAmountYen: 8000,
        count: 1,
      },
      {
        categoryId: "food",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 4200,
        count: 2,
      },
    ]);
  });

  it("データが無い年は0で埋めた12ヶ月を返す", () => {
    const result = summarizeYearlyTrend({
      year: "2025",
      months: [],
      categoryInfoMap: new Map(),
    });

    expect(result.months.map((month) => month.month)).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
    expect(result.totalAmountYen).toBe(0);
    expect(result.totalIncomeYen).toBe(0);
    expect(result.byCategory).toEqual([]);
  });

  it("不正な年は拒否する", () => {
    expect(() =>
      summarizeYearlyTrend({
        year: "26",
        months: [],
        categoryInfoMap: new Map(),
      }),
    ).toThrow("Invalid year: 26");
  });
});
