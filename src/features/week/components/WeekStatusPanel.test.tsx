import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeekStatusPanel } from "./WeekStatusPanel";

describe("WeekStatusPanel", () => {
  it("入力進捗だけを表示し、直近の入力は表示しない", () => {
    renderWithProviders(<WeekStatusPanel count={1} />);

    expect(screen.getByRole("heading", { name: "今週の進捗" })).toBeInTheDocument();
    expect(screen.getByText("1 件")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "直近の入力" })).not.toBeInTheDocument();
    expect(screen.queryByText("スーパー北浜")).not.toBeInTheDocument();
    expect(screen.queryByText("予算消化")).not.toBeInTheDocument();
    expect(screen.queryByText(/10,000円/)).not.toBeInTheDocument();
  });
});
