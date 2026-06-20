import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { GroupSettingsPanel } from "./GroupSettingsPanel";

const {
  cancelPendingGroupInvitationMock,
  changeMemberRoleMock,
  inviteMemberMock,
  removeMemberMock,
  setActiveGroupMock,
  updateGroupNameMock,
  useActionMock,
  useAuthMock,
  useMutationMock,
  useQueryMock,
  useUserMock,
} = vi.hoisted(() => ({
  cancelPendingGroupInvitationMock: vi.fn(),
  changeMemberRoleMock: vi.fn(),
  inviteMemberMock: vi.fn(),
  removeMemberMock: vi.fn(),
  setActiveGroupMock: vi.fn(),
  updateGroupNameMock: vi.fn(),
  useActionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useUserMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useAuth: useAuthMock,
  useUser: useUserMock,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    groupInvitations: {
      cancelPendingGroupInvitation: "groupInvitations.cancelPendingGroupInvitation",
      inviteMember: "groupInvitations.inviteMember",
    },
    groups: {
      getGroupMembers: "groups.getGroupMembers",
      getMyGroup: "groups.getMyGroup",
      listMyGroups: "groups.listMyGroups",
      listPendingGroupInvitations: "groups.listPendingGroupInvitations",
      removeMember: "groups.removeMember",
      changeMemberRole: "groups.changeMemberRole",
      setActiveGroup: "groups.setActiveGroup",
      updateGroupName: "groups.updateGroupName",
    },
    managementAuditLogs: {
      listManagementAuditLogs: "managementAuditLogs.listManagementAuditLogs",
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

describe("GroupSettingsPanel", () => {
  beforeEach(() => {
    cancelPendingGroupInvitationMock.mockReset();
    changeMemberRoleMock.mockReset();
    inviteMemberMock.mockReset();
    removeMemberMock.mockReset();
    setActiveGroupMock.mockReset();
    updateGroupNameMock.mockReset();
    useActionMock.mockReset();
    useAuthMock.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReset();
    useUserMock.mockReset();

    cancelPendingGroupInvitationMock.mockResolvedValue(null);
    inviteMemberMock.mockResolvedValue({
      token: "invite-token",
      clerkInvitationId: "clerk-invite-001",
      clerkOrganizationId: "org-001",
    });
    setActiveGroupMock.mockResolvedValue("group-002");
    removeMemberMock.mockResolvedValue(undefined);
    changeMemberRoleMock.mockResolvedValue(undefined);
    updateGroupNameMock.mockResolvedValue("group-001");
    useAuthMock.mockReturnValue({ userId: "owner-clerk-id" });
    useUserMock.mockReturnValue({
      user: {
        fullName: "ログイン 太郎",
        username: "login-taro",
        firstName: "ログイン",
        lastName: "太郎",
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      },
    });
    useActionMock.mockImplementation((reference: string) => {
      if (reference.includes("groupInvitations.inviteMember")) return inviteMemberMock;
      if (reference.includes("groupInvitations.cancelPendingGroupInvitation")) {
        return cancelPendingGroupInvitationMock;
      }
      return vi.fn();
    });
    useMutationMock.mockImplementation((reference: string) => {
      if (reference.includes("groups.setActiveGroup")) return setActiveGroupMock;
      if (reference.includes("groups.removeMember")) return removeMemberMock;
      if (reference.includes("groups.changeMemberRole")) return changeMemberRoleMock;
      if (reference.includes("groups.updateGroupName")) return updateGroupNameMock;
      return vi.fn();
    });
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [
          { _id: "group-001", name: "佐藤家", role: "owner", isActive: true },
          { _id: "group-002", name: "鈴木家", role: "member", isActive: false },
        ];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
          {
            userId: "user-member",
            role: "member",
            displayName: "メンバー",
            email: "member@example.com",
            createdAt: 1000,
          },
        ];
      }
      if (
        typeof reference === "string" &&
        reference.includes("groups.listPendingGroupInvitations")
      ) {
        return [
          {
            _id: "invite-001",
            email: "pending@example.com",
            status: "pending",
            createdAt: Date.UTC(2026, 0, 15, 3, 30),
          },
        ];
      }
      if (
        typeof reference === "string" &&
        reference.includes("managementAuditLogs.listManagementAuditLogs")
      ) {
        return [
          {
            _id: "log-001",
            action: "group_name_changed",
            actionLabel: "グループ名を変更",
            actorDisplayName: "オーナー",
            targetLabel: "佐藤家",
            beforeValue: "佐藤家",
            afterValue: "鈴木家",
            createdAt: Date.UTC(2026, 0, 10, 12, 0),
          },
        ];
      }
      return [];
    });
  });

  it("複数グループがあると切替 UI を表示する", () => {
    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByRole("heading", { name: "グループ管理", level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("現在のグループ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切り替え" })).toBeInTheDocument();
  });

  it("メールアドレスを入力して招待を送れる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupSettingsPanel />);

    await user.type(
      screen.getByRole("textbox", { name: "招待するメールアドレス" }),
      "member@example.com",
    );
    await user.click(screen.getByRole("button", { name: "招待を送る" }));

    await waitFor(() => {
      expect(inviteMemberMock).toHaveBeenCalledWith({
        email: "member@example.com",
        redirectUrl: expect.stringContaining("/group/invitations/accept"),
      });
    });
  });

  it("現在のグループとメンバー一覧を表示する", () => {
    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByLabelText("現在のグループ")).toBeInTheDocument();
    expect(screen.getByText("ログイン 太郎")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("あなた")).toBeInTheDocument();
    expect(screen.getAllByText("オーナー").length).toBeGreaterThan(0);
    expect(screen.getAllByText("メンバー").length).toBeGreaterThan(0);
    expect(screen.getByText("member@example.com")).toBeInTheDocument();
  });

  it("ログイン中ユーザーの fullName がない場合は username を表示する", () => {
    useUserMock.mockReturnValue({
      user: {
        fullName: null,
        username: "friendly-owner",
        firstName: "名",
        lastName: "姓",
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      },
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByText("friendly-owner")).toBeInTheDocument();
    expect(screen.queryByText("名 姓")).not.toBeInTheDocument();
  });

  it("ログイン中ユーザーの username がない場合は firstName と lastName を結合して表示する", () => {
    useUserMock.mockReturnValue({
      user: {
        fullName: null,
        username: null,
        firstName: "名",
        lastName: "姓",
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      },
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByText("名 姓")).toBeInTheDocument();
  });

  it("表示名が未設定ならメールアドレスを主表示に使う", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "owner", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "user-member",
            role: "member",
            displayName: "ユーザー",
            email: "member@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByText("member@example.com")).toBeInTheDocument();
    expect(screen.getByText("メール登録済み")).toBeInTheDocument();
  });

  it("オーナー向けにグループ管理の各セクションを順序どおり表示する", () => {
    renderWithProviders(<GroupSettingsPanel />);

    const sectionTitles = [
      "グループ情報",
      "メンバー管理",
      "招待管理",
      "管理操作ログ",
      "危険な操作",
    ];
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual(sectionTitles);

    expect(screen.getByTestId("group-info-section")).toBeInTheDocument();
    expect(screen.getByTestId("member-management-section")).toBeInTheDocument();
    expect(screen.getByTestId("invite-management-section")).toBeInTheDocument();
    expect(screen.getByTestId("management-audit-log-section")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone-section")).toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    expect(screen.getByTestId("group-pending-invitation-list")).toBeInTheDocument();
    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
    expect(screen.getByText("招待中")).toBeInTheDocument();
    expect(screen.getByText("グループ名を変更")).toBeInTheDocument();
    expect(screen.getByText("佐藤家 → 鈴木家")).toBeInTheDocument();
    expect(
      screen.getByText("以下の操作は今後のアップデートで追加予定です。現在は実行できません。"),
    ).toBeInTheDocument();
  });

  it("pending 招待がない場合は空状態を表示する", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "owner", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
        ];
      }
      if (
        typeof reference === "string" &&
        reference.includes("groups.listPendingGroupInvitations")
      ) {
        return [];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByTestId("group-pending-invitation-list-empty")).toHaveTextContent(
      "送信済みの招待はありません。",
    );
  });

  it("単一グループのオーナーはグループ名変更フォームを表示する", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "owner", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByLabelText("グループ名")).toHaveValue("佐藤家");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.queryByLabelText("現在のグループ")).not.toBeInTheDocument();
  });

  it("単一グループのオーナーはグループ名を保存できる", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "owner", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    const nameInput = screen.getByLabelText("グループ名");
    fireEvent.change(nameInput, { target: { value: "鈴木家" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateGroupNameMock).toHaveBeenCalledWith({ name: "鈴木家" });
    });
    expect(screen.getByText("グループ名を更新しました")).toBeInTheDocument();
  });

  it("グループ名が空のときは保存せずエラーを表示する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "owner",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "owner", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    const nameInput = screen.getByLabelText("グループ名");
    fireEvent.change(nameInput, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByText("グループ名を入力してください。")).toBeInTheDocument();
    expect(updateGroupNameMock).not.toHaveBeenCalled();
  });

  it("単一グループのメンバーはグループ名テキストを表示する", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "member",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "member", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByText("佐藤家")).toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
  });

  it("複数グループのオーナーはグループ名変更フォームを表示しない", () => {
    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByLabelText("現在のグループ")).toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
  });

  it("セクション見出しは aria-labelledby で関連付けられる", () => {
    renderWithProviders(<GroupSettingsPanel />);

    const groupInfoSection = screen.getByTestId("group-info-section");
    expect(groupInfoSection).toHaveAttribute("aria-labelledby", "group-info-section-heading");
    expect(screen.getByRole("heading", { level: 3, name: "グループ情報" })).toHaveAttribute(
      "id",
      "group-info-section-heading",
    );
  });

  it("メンバーには招待管理と危険な操作セクションを表示しない", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (typeof reference === "string" && reference.includes("groups.getMyGroup")) {
        return {
          _id: "group-001",
          name: "佐藤家",
          role: "member",
          createdAt: 1000,
        };
      }
      if (typeof reference === "string" && reference.includes("groups.listMyGroups")) {
        return [{ _id: "group-001", name: "佐藤家", role: "member", isActive: true }];
      }
      if (typeof reference === "string" && reference.includes("groups.getGroupMembers")) {
        return [
          {
            userId: "https://issuer.example|owner-clerk-id",
            role: "owner",
            displayName: "オーナー",
            email: "owner@example.com",
            createdAt: 1000,
          },
          {
            userId: "user-member",
            role: "member",
            displayName: "メンバー",
            email: "member@example.com",
            createdAt: 1000,
          },
        ];
      }
      return [];
    });

    renderWithProviders(<GroupSettingsPanel />);

    expect(screen.getByRole("heading", { level: 3, name: "グループ情報" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "メンバー管理" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "招待管理" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 3, name: "管理操作ログ" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "危険な操作" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "招待するメールアドレス" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("招待と削除はオーナーのみ操作できます。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /をグループから外す/ })).not.toBeInTheDocument();
  });

  it("メンバー削除前に確認ダイアログを表示し、確定後に mutation を呼ぶ", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupSettingsPanel />);

    await user.click(screen.getByRole("button", { name: "メンバーをグループから外す" }));

    expect(
      screen.getByRole("heading", { name: "メンバーをグループから外しますか？" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Clerk アカウント自体は削除されず/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "グループから外す" }));

    await waitFor(() => {
      expect(removeMemberMock).toHaveBeenCalledWith({ targetUserId: "user-member" });
    });
  });

  it("ロール変更前に確認ダイアログを表示し、確定後に mutation を呼ぶ", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupSettingsPanel />);

    await user.click(
      within(screen.getByTestId("group-member-role-select-user-member")).getByRole("combobox"),
    );
    await user.click(await screen.findByRole("option", { name: "オーナー" }));

    expect(
      screen.getByRole("heading", { name: "メンバーのロールを変更しますか？" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/「メンバー」から「オーナー」/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ロールを変更する" }));

    await waitFor(() => {
      expect(changeMemberRoleMock).toHaveBeenCalledWith({
        targetUserId: "user-member",
        newRole: "owner",
      });
    });
  });

  it("招待取り消し前に確認ダイアログを表示し、確定後に action を呼ぶ", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupSettingsPanel />);

    await user.click(screen.getByRole("button", { name: "pending@example.comへの招待を取り消す" }));

    expect(screen.getByRole("heading", { name: "招待を取り消しますか？" })).toBeInTheDocument();
    expect(screen.getByText(/招待リンクは無効になり/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "招待を取り消す" }));

    await waitFor(() => {
      expect(cancelPendingGroupInvitationMock).toHaveBeenCalledWith({
        invitationId: "invite-001",
      });
    });
  });
});
