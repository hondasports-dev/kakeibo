import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { getClerkUserFriendlyDisplayName, getConvexErrorMessage } from "../../auth";
import { getMemberPrimaryLabel, isCurrentUserMember } from "../utils/groupMemberDisplay";
import { useGroupSettings } from "../components/GroupSettingsProvider";
import type { PendingMember } from "../components/dangerZone/types";

export function useGroupDangerZone() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { user } = useUser();
  const { requestGroupDeletion, group, groups, members, removeMember, transferGroupOwnership } =
    useGroupSettings();

  const [expanded, setExpanded] = useState(false);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [pendingRemoveMember, setPendingRemoveMember] = useState<PendingMember | null>(null);
  const [pendingOwnershipTransfer, setPendingOwnershipTransfer] = useState<PendingMember | null>(
    null,
  );
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");

  const removableMembers = members?.filter((member) => member.role === "member") ?? [];
  const transferableMembers = removableMembers.filter(
    (member) => !isCurrentUserMember(member.userId, userId ?? undefined),
  );
  const currentUserDisplayName = getClerkUserFriendlyDisplayName(user);
  const isBusy = savingTarget !== null;

  const handleConfirmRemoveMember = async () => {
    if (!pendingRemoveMember) return;
    setSavingTarget(pendingRemoveMember.userId);
    setError("");
    try {
      await removeMember({ targetUserId: pendingRemoveMember.userId });
      setPendingRemoveMember(null);
      setSnackbar("メンバーをグループから外しました");
    } catch (caughtError) {
      setError(getConvexErrorMessage(caughtError, "メンバーをグループから外せませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleRequestOwnershipTransfer = () => {
    const member = transferableMembers.find((item) => item.userId === transferTargetUserId);
    if (!member) {
      setError("譲渡先のメンバーを選択してください。");
      return;
    }
    setPendingOwnershipTransfer({
      userId: member.userId,
      displayLabel: getMemberPrimaryLabel(member, null),
    });
  };

  const handleConfirmOwnershipTransfer = async () => {
    if (!pendingOwnershipTransfer) return;
    setSavingTarget(pendingOwnershipTransfer.userId);
    setError("");
    try {
      await transferGroupOwnership({ targetUserId: pendingOwnershipTransfer.userId });
      setPendingOwnershipTransfer(null);
      setTransferTargetUserId("");
      setSnackbar("オーナー権限を譲渡しました");
    } catch (caughtError) {
      setError(getConvexErrorMessage(caughtError, "オーナー権限を譲渡できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    setSavingTarget("delete-group");
    setError("");
    try {
      const jobId = await requestGroupDeletion({ confirmationGroupName: deleteConfirmationName });
      setPendingDeleteGroup(false);
      setDeleteConfirmationName("");
      navigate(`/group/delete/status/${jobId}`, { flushSync: true, replace: true });
    } catch (caughtError) {
      setError(getConvexErrorMessage(caughtError, "グループを削除できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  return {
    group,
    groups,
    members,
    expanded,
    setExpanded,
    savingTarget,
    error,
    snackbar,
    setSnackbar,
    pendingRemoveMember,
    setPendingRemoveMember,
    pendingOwnershipTransfer,
    setPendingOwnershipTransfer,
    transferTargetUserId,
    setTransferTargetUserId,
    pendingDeleteGroup,
    setPendingDeleteGroup,
    deleteConfirmationName,
    setDeleteConfirmationName,
    removableMembers,
    transferableMembers,
    currentUserDisplayName,
    isBusy,
    handleConfirmRemoveMember,
    handleRequestOwnershipTransfer,
    handleConfirmOwnershipTransfer,
    handleConfirmDeleteGroup,
  };
}
