import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { WeeklySummaryPanel } from "./WeeklySummaryPanel";
import type { FourWeeksSummaryData } from "../../convex/receipts";

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
        budgetAmountYen={10000}
        byCategory={[
          {
            categoryId: "cat-food",
            categoryName: "食費",
            categoryColor: "#2563EB",
            totalAmountYen: 4280,
            count: 1,
          },
          {
            categoryId: "cat-daily",
            categoryName: "日用品",
            categoryColor: "#16A34A",
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
            categoryColor: "#2563EB",
          },
          {
            _id: "receipt-2",
            date: "2026-05-19",
            shopName: "ドラッグストア南",
            amountYen: 2000,
            categoryId: "cat-daily",
            categoryName: "日用品",
            categoryColor: "#16A34A",
          },
        ]}
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

  it("weeklyTrendDataが2週以上あるときグラフが表示される", () => {
    // Given: 直近4週のデータがある
    const weeklyTrendData: FourWeeksSummaryData = {
      weeks: [
        { weekStartDate: "2024-01-01", totalAmountYen: 3000 },
        { weekStartDate: "2024-01-08", totalAmountYen: 5000 },
        { weekStartDate: "2024-01-15", totalAmountYen: 2000 },
        { weekStartDate: "2024-01-22", totalAmountYen: 8000 },
      ],
      weekCount: 4,
    };
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weeklyTrendData={weeklyTrendData}
      />,
    );

    // When: 週次サマリーを確認する
    // Then: 週別支出推移グラフが表示される
    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("weeklyTrendDataが1週以下のときプレースホルダーが表示される", () => {
    const weeklyTrendData: FourWeeksSummaryData = {
      weeks: [{ weekStartDate: "2024-01-08", totalAmountYen: 1000 }],
      weekCount: 1,
    };
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weeklyTrendData={weeklyTrendData}
      />,
    );

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("weeklyTrendDataがnullのときグラフセクションが表示されない（クエリskip中）", () => {
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weeklyTrendData={null}
      />,
    );

    expect(screen.queryByRole("heading", { name: "週別支出推移" })).not.toBeInTheDocument();
  });

  it("weeklyTrendDataがundefinedのときSkeletonつきでグラフセクションが表示される（ロード中）", () => {
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
        weeklyTrendData={undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  // 振り返りメモ表示・編集は ReviewMemoPanel に移譲し、SummaryPage でレンダリングする。
  // WeeklySummaryPanel は振り返りメモセクションを持たないため、このテストは削除。
});
