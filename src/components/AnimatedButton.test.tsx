import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnimatedButton } from "./AnimatedButton";

describe("AnimatedButton", () => {
  it("子要素をレンダリングすること", () => {
    render(<AnimatedButton>クリックして</AnimatedButton>);

    expect(screen.getByText("クリックして")).toBeInTheDocument();
  });

  it("クリック時にonClickハンドラを呼び出すこと", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<AnimatedButton onClick={handleClick}>クリック</AnimatedButton>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disabled時にクリックを無効化すること", () => {
    const handleClick = vi.fn();

    render(
      <AnimatedButton disabled onClick={handleClick}>
        無効
      </AnimatedButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("disabled");
  });

  it("loading時にローディング状態を表示すること", () => {
    render(<AnimatedButton loading>保存</AnimatedButton>);

    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("fullWidth時に正しいクラスを持つこと", () => {
    render(<AnimatedButton fullWidth>ボタン</AnimatedButton>);

    expect(screen.getByRole("button")).toHaveClass("MuiButton-fullWidth");
  });
});
