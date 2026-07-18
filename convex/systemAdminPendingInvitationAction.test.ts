import { describe, expect, it, vi } from "vitest";
import { systemAdminPendingInvitationRevokeHandler } from "./systemAdminPendingInvitationAction";
import type { Id } from "./_generated/dataModel";

const groupId = "group-1" as Id<"groups">;
const invitationId = "invitation-1" as Id<"groupInvitations">;

describe("systemAdminPendingInvitationRevokeHandler", () => {
  it("Clerk revoke失敗時はConvex確定を呼ばずfailure監査を要求する", async () => {
    const runQuery = vi.fn().mockResolvedValue({
      groupId,
      invitationId,
      groupName: "Group",
      email: "invitee@example.test",
      clerkInvitationId: "clerk-invite-1",
      reason: "誤招待",
    });
    const runMutation = vi.fn().mockResolvedValue(null);
    const revokeInvitation = vi.fn().mockRejectedValue(new Error("provider unavailable"));

    await expect(
      systemAdminPendingInvitationRevokeHandler(
        { runQuery, runMutation },
        { groupId, invitationId, reason: "誤招待" },
        { revokeInvitation },
      ),
    ).rejects.toThrow("Clerk招待の取消に失敗しました");
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      groupId,
      invitationId,
      reason: "招待取消の外部連携またはConvex確定に失敗",
    });
  });

  it("Clerk revoke成功後だけConvex確定を呼ぶ", async () => {
    const runQuery = vi.fn().mockResolvedValue({
      groupId,
      invitationId,
      groupName: "Group",
      email: "invitee@example.test",
      clerkInvitationId: "clerk-invite-1",
      reason: "誤招待",
    });
    const runMutation = vi.fn().mockResolvedValue(null);
    const revokeInvitation = vi.fn().mockResolvedValue(undefined);

    await expect(
      systemAdminPendingInvitationRevokeHandler(
        { runQuery, runMutation },
        { groupId, invitationId, reason: "誤招待" },
        { revokeInvitation },
      ),
    ).resolves.toBeNull();
    expect(revokeInvitation).toHaveBeenCalledWith("clerk-invite-1");
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      groupId,
      invitationId,
      expectedClerkInvitationId: "clerk-invite-1",
    });
  });
});
