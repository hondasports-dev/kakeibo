import { describe, expect, it } from "vitest";
import type { IncomeListEntry, SpendingEntry } from "../receipt/spendingEntry";
import {
  buildHistoryCategoryBreakdown,
  buildHistoryComparison,
  buildHistoryTrend,
  calculatePreviousHistoryPeriod,
  summarizeHistoryGroups,
} from "./analytics";
import { filterHistoryGroups, groupHistoryEntries } from "./filter";

const categoryInfo = new Map([
  ["food", { name: "食費", color: "#f97316" }],
  ["daily", { name: "日用品", color: "#0ea5e9" }],
]);

function expense(id: string, date: string, amountYen: number, categoryId = "food"): SpendingEntry {
  return {
    _id: id,
    date,
    amountYen,
    categoryId,
    shopName: id,
    recordType: "expenseEntry",
  };
}

function income(id: string, date: string, amountYen: number): IncomeListEntry {
  return { _id: id, date, type: "income", amountYen, bankName: id, recordType: "expenseEntry" };
}

describe("expense search analytics", () => {
  it("カテゴリを上位5件とその他へ集約する", () => {
    const categories = Array.from({ length: 6 }, (_, index) => ({
      categoryId: `category-${index}`,
      categoryName: `カテゴリ${index}`,
      categoryColor: "#000000",
      totalAmountYen: index + 1,
      count: 1,
    })).reverse();

    expect(buildHistoryCategoryBreakdown(categories)).toEqual([
      ...categories.slice(0, 5),
      {
        categoryId: "__other__",
        categoryName: "その他",
        categoryColor: "#9E9E9E",
        totalAmountYen: 1,
        count: 1,
      },
    ]);
  });

  it("支出・収入を合算し、カテゴリ別に支出だけ集計する", () => {
    const groups = filterHistoryGroups(
      groupHistoryEntries(
        [expense("e1", "2026-07-01", 1000), expense("e2", "2026-07-02", 500, "daily")],
        [income("i1", "2026-07-03", 3000)],
      ),
      { entryType: "all", startDate: "2026-07-01", endDate: "2026-07-31" },
    );

    expect(summarizeHistoryGroups(groups, categoryInfo)).toEqual({
      count: 3,
      expenseCount: 2,
      incomeCount: 1,
      totalExpenseYen: 1500,
      totalIncomeYen: 3000,
      netAmountYen: 1500,
      byCategory: [
        {
          categoryId: "food",
          categoryName: "食費",
          categoryColor: "#f97316",
          totalAmountYen: 1000,
          count: 1,
        },
        {
          categoryId: "daily",
          categoryName: "日用品",
          categoryColor: "#0ea5e9",
          totalAmountYen: 500,
          count: 1,
        },
      ],
    });
  });

  it("期間推移を日単位で作り、空の日も表示する", () => {
    const groups = groupHistoryEntries([expense("e1", "2026-07-01", 1000)], []);
    const trend = buildHistoryTrend(groups, {
      entryType: "all",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
    });

    expect(trend).toEqual([
      expect.objectContaining({ key: "2026-07-01", totalExpenseYen: 1000, totalIncomeYen: 0 }),
      expect.objectContaining({ key: "2026-07-02", totalExpenseYen: 0, totalIncomeYen: 0 }),
      expect.objectContaining({ key: "2026-07-03", totalExpenseYen: 0, totalIncomeYen: 0 }),
    ]);
  });

  it("前期間を計算し、増減とカテゴリ変化を返す", () => {
    expect(calculatePreviousHistoryPeriod("2026-07-01", "2026-07-31")).toEqual({
      startDate: "2026-05-31",
      endDate: "2026-06-30",
    });

    const current = summarizeHistoryGroups(
      groupHistoryEntries(
        [expense("current", "2026-07-05", 1200)],
        [income("income", "2026-07-06", 3000)],
      ),
      categoryInfo,
    );
    const previous = summarizeHistoryGroups(
      groupHistoryEntries([expense("previous", "2026-06-05", 800, "food")], []),
      categoryInfo,
    );
    const comparison = buildHistoryComparison({
      current,
      currentStartDate: "2026-07-01",
      currentEndDate: "2026-07-31",
      previous,
      previousPeriod: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });

    expect(comparison).toMatchObject({
      diffExpenseYen: 400,
      diffIncomeYen: 3000,
      diffNetYen: 2600,
      hasPreviousData: true,
    });
    expect(comparison.categoryChanges[0]).toMatchObject({
      categoryId: "food",
      currentAmountYen: 1200,
      previousAmountYen: 800,
      diffAmountYen: 400,
    });
  });
});
