import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SystemAdminActionDialog } from "./SystemAdminActionDialog";

const target = {
  id: "user-document-1",
  userId: "target-user",
  displayName: "対象ユーザー",
  email: "target@example.test",
  activeGroupId: null,
  createdAt: 1,
  updatedAt: 1,
};

describe("SystemAdminActionDialog", () => {
  it("理由を1〜500文字で検証し、正規化した理由を確認する", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SystemAdminActionDialog
        action="grant"
        confirming={false}
        environment="preview"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open
        target={target}
      />,
    );

    const reason = screen.getByRole("textbox", { name: "操作理由" });
    expect(screen.getByRole("button", { name: "付与する" })).toBeDisabled();
    await user.type(reason, "  運用を委任  ");
    expect(screen.getByRole("button", { name: "付与する" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "付与する" }));
    expect(onConfirm).toHaveBeenCalledWith("運用を委任");
  });

  it("501文字では送信できない", () => {
    render(
      <SystemAdminActionDialog
        action="revoke"
        confirming={false}
        environment="preview"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
        target={target}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "操作理由" }), {
      target: { value: "x".repeat(501) },
    });
    expect(screen.getByRole("button", { name: "剥奪する" })).toBeDisabled();
    expect(screen.getByText("理由は1〜500文字で入力してください")).toBeInTheDocument();
  });
});
