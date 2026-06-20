import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeekNavigator } from "./WeekNavigator";

describe("WeekNavigator", () => {
  it("今週表示では次の週へ進めない", () => {
    const onPreviousWeek = vi.fn();
    const onNextWeek = vi.fn();

    render(
      <WeekNavigator
        weekStartDate="2026-05-18"
        weekEndDate="2026-05-24"
        isCurrentWeek={true}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
      />,
    );

    expect(screen.getByText("2026年5月18日 - 5月24日")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次の週へ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前の週へ" })).toBeEnabled();
  });

  it("過去週表示では前後週へ移動できる", async () => {
    const user = userEvent.setup();
    const onPreviousWeek = vi.fn();
    const onNextWeek = vi.fn();

    render(
      <WeekNavigator
        weekStartDate="2026-05-11"
        weekEndDate="2026-05-17"
        isCurrentWeek={false}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
      />,
    );

    await user.click(screen.getByRole("button", { name: "前の週へ" }));
    await user.click(screen.getByRole("button", { name: "次の週へ" }));

    expect(onPreviousWeek).toHaveBeenCalledOnce();
    expect(onNextWeek).toHaveBeenCalledOnce();
  });
});
