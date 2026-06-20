import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SettingsPage } from "./SettingsPage";

vi.mock("../components/CategorySettingsPanel", () => ({
  CategorySettingsPanel: () => <div>CategorySettingsPanel</div>,
}));

vi.mock("../../group-admin", () => ({
  GroupSettingsPanel: () => <div>GroupSettingsPanel</div>,
}));

vi.mock("../components/WeekDaySettingsPanel", () => ({
  WeekDaySettingsPanel: () => <div>WeekDaySettingsPanel</div>,
}));

describe("SettingsPage", () => {
  it("h1 見出し「設定」が表示される", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "設定", level: 1 })).toBeInTheDocument();
  });

  it("3つの設定パネルを表示する", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText("GroupSettingsPanel")).toBeInTheDocument();
    expect(screen.getByText("CategorySettingsPanel")).toBeInTheDocument();
    expect(screen.getByText("WeekDaySettingsPanel")).toBeInTheDocument();
  });
});
