import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { MaintenancePage } from "./MaintenancePage";

describe("MaintenancePage", () => {
  it("メンテナンス文言と復帰導線を表示する", () => {
    renderWithProviders(<MaintenancePage />);

    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suzumemo スズメモ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ただいまメンテナンス中です" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Suzumemo を安心して使えるように、ただいま整えています。しばらく時間をおいてから、もう一度お試しください。/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  });
});
