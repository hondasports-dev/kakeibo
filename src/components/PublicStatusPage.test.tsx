import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { PublicStatusPage } from "./PublicStatusPage";

describe("PublicStatusPage", () => {
  it("ラベル・タイトル・説明・アクションを表示する", () => {
    renderWithProviders(
      <PublicStatusPage
        brandImage={{ alt: "Suzumemo", src: "/suzumemo-app-icon.png" }}
        description="説明文です。"
        label="404 Not Found"
        primaryAction={{ label: "ホームへ戻る", href: "/" }}
        secondaryActions={[
          { label: "プライバシーポリシー", href: "/privacy" },
          { label: "利用規約", href: "/terms" },
        ]}
        title="ページが見つかりません"
      />,
    );

    expect(screen.getByText("404 Not Found")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suzumemo" })).toHaveAttribute(
      "src",
      "/suzumemo-app-icon.png",
    );
    expect(screen.getByRole("heading", { name: "ページが見つかりません" })).toBeInTheDocument();
    expect(screen.getByText("説明文です。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ホームへ戻る" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  });

  it("ボタンアクションを実行できる", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PublicStatusPage
        description="説明文です。"
        label="Application Error"
        primaryAction={{ label: "再読み込み", onClick }}
        title="問題が発生しました"
      />,
    );

    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onClick).toHaveBeenCalled();
  });
});
