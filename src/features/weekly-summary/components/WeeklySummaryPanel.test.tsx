import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeeklySummaryPanel } from "./WeeklySummaryPanel";
import type { DailySpendingTrendData } from "../../../../convex/receipts";

describe("WeeklySummaryPanel", () => {
  it("レシート0件では空状態を表示し、予算情報は表示しない", () => {
    // Given: 今週のレシートがまだ登録されていない
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weekStartDate="2024-01-08"
      />,
    );

    // When: 週次サマリーを確認する
    // Then: 空状態が表示され、予算情報は表示されない
    // AnimatedCounter導入後はテキストがspanに分かれるため、aria-live属性で確認（複数あるのでgetAllByText）
    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.parentElement?.getAttribute("aria-live") === "polite" && content.includes("0")
        );
      }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("未設定")).not.toBeInTheDocument();
    expect(screen.queryByText("予算")).not.toBeInTheDocument();
    expect(screen.getAllByText("まだレシートがありません")).toHaveLength(2);
  });

  it("複数レシートの合計、カテゴリ別、前週比、支出一覧を表示する", async () => {
    // Given: カテゴリ別に集計済みのレシートがある
    renderWithProviders(
      <WeeklySummaryPanel
        count={2}
        totalAmountYen={6280}
        byCategory={[
          {
            categoryId: "cat-food",
            categoryName: "食費",
            categoryColor: "#AAB7C4",
            totalAmountYen: 4280,
            count: 1,
          },
          {
            categoryId: "cat-daily",
            categoryName: "日用品",
            categoryColor: "#A6B28B",
            totalAmountYen: 2000,
            count: 1,
          },
        ]}
        prevWeekTotalAmountYen={7000}
        receipts={[
          {
            _id: "receipt-1",
            date: "2026-05-18",
            shopName: "スーパー北浜",
            amountYen: 4280,
            categoryId: "cat-food",
            categoryName: "食費",
            categoryColor: "#AAB7C4",
          },
          {
            _id: "receipt-2",
            date: "2026-05-19",
            shopName: "ドラッグストア南",
            amountYen: 2000,
            categoryId: "cat-daily",
            categoryName: "日用品",
            categoryColor: "#A6B28B",
          },
        ]}
        weekStartDate="2026-05-13"
      />,
    );

    // When: 週次サマリーを確認する
    // Then: 合計・カテゴリ別・支出一覧が表示され、予算情報は表示されない
    // 合計支出ラベルとアニメーションコンテナの存在を確認
    expect(screen.getByText("合計支出")).toBeInTheDocument();
    expect(
      screen.getAllByText((_content, element) => {
        return element?.parentElement?.getAttribute("aria-live") === "polite";
      }).length,
    ).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(
        screen.getByText((_content, element) => {
          return (
            element?.getAttribute("aria-live") === "polite" &&
            element.textContent?.includes("6,280円") === true
          );
        }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/10,000円 中 63% 消化/)).not.toBeInTheDocument();
    expect(screen.queryByText(/中 63% 消化/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("予算消化率")).not.toBeInTheDocument();
    expect(screen.getByText("-720円")).toBeInTheDocument();
    expect(screen.getByText("スーパー北浜")).toBeInTheDocument();
    expect(screen.getByText("ドラッグストア南")).toBeInTheDocument();
    expect(screen.getAllByText("食費")).toHaveLength(2);
    expect(screen.getAllByText("日用品")).toHaveLength(2);
  });

  it("dailySpendingTrendがデータを含むときグラフが表示される", () => {
    // Given: 今週と前週の日別データがある
    const dailySpendingTrend: DailySpendingTrendData = {
      currentWeek: [
        { date: "2024-01-08", totalAmountYen: 1000 },
        { date: "2024-01-09", totalAmountYen: 2000 },
        { date: "2024-01-10", totalAmountYen: 0 },
        { date: "2024-01-11", totalAmountYen: 500 },
        { date: "2024-01-12", totalAmountYen: 0 },
        { date: "2024-01-13", totalAmountYen: 3000 },
        { date: "2024-01-14", totalAmountYen: 0 },
      ],
      previousWeek: [
        { date: "2024-01-01", totalAmountYen: 500 },
        { date: "2024-01-02", totalAmountYen: 1500 },
        { date: "2024-01-03", totalAmountYen: 0 },
        { date: "2024-01-04", totalAmountYen: 2000 },
        { date: "2024-01-05", totalAmountYen: 0 },
        { date: "2024-01-06", totalAmountYen: 1000 },
        { date: "2024-01-07", totalAmountYen: 0 },
      ],
    };
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weekStartDate="2024-01-08"
        dailySpendingTrend={dailySpendingTrend}
      />,
    );

    // When: 週次サマリーを確認する
    // Then: 週別支出推移グラフが表示される
    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("dailySpendingTrendが空のときプレースホルダーが表示される", () => {
    const dailySpendingTrend: DailySpendingTrendData = {
      currentWeek: [
        { date: "2024-01-08", totalAmountYen: 0 },
        { date: "2024-01-09", totalAmountYen: 0 },
        { date: "2024-01-10", totalAmountYen: 0 },
        { date: "2024-01-11", totalAmountYen: 0 },
        { date: "2024-01-12", totalAmountYen: 0 },
        { date: "2024-01-13", totalAmountYen: 0 },
        { date: "2024-01-14", totalAmountYen: 0 },
      ],
      previousWeek: [
        { date: "2024-01-01", totalAmountYen: 0 },
        { date: "2024-01-02", totalAmountYen: 0 },
        { date: "2024-01-03", totalAmountYen: 0 },
        { date: "2024-01-04", totalAmountYen: 0 },
        { date: "2024-01-05", totalAmountYen: 0 },
        { date: "2024-01-06", totalAmountYen: 0 },
        { date: "2024-01-07", totalAmountYen: 0 },
      ],
    };
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weekStartDate="2024-01-08"
        dailySpendingTrend={dailySpendingTrend}
      />,
    );

    expect(screen.getByText("今週または前週の支出データがあると表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("dailySpendingTrendがnullのときグラフセクションが表示されない（クエリskip中）", () => {
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weekStartDate="2024-01-08"
        dailySpendingTrend={null}
      />,
    );

    expect(screen.queryByRole("heading", { name: "週別支出推移" })).not.toBeInTheDocument();
  });

  it("dailySpendingTrendがundefinedのときSkeletonつきでグラフセクションが表示される（ロード中）", () => {
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weekStartDate="2024-01-08"
        dailySpendingTrend={undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("支出と収入の種別が判別できる", () => {
    renderWithProviders(
      <WeeklySummaryPanel
        count={2}
        totalAmountYen={304280}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[
          {
            _id: "expense-1",
            date: "2026-05-18",
            type: "expense",
            shopName: "スーパー北浜",
            amountYen: 4280,
            categoryId: "cat-food",
            categoryName: "食費",
            categoryColor: "#AAB7C4",
          },
          {
            _id: "income-1",
            date: "2026-05-18",
            type: "income",
            bankName: "三菱UFJ銀行",
            amountYen: 300000,
            categoryId: "cat-income",
            categoryName: "給与",
            categoryColor: "#F4A27A",
          },
        ]}
        weekStartDate="2026-05-13"
      />,
    );

    expect(screen.getByText("支出")).toBeInTheDocument();
    expect(screen.getByText("収入")).toBeInTheDocument();
  });

  // 振り返りメモ表示・編集は ReviewMemoPanel に移譲し、SummaryPage でレンダリングする。
  // WeeklySummaryPanel は振り返りメモセクションを持たないため、このテストは削除。
});
