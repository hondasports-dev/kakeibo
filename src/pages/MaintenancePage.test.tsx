import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { MaintenancePage } from "./MaintenancePage";

describe("MaintenancePage", () => {
  it("メンテナンス文言を表示する", () => {
    renderWithProviders(<MaintenancePage />);

    expect(screen.getByRole("heading", { name: "メンテナンス中です" })).toBeInTheDocument();
    expect(
      screen.getByText(/現在、サービス改善のため一時的に利用を停止しています/),
    ).toBeInTheDocument();
  });
});
