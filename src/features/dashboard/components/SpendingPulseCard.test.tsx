import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpendingPulseCard } from "./SpendingPulseCard";

const pulse = {
  activeDayCount: 2,
  days: [
    { amountYen: 2000, date: "2026-06-15", isFuture: false, isToday: false, label: "月" },
    { amountYen: 0, date: "2026-06-16", isFuture: false, isToday: false, label: "火" },
    { amountYen: 2500, date: "2026-06-17", isFuture: false, isToday: true, label: "水" },
    { amountYen: 0, date: "2026-06-18", isFuture: true, isToday: false, label: "木" },
    { amountYen: 0, date: "2026-06-19", isFuture: true, isToday: false, label: "金" },
    { amountYen: 0, date: "2026-06-20", isFuture: true, isToday: false, label: "土" },
    { amountYen: 0, date: "2026-06-21", isFuture: true, isToday: false, label: "日" },
  ],
  maxAmountYen: 2500,
  totalAmountYen: 4500,
};

describe("SpendingPulseCard", () => {
  it("曜日別の支出と今週の合計を表示する", () => {
    render(<SpendingPulseCard pulse={pulse} />);

    expect(screen.getByRole("heading", { name: "曜日別の支出リズム" })).toBeInTheDocument();
    expect(screen.getByText("支出のある日 2日")).toBeInTheDocument();
    expect(screen.getByText("週合計 4,500円")).toBeInTheDocument();
    expect(screen.getByLabelText("6/17（水）、2,500円、今日")).toBeInTheDocument();
  });

  it("データがない場合は入力を促す", () => {
    render(
      <SpendingPulseCard
        pulse={{
          ...pulse,
          activeDayCount: 0,
          days: pulse.days.map((day) => ({ ...day, amountYen: 0 })),
          maxAmountYen: 0,
          totalAmountYen: 0,
        }}
      />,
    );

    expect(
      screen.getByText("入力すると、曜日ごとの支出リズムが見えてきます。"),
    ).toBeInTheDocument();
  });
});
