import { describe, expect, it } from "vitest";
import { buildDailySpendingPulse } from "./dailySpendingPulse";

describe("buildDailySpendingPulse", () => {
  it("週内の日付ごとに支出を集計し、未来日を判定する", () => {
    const result = buildDailySpendingPulse({
      receipts: [
        { date: "2026-06-15", amountYen: 1200 },
        { date: "2026-06-15", amountYen: 800 },
        { date: "2026-06-17", amountYen: 2500 },
        { date: "2026-06-22", amountYen: 999 },
      ],
      todayDate: "2026-06-17",
      weekStartDate: "2026-06-15",
    });

    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toMatchObject({
      amountYen: 2000,
      date: "2026-06-15",
      isFuture: false,
      label: "月",
    });
    expect(result.days[1]).toMatchObject({ amountYen: 0, isFuture: false });
    expect(result.days[2]).toMatchObject({ amountYen: 2500, isToday: true });
    expect(result.days[3]).toMatchObject({ amountYen: 0, isFuture: true });
    expect(result.totalAmountYen).toBe(4500);
    expect(result.activeDayCount).toBe(2);
  });

  it("週外の明細を集計に含めない", () => {
    const result = buildDailySpendingPulse({
      receipts: [{ date: "2026-06-14", amountYen: 5000 }],
      todayDate: "2026-06-15",
      weekStartDate: "2026-06-15",
    });

    expect(result.totalAmountYen).toBe(0);
    expect(result.activeDayCount).toBe(0);
    expect(result.days.every((day) => day.amountYen === 0)).toBe(true);
  });
});
