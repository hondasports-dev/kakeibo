import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { GroupDangerZone } from "./GroupDangerZone";

const { useActionMock, useMutationMock, useQueryMock } = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ userId: "owner-id" }),
  useUser: () => ({ user: { fullName: "オーナー" } }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    groups: {
      auditLogs: { listManagementAuditLogs: "auditLogs" },
      clerkInvitations: {
        cancelPendingGroupInvitation: "cancelInvitation",
        inviteMember: "inviteMember",
      },
      deletion: { deleteGroup: "deleteGroup", getGroupDeletionPreview: "deletionPreview" },
      members: {
        changeMemberRole: "changeRole",
        removeMember: "removeMember",
        transferGroupOwnership: "transferOwnership",
      },
      mutations: { setActiveGroup: "setActiveGroup", updateGroupName: "updateGroupName" },
      queries: {
        getGroupMembers: "members",
        getMyGroup: "group",
        listMyGroups: "groups",
        listPendingGroupInvitations: "invitations",
      },
    },
  },
}));

describe("GroupDangerZone", () => {
  beforeEach(() => {
    useActionMock.mockReturnValue(vi.fn().mockResolvedValue(undefined));
    useMutationMock.mockReturnValue(vi.fn().mockResolvedValue(undefined));
    useQueryMock.mockImplementation((reference: string, args?: unknown) => {
      if (args === "skip") return undefined;
      if (reference === "group") return { _id: "group-1", name: "わが家", role: "owner" };
      if (reference === "groups") {
        return [{ _id: "group-1", name: "わが家", role: "owner", isActive: true }];
      }
      if (reference === "members") {
        return [
          { userId: "owner-id", role: "owner", displayName: "オーナー", createdAt: 1 },
          { userId: "member-id", role: "member", displayName: "メンバー", createdAt: 2 },
        ];
      }
      return null;
    });
  });

  it("危険な操作を初期状態で折りたたみ、キーボードで展開できる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupDangerZone />);
    const trigger = screen.getByRole("button", { name: "危険な操作" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "メンバーをグループから外す" })).toBeVisible();
  });
});
