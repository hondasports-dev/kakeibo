import { api } from "../../../../convex/_generated/api";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock, useMutationMock, useQueryMock } = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

import { SystemAdminManagementPage } from "./SystemAdminManagementPage";

describe("SystemAdminManagementPage", () => {
  const actionMock = vi.fn();
  const grantMock = vi.fn();
  const revokeMock = vi.fn();

  beforeEach(() => {
    actionMock.mockResolvedValue({
      page: [
        {
          id: "target-doc",
          userId: "target-user",
          displayName: "対象ユーザー",
          email: "target@example.test",
          activeGroupId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    useActionMock.mockReturnValue(actionMock);
    useMutationMock.mockImplementation((reference: unknown) =>
      reference === api.systemAdmins.revokeSystemAdmin ? revokeMock : grantMock,
    );
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === api.systemAdmins.getMySystemAdminContext) {
        return { status: "active", environment: "preview", userId: "owner-doc" };
      }
      return {
        page: [
          {
            id: "admin-doc",
            targetUserId: "owner-doc",
            displayName: "管理者",
            email: "owner@example.test",
            status: "active",
            grantedAt: 1,
            createdAt: 1,
            updatedAt: 1,
            isSelf: true,
          },
        ],
        isDone: true,
        continueCursor: "",
      };
    });
  });

  it("既存ユーザー候補を選び、理由付き付与を実行できる", async () => {
    const user = userEvent.setup();
    render(<SystemAdminManagementPage />);
    await user.type(screen.getByRole("textbox", { name: "付与対象を検索" }), "対象");
    await user.click(screen.getByRole("button", { name: "候補を検索" }));
    await user.click(await screen.findByRole("button", { name: "このユーザーを付与" }));
    await user.type(screen.getByRole("textbox", { name: "操作理由" }), "運用委任");
    await user.click(screen.getByRole("button", { name: "付与する" }));
    expect(grantMock).toHaveBeenCalledWith({ targetUserId: "target-doc", reason: "運用委任" });
  });

  it("検索条件が未入力でも付与候補を検索する", async () => {
    const user = userEvent.setup();
    render(<SystemAdminManagementPage />);

    expect(screen.getByRole("button", { name: "候補を検索" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "候補を検索" }));

    expect(await screen.findByText("対象ユーザー")).toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledWith({
      queryType: "displayName",
      query: "",
      paginationOpts: { numItems: 10, cursor: null },
    });
  });

  it("自分自身の剥奪を常時無効化する", () => {
    render(<SystemAdminManagementPage />);
    expect(screen.getByRole("button", { name: "剥奪" })).toBeDisabled();
    expect(screen.getByText("自分自身は剥奪できません。")).toBeInTheDocument();
  });
});
