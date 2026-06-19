import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { GroupSettingsPanel } from "./GroupSettingsPanel";

const {
  inviteMemberMock,
  removeMemberMock,
  setActiveGroupMock,
  useActionMock,
  useAuthMock,
  useMutationMock,
  useQueryMock,
  useUserMock,
} = vi.hoisted(() => ({
  inviteMemberMock: vi.fn(),
  removeMemberMock: vi.fn(),
  setActiveGroupMock: vi.fn(),
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

vi.mock("../../convex/_generated/api", () => ({
  api: {
    groupInvitations: {
      inviteMember: "groupInvitations.inviteMember",
    },
    groups: {
      getGroupMembers: "groups.getGroupMembers",
      getMyGroup: "groups.getMyGroup",
      listMyGroups: "groups.listMyGroups",
      removeMember: "groups.removeMember",
      setActiveGroup: "groups.setActiveGroup",
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
    inviteMemberMock.mockReset();
    removeMemberMock.mockReset();
    setActiveGroupMock.mockReset();
    useActionMock.mockReset();
    useAuthMock.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReset();
    useUserMock.mockReset();

    inviteMemberMock.mockResolvedValue({
      token: "invite-token",
      clerkInvitationId: "clerk-invite-001",
      clerkOrganizationId: "org-001",
    });
    setActiveGroupMock.mockResolvedValue("group-002");
    removeMemberMock.mockResolvedValue(undefined);
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
      return vi.fn();
    });
    useMutationMock.mockImplementation((reference: string) => {
      if (reference.includes("groups.setActiveGroup")) return setActiveGroupMock;
      if (reference.includes("groups.removeMember")) return removeMemberMock;
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

    expect(screen.getByLabelText("グループ名")).toHaveValue("佐藤家");
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

    const sectionTitles = ["グループ情報", "メンバー管理", "招待管理", "危険な操作"];
    for (const title of sectionTitles) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }

    expect(screen.getByTestId("group-info-section")).toBeInTheDocument();
    expect(screen.getByTestId("member-management-section")).toBeInTheDocument();
    expect(screen.getByTestId("invite-management-section")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone-section")).toBeInTheDocument();
    expect(screen.getByLabelText("グループ名")).toBeInTheDocument();
    expect(screen.getByTestId("pending-invites-placeholder")).toBeInTheDocument();
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
    expect(screen.queryByRole("heading", { level: 3, name: "危険な操作" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "招待するメールアドレス" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("招待と削除はオーナーのみ操作できます。")).toBeInTheDocument();
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
});
