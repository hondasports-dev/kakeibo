import { type FormEvent, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { GroupPendingInvitationListItem } from "../utils/groupInvitationDisplay";
import { getGroupSettingsErrorMessage } from "./useGroupSettingsFeedback";

type PendingCancelInvitation = {
  invitationId: Id<"groupInvitations">;
  email: string;
};

type UseGroupInviteManagementArgs = {
  cancelPendingGroupInvitation: (args: {
    invitationId: Id<"groupInvitations">;
  }) => Promise<unknown>;
  inviteMember: (args: { email: string; redirectUrl: string }) => Promise<unknown>;
  setError: (error: string) => void;
  setSavingTarget: (target: string | null) => void;
  setSnackbar: (message: string) => void;
  savingTarget: string | null;
};

export function useGroupInviteManagement({
  cancelPendingGroupInvitation,
  inviteMember,
  setError,
  setSavingTarget,
  setSnackbar,
  savingTarget,
}: UseGroupInviteManagementArgs) {
  const [email, setEmail] = useState("");
  const [pendingCancelInvitation, setPendingCancelInvitation] =
    useState<PendingCancelInvitation | null>(null);

  const handleInviteMember = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("メールアドレスを入力してください。");
      return;
    }

    setSavingTarget("add");
    setError("");
    try {
      await inviteMember({
        email: normalizedEmail,
        redirectUrl: `${window.location.origin}/group/invitations/accept`,
      });
      setEmail("");
      setSnackbar("招待メールを送信しました");
    } catch (caughtError) {
      setError(getGroupSettingsErrorMessage(caughtError, "招待メールを送信できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleRequestCancelInvitation = (invitation: GroupPendingInvitationListItem) => {
    setPendingCancelInvitation({
      invitationId: invitation._id as Id<"groupInvitations">,
      email: invitation.email,
    });
  };

  const handleCancelCancelInvitation = () => {
    if (savingTarget !== null) {
      return;
    }
    setPendingCancelInvitation(null);
  };

  const handleConfirmCancelInvitation = async () => {
    if (!pendingCancelInvitation) {
      return;
    }

    const invitationId = pendingCancelInvitation.invitationId;
    setSavingTarget(invitationId);
    setError("");
    try {
      await cancelPendingGroupInvitation({ invitationId });
      setPendingCancelInvitation(null);
      setSnackbar("招待を取り消しました");
    } catch (caughtError) {
      setError(getGroupSettingsErrorMessage(caughtError, "招待を取り消せませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  return {
    email,
    handleCancelCancelInvitation,
    handleConfirmCancelInvitation,
    handleInviteMember,
    handleRequestCancelInvitation,
    pendingCancelInvitation,
    setEmail,
  };
}
