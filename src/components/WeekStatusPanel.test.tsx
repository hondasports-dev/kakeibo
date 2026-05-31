import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { WeekStatusPanel } from "./WeekStatusPanel";

describe("WeekStatusPanel", () => {
  it("入力進捗と直近入力を表示し、予算情報は表示しない", () => {
    renderWithProviders(
      <WeekStatusPanel
        budgetAmountYen={10000}
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
});
