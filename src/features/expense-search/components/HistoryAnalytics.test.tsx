import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import type {
  HistoryComparison,
  HistoryTrendPoint,
} from "../../../../lib/domain/expenseSearch/analytics";
import { HistoryCategoryChart } from "./HistoryCategoryChart";
import { HistoryComparisonCard } from "./HistoryComparisonCard";
import { HistoryMetricsPanel } from "./HistoryMetricsPanel";
import { HistoryTrendChart } from "./HistoryTrendChart";

const trend: HistoryTrendPoint[] = [
  {
    key: "2026-08-01",
    startDate: "2026-08-01",
    endDate: "2026-08-01",
    granularity: "day",
    totalExpenseYen: 1200,
    totalIncomeYen: 3000,
    netAmountYen: 1800,
  },
];

const comparison: HistoryComparison = {
  currentStartDate: "2026-08-01",
  currentEndDate: "2026-08-31",
  previousStartDate: "2026-07-01",
  previousEndDate: "2026-07-31",
  current: {
    count: 2,
    expenseCount: 1,
    incomeCount: 1,
    totalExpenseYen: 1200,
    totalIncomeYen: 3000,
    netAmountYen: 1800,
    byCategory: [],
  },
  previous: {
    count: 1,
    expenseCount: 1,
    incomeCount: 0,
    totalExpenseYen: 800,
    totalIncomeYen: 0,
    netAmountYen: -800,
    byCategory: [],
  },
  diffExpenseYen: 400,
  diffIncomeYen: 3000,
  diffNetYen: 2600,
  categoryChanges: [
    {
      categoryId: "food",
      categoryName: "食費",
      categoryColor: "#f97316",
      currentAmountYen: 1200,
      previousAmountYen: 800,
      diffAmountYen: 400,
      diffRatePercent: 50,
    },
  ],
  hasPreviousData: true,
};

describe("履歴検索の分析表示", () => {
  it("件数・支出・収入・差引の指標を表示する", () => {
    renderWithProviders(
      <HistoryMetricsPanel
        expenseCount={2}
        incomeCount={1}
        netAmountYen={1500}
        totalCount={3}
        totalExpenseYen={1500}
        totalIncomeYen={3000}
      />,
    );

    expect(screen.getByLabelText("該当件数")).toHaveTextContent("3件");
    expect(screen.getByLabelText("支出")).toHaveTextContent("1,500円");
    expect(screen.getByLabelText("収入")).toHaveTextContent("3,000円");
    expect(screen.getByLabelText("差引")).toHaveTextContent("+1,500円");
  });

  it("期間推移とカテゴリ別の金額・構成比を表示する", () => {
    renderWithProviders(
      <>
        <HistoryTrendChart points={trend} />
        <HistoryCategoryChart
          categories={[
            {
              categoryId: "food",
              categoryName: "食費",
              categoryColor: "#f97316",
              totalAmountYen: 1200,
              count: 1,
            },
          ]}
        />
      </>,
    );

    expect(screen.getByRole("img", { name: "期間推移グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "カテゴリ別支出グラフ" })).toBeInTheDocument();
    expect(screen.getByText("1,200円（100%）")).toBeInTheDocument();
  });

  it("前期間の増減とカテゴリ増減率を表示する", () => {
    renderWithProviders(<HistoryComparisonCard comparison={comparison} />);

    expect(screen.getByRole("heading", { name: "前期間との比較" })).toBeInTheDocument();
    expect(screen.getByLabelText("支出の増減")).toHaveTextContent("+400円");
    expect(screen.getByText("+400円（+50%）")).toBeInTheDocument();
  });
});
