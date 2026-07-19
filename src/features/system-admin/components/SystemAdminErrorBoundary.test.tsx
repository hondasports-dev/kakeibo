import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemAdminErrorBoundary } from "./SystemAdminErrorBoundary";
import { SystemAdminErrorState, SystemAdminPageFrame } from "../pages/SystemAdminPageFrame";

function Bomb(): never {
  throw new Error("boom");
}

describe("SystemAdminErrorBoundary", () => {
  it("子コンポーネントでエラーが発生すると renderError でフォールバックを表示する", () => {
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
  });
});
