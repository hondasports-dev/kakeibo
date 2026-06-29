import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SettingsSectionErrorBoundary } from "./SettingsSectionErrorBoundary";

describe("SettingsSectionErrorBoundary", () => {
  it("局所エラーを表示し、再試行できる", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;
    function FlakySection() {
      if (shouldThrow) throw new Error("section failed");
      return <p>設定内容</p>;
    }

    renderWithProviders(
      <SettingsSectionErrorBoundary>
        <FlakySection />
      </SettingsSectionErrorBoundary>,
    );

    expect(screen.getByText("この設定を読み込めませんでした。")).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(screen.getByText("設定内容")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
