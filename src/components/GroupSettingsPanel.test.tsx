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
  useMutationMock,
  useQueryMock,
} = vi.hoisted(() => ({
  inviteMemberMock: vi.fn(),
  removeMemberMock: vi.fn(),
  setActiveGroupMock: vi.fn(),
  useActionMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
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
    useMutationMock.mockReset();
    useQueryMock.mockReset();

    inviteMemberMock.mockResolvedValue({
      token: "invite-token",
      clerkInvitationId: "clerk-invite-001",
      clerkOrganizationId: "org-001",
    });
    setActiveGroupMock.mockResolvedValue("group-002");
    removeMemberMock.mockResolvedValue(undefined);
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
            userId: "user-owner",
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

    expect(screen.getByText("佐藤家")).toBeInTheDocument();
    expect(screen.getByText("member@example.com")).toBeInTheDocument();
  });
});
