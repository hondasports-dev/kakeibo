import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MenuItem from "@mui/material/MenuItem";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getClerkUserFriendlyDisplayName, getConvexErrorMessage } from "../../auth";
import { ConfirmDangerousActionDialog } from "./ConfirmDangerousActionDialog";
import { ConfirmDeleteGroupDialog } from "./ConfirmDeleteGroupDialog";
import type { GroupMemberListItem } from "../utils/groupMemberDisplay";
import { getMemberPrimaryLabel, isCurrentUserMember } from "../utils/groupMemberDisplay";
import { formatGroupRoleLabel } from "../utils/groupRoleDisplay";

type GroupInfo = {
  _id: Id<"groups">;
  name: string;
  role: "owner" | "member";
};

type PendingMember = { userId: string; displayLabel: string };

export function GroupDangerZone() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { user } = useUser();
  const group = useQuery(api.groups.queries.getMyGroup) as GroupInfo | null | undefined;
  const groups = useQuery(api.groups.queries.listMyGroups) as
    | { _id: Id<"groups">; name: string; role: "owner" | "member"; isActive: boolean }[]
    | undefined;
  const members = useQuery(api.groups.queries.getGroupMembers) as GroupMemberListItem[] | undefined;
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

  const removeMember = useMutation(api.groups.members.removeMember);
  const transferGroupOwnership = useMutation(api.groups.members.transferGroupOwnership);
  const deleteGroup = useMutation(api.groups.deletion.deleteGroup);
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
      await deleteGroup({ confirmationGroupName: deleteConfirmationName });
      setPendingDeleteGroup(false);
      setDeleteConfirmationName("");
      setSnackbar("グループを削除しました");
      navigate(groups.length > 1 ? "/group/select" : "/group/setup");
    } catch (caughtError) {
      setPendingDeleteGroup(false);
      setError(getConvexErrorMessage(caughtError, "グループを削除できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

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

            <Box>
              <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
                メンバー解除
              </Typography>
              {removableMembers.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  解除できるメンバーはいません。
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {removableMembers.map((member) => {
                    const displayLabel = getMemberPrimaryLabel(member, null);
                    return (
                      <Box className="settings-danger-row" key={member.userId}>
                        <Typography sx={{ overflowWrap: "anywhere" }}>{displayLabel}</Typography>
                        <Button
                          aria-label={`${displayLabel}をグループから外す`}
                          color="error"
                          disabled={savingTarget !== null}
                          onClick={() =>
                            setPendingRemoveMember({ userId: member.userId, displayLabel })
                          }
                          size="small"
                          variant="outlined"
                        >
                          グループから外す
                        </Button>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            <Divider />
            <Box>
              <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
                オーナー権限の譲渡
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
                譲渡後、あなたはメンバーになり、管理操作を実行できなくなります。
              </Typography>
              {transferableMembers.length === 0 ? (
                <Alert severity="info" variant="outlined">
                  譲渡先となるメンバーがいません。
                </Alert>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    aria-label="譲渡先メンバー"
                    data-testid="ownership-transfer-target-select"
                    disabled={savingTarget !== null}
                    fullWidth
                    onChange={(event) => setTransferTargetUserId(event.target.value)}
                    select
                    size="small"
                    value={transferTargetUserId}
                  >
                    <MenuItem disabled value="">
                      譲渡先を選択
                    </MenuItem>
                    {transferableMembers.map((member) => (
                      <MenuItem key={member.userId} value={member.userId}>
                        {getMemberPrimaryLabel(member, null)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    color="error"
                    data-testid="ownership-transfer-request-button"
                    disabled={savingTarget !== null || transferTargetUserId === ""}
                    onClick={handleRequestOwnershipTransfer}
                    variant="outlined"
                  >
                    譲渡を開始
                  </Button>
                </Stack>
              )}
            </Box>

            <Divider />
            <Box>
              <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
                グループの削除
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
                このグループと紐づく家計データを完全に削除します。復旧はできません。
              </Typography>
              <Button
                color="error"
                data-testid="delete-group-request-button"
                disabled={savingTarget !== null}
                onClick={() => {
                  setDeleteConfirmationName("");
                  setPendingDeleteGroup(true);
                }}
                variant="outlined"
              >
                削除を開始
              </Button>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <ConfirmDangerousActionDialog
        confirmLabel="グループから外す"
        confirming={pendingRemoveMember !== null && savingTarget === pendingRemoveMember.userId}
        description={
          pendingRemoveMember
            ? `${pendingRemoveMember.displayLabel} をこのグループから外します。Clerk アカウント自体は削除されず、他のグループへの所属はそのままです。`
            : ""
        }
        onCancel={() => setPendingRemoveMember(null)}
        onConfirm={() => void handleConfirmRemoveMember()}
        open={pendingRemoveMember !== null}
        title="メンバーをグループから外しますか？"
      />
      <ConfirmDangerousActionDialog
        cancelLabel="戻る"
        confirmLabel="オーナー権限を譲渡する"
        confirming={
          pendingOwnershipTransfer !== null && savingTarget === pendingOwnershipTransfer.userId
        }
        description={
          pendingOwnershipTransfer
            ? `現在のオーナー: ${currentUserDisplayName}。譲渡先: ${pendingOwnershipTransfer.displayLabel}。譲渡後のあなたのロール: ${formatGroupRoleLabel("member")}。譲渡後は管理操作を実行できなくなります。`
            : ""
        }
        onCancel={() => setPendingOwnershipTransfer(null)}
        onConfirm={() => void handleConfirmOwnershipTransfer()}
        open={pendingOwnershipTransfer !== null}
        title="オーナー権限を譲渡しますか？"
      />
      <ConfirmDeleteGroupDialog
        confirmationName={deleteConfirmationName}
        confirming={pendingDeleteGroup && savingTarget === "delete-group"}
        onCancel={() => setPendingDeleteGroup(false)}
        onConfirm={() => void handleConfirmDeleteGroup()}
        onConfirmationNameChange={setDeleteConfirmationName}
        open={pendingDeleteGroup}
        preview={deletionPreview ?? null}
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
