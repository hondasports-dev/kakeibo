import { readFileSync } from "node:fs";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SuzumemoLoadingLogo } from "./SuzumemoLoadingLogo";
import { SuzumemoLoadingState } from "./SuzumemoLoadingState";

describe("SuzumemoLoadingState", () => {
  it("アニメーション本体を単独で再利用できる", () => {
    renderWithProviders(<SuzumemoLoadingLogo />);

    expect(screen.getByTestId("suzumemo-loading-logo")).toBeInTheDocument();
    expect(screen.getAllByTestId("suzumemo-loading-leaf")).toHaveLength(2);
  });

  it("ページ内の待機状態をアクセシブルに表示する", () => {
    renderWithProviders(
      <SuzumemoLoadingState label="データを読み込み中" message="準備しています。" variant="page" />,
    );

    expect(screen.getByRole("status", { name: "データを読み込み中" })).toHaveClass(
      "suzumemo-loading-state--page",
    );
    expect(screen.getByText("準備しています。")).toBeInTheDocument();
  });

  it("全画面待機状態を半透明オーバーレイで表示する", () => {
    renderWithProviders(
      <SuzumemoLoadingState label="認証中" message="確認しています。" variant="fullscreen" />,
    );

    expect(screen.getByRole("status", { name: "認証中" })).toHaveClass(
      "suzumemo-loading-state--fullscreen",
    );
  });
});

describe("ページ単位のローディング共通化", () => {
  it.each([
    "src/router.tsx",
    "src/features/dashboard/pages/DashboardPage.tsx",
    "src/features/weekly-summary/pages/SummaryPage.tsx",
    "src/features/expense-entry/pages/InputPage.tsx",
    "src/features/group-admin/pages/GroupSelectPage.tsx",
  ])("%s が SuzumemoLoadingState を使う", (path) => {
    expect(readFileSync(path, "utf8")).toContain("<SuzumemoLoadingState");
  });
});
