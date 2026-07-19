import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemAdminAuthState } from "./SystemAdminAuthState";

describe("SystemAdminAuthState", () => {
  it("RouterLink への遷移アクションを表示する", () => {
    render(
      <MemoryRouter>
        <SystemAdminAuthState
          action={{ label: "戻る", to: "/" }}
          severity="warning"
          title="利用できません"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "利用できません" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "戻る" })).toBeInTheDocument();
  });

  it("onClick アクションを表示して呼び出せる", () => {
    const onClick = vi.fn();
    render(
      <SystemAdminAuthState
        action={{ label: "再読み込み", onClick }}
        message="詳細メッセージ"
        severity="error"
        title="エラー"
      />,
    );

    expect(screen.getByText("詳細メッセージ")).toBeInTheDocument();
    screen.getByRole("button", { name: "再読み込み" }).click();
    expect(onClick).toHaveBeenCalled();
  });
});
