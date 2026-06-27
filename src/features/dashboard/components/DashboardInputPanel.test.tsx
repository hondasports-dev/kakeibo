import type { ComponentProps } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { DashboardInputPanel } from "./DashboardInputPanel";

function renderPanel(props: ComponentProps<typeof DashboardInputPanel>) {
  return renderWithProviders(
    <MemoryRouter>
      <DashboardInputPanel {...props} />
    </MemoryRouter>,
  );
}

describe("DashboardInputPanel", () => {
  it("入力中かつ件数がある場合は入力を再開を表示する", () => {
    renderPanel({ count: 12, status: "draft", weekStartDate: "2026-06-15" });

    expect(screen.getByRole("link", { name: "入力を再開" })).toHaveAttribute(
      "href",
      "/weeks/current/input",
    );
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "12 件入力済み"),
    ).toBeInTheDocument();
  });

  it("件数0の場合は今週の入力を開始を表示する", () => {
    renderPanel({ count: 0, status: "draft", weekStartDate: "2026-06-15" });

    expect(screen.getByRole("link", { name: "今週の入力を開始" })).toBeInTheDocument();
  });

  it("完了済みの場合は今週のサマリーを見るを表示する", () => {
    renderPanel({ count: 12, status: "completed", weekStartDate: "2026-06-15" });

    expect(screen.getByRole("link", { name: "今週のサマリーを見る" })).toHaveAttribute(
      "href",
      "/weeks/2026-06-15",
    );
  });

  it("読み込み中は件数とボタンの代わりにスケルトンを表示する", () => {
    renderPanel({ count: 0, isLoading: true, status: "draft", weekStartDate: "2026-06-15" });

    expect(screen.queryByRole("link", { name: "今週の入力を開始" })).not.toBeInTheDocument();
    expect(screen.queryByText("0 件入力済み")).not.toBeInTheDocument();
  });
});
