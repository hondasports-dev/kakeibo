import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { AppErrorBoundary } from "./AppErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("test render error");
  }
  return <div>正常表示</div>;
}

describe("AppErrorBoundary", () => {
  it("子コンポーネントが正常ならそのまま表示する", () => {
    renderWithProviders(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("正常表示")).toBeInTheDocument();
  });

  it("予期しない例外時にエラー画面を表示する", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Application Error")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "問題が発生しました" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /画面の表示中にエラーが発生しました。再読み込みしても直らない場合は、時間をおいてもう一度お試しください。/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ホームへ戻る" })).toBeInTheDocument();
  });

  it("再読み込みボタンでページをリロードする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });

    const user = userEvent.setup();
    renderWithProviders(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow />
      </AppErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reloadMock).toHaveBeenCalled();
  });
});
