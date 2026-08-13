import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { MonthlySpendingCalendar } from "./MonthlySpendingCalendar";

describe("MonthlySpendingCalendar", () => {
  it("支出額の濃淡と収入の区別を月間カレンダーへ表示する", () => {
    renderWithProviders(
      <MonthlySpendingCalendar
        expenses={[
          { amountYen: 1000, date: "2026-07-01" },
          { amountYen: 5000, date: "2026-07-15" },
        ]}
        incomes={[{ amountYen: 250000, date: "2026-07-25" }]}
        month="2026-07"
        onDateSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "支出カレンダー" })).toBeInTheDocument();
    expect(screen.getByText("支出額の濃さ")).toBeInTheDocument();
    expect(screen.getByText("収入あり")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /2026年7月1日/ })).toHaveAttribute(
      "data-expense-intensity",
      "1",
    );
    expect(screen.getByRole("button", { name: /2026年7月15日/ })).toHaveAttribute(
      "data-expense-intensity",
      "4",
    );
    expect(screen.getByRole("button", { name: /2026年7月25日/ })).toHaveAttribute(
      "data-has-income",
      "true",
    );
  });

  it("日付を押すと選択コールバックへISO日付を渡す", async () => {
    const user = userEvent.setup();
    const onDateSelect = vi.fn();

    renderWithProviders(
      <MonthlySpendingCalendar
        expenses={[]}
        incomes={[]}
        month="2026-07"
        onDateSelect={onDateSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /2026年7月10日/ }));

    expect(onDateSelect).toHaveBeenCalledWith("2026-07-10");
  });

  it("読み込み中はカレンダーのスケルトンを表示する", () => {
    renderWithProviders(
      <MonthlySpendingCalendar
        expenses={[]}
        incomes={[]}
        isLoading
        month="2026-07"
        onDateSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("monthly-spending-calendar-loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2026年7月10日/ })).not.toBeInTheDocument();
  });
});
