import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeekStatusPanel } from "./WeekStatusPanel";

describe("WeekStatusPanel", () => {
  it("入力進捗と直近入力を表示する", () => {
    renderWithProviders(
      <WeekStatusPanel
        receipts={[
          {
            _id: "receipt-1",
            shopName: "スーパー北浜",
            date: "2026-05-18",
            amountYen: 4280,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "今週の進捗" })).toBeInTheDocument();
    expect(screen.getByText("1 件")).toBeInTheDocument();
    expect(screen.getByText("スーパー北浜")).toBeInTheDocument();
    expect(screen.queryByText("予算消化")).not.toBeInTheDocument();
    expect(screen.queryByText(/10,000円/)).not.toBeInTheDocument();
  });

  it("直近の入力に種別、カテゴリ、メモ有無が表示される", () => {
    renderWithProviders(
      <WeekStatusPanel
        receipts={[
          {
            _id: "receipt-1",
            shopName: "スーパー北浜",
            date: "2026-05-18",
            amountYen: 4280,
            type: "expense",
            categoryName: "食費",
            categoryColor: "#AAB7C4",
            memo: "野菜多め",
          },
          {
            _id: "receipt-2",
            bankName: "三菱UFJ銀行",
            date: "2026-05-19",
            amountYen: 300000,
            type: "income",
            categoryName: "給与",
            categoryColor: "#F4A27A",
          },
        ]}
      />,
    );

    expect(screen.getByText("支出")).toBeInTheDocument();
    expect(screen.getByText("収入")).toBeInTheDocument();
    expect(screen.getByText("食費")).toBeInTheDocument();
    expect(screen.getByText("給与")).toBeInTheDocument();
    expect(screen.getByText("メモあり")).toBeInTheDocument();
  });
});
