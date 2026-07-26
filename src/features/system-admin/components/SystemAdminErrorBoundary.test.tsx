import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemAdminErrorBoundary } from "./SystemAdminErrorBoundary";
import { SystemAdminErrorState, SystemAdminPageFrame } from "../pages/SystemAdminPageFrame";

function Bomb(): never {
  throw new Error("boom");
}

describe("SystemAdminErrorBoundary", () => {
  it("子コンポーネントでエラーが発生すると renderError でフォールバックを表示する", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <SystemAdminErrorBoundary
          label="Test"
          renderError={(retry) => (
            <SystemAdminPageFrame title="テスト">
              <SystemAdminErrorState onRetry={retry} />
            </SystemAdminPageFrame>
          )}
        >
          <Bomb />
        </SystemAdminErrorBoundary>,
      );

      expect(screen.getByRole("heading", { name: "テスト" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
