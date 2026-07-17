import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Divider,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { api } from "../../../../../convex/_generated/api";
import { getClerkUserFriendlyDisplayName, getConvexErrorMessage } from "../../../auth";
import { getMemberPrimaryLabel, isCurrentUserMember } from "../../utils/groupMemberDisplay";
import { useGroupSettings } from "../GroupSettingsProvider";
import { GroupMemberRemovalSection } from "./GroupMemberRemovalSection";
import { GroupOwnershipTransferSection } from "./GroupOwnershipTransferSection";
import { GroupDeleteSection } from "./GroupDeleteSection";
import { GroupDangerZoneDialogs } from "./GroupDangerZoneDialogs";
import type { PendingMember } from "./types";

export function GroupDangerZoneContent() {
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

  const deletionPreview = useQuery(
    api.groups.deletion.getGroupDeletionPreview,
    group?.role === "owner" && pendingDeleteGroup ? {} : "skip",
  );

  if (group === undefined || groups === undefined || members === undefined) {
    return null;
  }
  if (group === null || group.role !== "owner") {
    return snackbar ? (
      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={3000}
        onClose={() => setSnackbar("")}
        open
      >
        <Alert onClose={() => setSnackbar("")} severity="success" variant="filled">
          {snackbar}
        </Alert>
      </Snackbar>
    ) : null;
  }

  const removableMembers = members.filter((member) => member.role === "member");
  const transferableMembers = removableMembers.filter(
    (member) => !isCurrentUserMember(member.userId, userId ?? undefined),
  );
  const currentUserDisplayName = getClerkUserFriendlyDisplayName(user);

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
      navigate(`/group/delete/status/${jobId}`);
    } catch (caughtError) {
      setError(getConvexErrorMessage(caughtError, "グループを削除できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const isBusy = savingTarget !== null;

  return (
    <>
      <Accordion
        className="settings-danger-zone"
        data-testid="danger-zone-section"
        disableGutters
        elevation={0}
        expanded={expanded}
        onChange={(_, nextExpanded) => setExpanded(nextExpanded)}
      >
        <AccordionSummary
          aria-controls="danger-zone-content"
          expandIcon={<ExpandMoreIcon />}
          id="danger-zone-heading"
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <WarningAmberIcon color="error" />
            <Typography color="error" component="h2" variant="h5">
              危険な操作
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails id="danger-zone-content">
          <Stack spacing={2.5}>
            {error ? (
              <Alert severity="error" variant="outlined">
                {error}
              </Alert>
            ) : null}

            <GroupMemberRemovalSection
              disabled={isBusy}
              members={removableMembers}
              onRequestRemove={setPendingRemoveMember}
            />

            <Divider />

            <GroupOwnershipTransferSection
              disabled={isBusy}
              transferableMembers={transferableMembers}
              transferTargetUserId={transferTargetUserId}
              onChangeTransferTarget={setTransferTargetUserId}
              onRequestTransfer={handleRequestOwnershipTransfer}
            />

            <Divider />

            <GroupDeleteSection
              disabled={isBusy}
              onRequestDelete={() => {
                setDeleteConfirmationName("");
                setPendingDeleteGroup(true);
              }}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <GroupDangerZoneDialogs
        currentUserDisplayName={currentUserDisplayName}
        deleteConfirmationName={deleteConfirmationName}
        deletionPreview={deletionPreview}
        pendingDeleteGroup={pendingDeleteGroup}
        pendingOwnershipTransfer={pendingOwnershipTransfer}
        pendingRemoveMember={pendingRemoveMember}
        savingTarget={savingTarget}
        onCancelDeleteGroup={() => setPendingDeleteGroup(false)}
        onCancelOwnershipTransfer={() => setPendingOwnershipTransfer(null)}
        onCancelRemoveMember={() => setPendingRemoveMember(null)}
        onConfirmDeleteGroup={handleConfirmDeleteGroup}
        onConfirmOwnershipTransfer={handleConfirmOwnershipTransfer}
        onConfirmRemoveMember={handleConfirmRemoveMember}
        onConfirmationNameChange={setDeleteConfirmationName}
      />

      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={3000}
        onClose={() => setSnackbar("")}
        open={snackbar !== ""}
      >
        <Alert onClose={() => setSnackbar("")} severity="success" variant="filled">
          {snackbar}
        </Alert>
      </Snackbar>
    </>
  );
}
