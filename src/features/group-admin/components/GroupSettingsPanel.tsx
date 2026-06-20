import { type FormEvent, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import GroupSwitchIcon from "@mui/icons-material/SyncAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useAuth, useUser } from "@clerk/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MAX_GROUP_NAME_LENGTH } from "../../../../convex/lib/groupName";
import { getClerkUserFriendlyDisplayName } from "../../auth";
import { getConvexErrorMessage } from "../../auth";
import { ConfirmDangerousActionDialog } from "./ConfirmDangerousActionDialog";
import { GroupMemberList } from "./GroupMemberList";
import type { GroupMemberListItem } from "../utils/groupMemberDisplay";
import { getMemberPrimaryLabel, isCurrentUserMember } from "../utils/groupMemberDisplay";
import { GroupPendingInvitationList } from "./GroupPendingInvitationList";
import type { GroupPendingInvitationListItem } from "../utils/groupInvitationDisplay";
import { GroupManagementAuditLogList } from "./GroupManagementAuditLogList";
import type { GroupManagementAuditLogListItem } from "../utils/groupManagementAuditLogDisplay";
import { formatGroupRoleLabel } from "../utils/groupRoleDisplay";
import { GroupSettingsSection } from "./GroupSettingsSection";

type GroupInfo = {
  _id: Id<"groups">;
  name: string;
  role: "owner" | "member";
  createdAt: number;
};

type PendingRemoveMember = {
  userId: string;
  displayLabel: string;
};

type PendingCancelInvitation = {
  invitationId: Id<"groupInvitations">;
  email: string;
};

type PendingRoleChange = {
  userId: string;
  displayLabel: string;
  currentRole: "owner" | "member";
  newRole: "owner" | "member";
};

type PendingOwnershipTransfer = {
  userId: string;
  displayLabel: string;
};

const PHASE2_PLACEHOLDER_OPERATIONS = ["グループの削除"] as const;

function getErrorMessage(error: unknown, fallback: string) {
  return getConvexErrorMessage(error, fallback);
}

export function GroupSettingsPanel() {
  const { userId } = useAuth();
  const { user } = useUser();
  const group = useQuery(api.groups.getMyGroup) as GroupInfo | null | undefined;
  const groups = useQuery(api.groups.listMyGroups) as
    | { _id: Id<"groups">; name: string; role: "owner" | "member"; isActive: boolean }[]
    | undefined;
  const members = useQuery(api.groups.getGroupMembers) as GroupMemberListItem[] | undefined;
  const pendingInvitations = useQuery(
    api.groups.listPendingGroupInvitations,
    group?.role === "owner" ? {} : "skip",
  ) as GroupPendingInvitationListItem[] | undefined;
  const managementAuditLogs = useQuery(
    api.managementAuditLogs.listManagementAuditLogs,
    group?.role === "owner" ? {} : "skip",
  ) as GroupManagementAuditLogListItem[] | undefined;
  const setActiveGroup = useMutation(api.groups.setActiveGroup);
  const removeMember = useMutation(api.groups.removeMember);
  const changeMemberRole = useMutation(api.groups.changeMemberRole);
  const transferGroupOwnership = useMutation(api.groups.transferGroupOwnership);
  const updateGroupName = useMutation(api.groups.updateGroupName);
  const inviteMember = useAction(api.groupInvitations.inviteMember);
  const cancelPendingGroupInvitation = useAction(api.groupInvitations.cancelPendingGroupInvitation);

  const [activeGroupId, setActiveGroupId] = useState<Id<"groups"> | "">("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [email, setEmail] = useState("");
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [pendingRemoveMember, setPendingRemoveMember] = useState<PendingRemoveMember | null>(null);
  const [pendingCancelInvitation, setPendingCancelInvitation] =
    useState<PendingCancelInvitation | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingOwnershipTransfer, setPendingOwnershipTransfer] =
    useState<PendingOwnershipTransfer | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");

  const groupId = group?._id;
  const groupName = group?.name;
  const ownerCount = members?.filter((member) => member.role === "owner").length ?? 0;

  useEffect(() => {
    if (groupId && groupName !== undefined) {
      setActiveGroupId(groupId);
      setGroupNameDraft(groupName);
    }
  }, [groupId, groupName]);

  if (
    group === undefined ||
    members === undefined ||
    groups === undefined ||
    (group?.role === "owner" &&
      (pendingInvitations === undefined || managementAuditLogs === undefined))
  ) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              グループ設定を読み込んでいます。
            </Typography>
          </Stack>
        </Box>
      </Paper>
    );
  }

  if (group === null) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Alert severity="info" variant="outlined">
            グループ作成後にメンバー管理を利用できます。
          </Alert>
        </Box>
      </Paper>
    );
  }

  const isOwner = group.role === "owner";
  const canSwitchGroups = groups.length > 1;
  const currentUserDisplayName = getClerkUserFriendlyDisplayName(user);

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
      setError(getErrorMessage(caughtError, "招待メールを送信できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleUpdateGroupName = async () => {
    const normalizedName = groupNameDraft.trim();
    if (!normalizedName) {
      setError("グループ名を入力してください。");
      return;
    }

    setSavingTarget("rename");
    setError("");
    try {
      await updateGroupName({ name: normalizedName });
      setSnackbar("グループ名を更新しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "グループ名を更新できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSwitchGroup = async () => {
    if (!activeGroupId) {
      return;
    }
    setSavingTarget("switch");
    setError("");
    try {
      await setActiveGroup({ groupId: activeGroupId });
      setSnackbar("表示中のグループを切り替えました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "グループを切り替えられませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleRequestRemoveMember = (member: GroupMemberListItem, displayLabel: string) => {
    setPendingRemoveMember({ userId: member.userId, displayLabel });
  };

  const handleCancelRemoveMember = () => {
    if (savingTarget !== null) {
      return;
    }
    setPendingRemoveMember(null);
  };

  const handleConfirmRemoveMember = async () => {
    if (!pendingRemoveMember) {
      return;
    }

    const targetUserId = pendingRemoveMember.userId;
    setSavingTarget(targetUserId);
    setError("");
    try {
      await removeMember({ targetUserId });
      setPendingRemoveMember(null);
      setSnackbar("メンバーをグループから外しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "メンバーをグループから外せませんでした。"));
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
      setError(getErrorMessage(caughtError, "招待を取り消せませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleRequestRoleChange = (
    member: GroupMemberListItem,
    newRole: "owner" | "member",
    displayLabel: string,
  ) => {
    setPendingRoleChange({
      userId: member.userId,
      displayLabel,
      currentRole: member.role,
      newRole,
    });
  };

  const handleCancelRoleChange = () => {
    if (savingTarget !== null) {
      return;
    }
    setPendingRoleChange(null);
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) {
      return;
    }

    const { userId: targetUserId, newRole } = pendingRoleChange;
    setSavingTarget(targetUserId);
    setError("");
    try {
      await changeMemberRole({ targetUserId, newRole });
      setPendingRoleChange(null);
      setSnackbar("メンバーのロールを変更しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "ロールを変更できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const transferableMembers =
    members?.filter(
      (member) =>
        member.role === "member" && !isCurrentUserMember(member.userId, userId ?? undefined),
    ) ?? [];

  const handleRequestOwnershipTransfer = () => {
    const selectedMember = transferableMembers.find(
      (member) => member.userId === transferTargetUserId,
    );
    if (!selectedMember) {
      setError("譲渡先のメンバーを選択してください。");
      return;
    }

    setError("");
    setPendingOwnershipTransfer({
      userId: selectedMember.userId,
      displayLabel: getMemberPrimaryLabel(selectedMember, null),
    });
  };

  const handleCancelOwnershipTransfer = () => {
    if (savingTarget !== null) {
      return;
    }
    setPendingOwnershipTransfer(null);
  };

  const handleConfirmOwnershipTransfer = async () => {
    if (!pendingOwnershipTransfer) {
      return;
    }

    const { userId: targetUserId } = pendingOwnershipTransfer;
    setSavingTarget(targetUserId);
    setError("");
    try {
      await transferGroupOwnership({ targetUserId });
      setPendingOwnershipTransfer(null);
      setTransferTargetUserId("");
      setSnackbar("オーナー権限を譲渡しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "オーナー権限を譲渡できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h2" variant="h5">
              グループ管理
            </Typography>
            <Typography color="text.secondary" variant="body2">
              グループの基本情報、メンバー、招待をまとめて管理します。
            </Typography>
          </Box>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <GroupSettingsSection
            description="現在のグループ名と表示中グループを確認・切り替えします。"
            testId="group-info-section"
            title="グループ情報"
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip
                  label={isOwner ? "オーナー" : "メンバー"}
                  color={isOwner ? "primary" : "secondary"}
                />
                <Chip label={`${members.length}人`} variant="outlined" />
              </Stack>

              {canSwitchGroups ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    select
                    fullWidth
                    label="現在のグループ"
                    onChange={(event) => setActiveGroupId(event.target.value as Id<"groups">)}
                    value={activeGroupId}
                  >
                    {groups.map((item) => (
                      <MenuItem key={item._id} value={item._id}>
                        {item.name}
                        {item.isActive ? "（現在）" : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    disabled={savingTarget !== null || activeGroupId === group._id}
                    onClick={handleSwitchGroup}
                    startIcon={
                      savingTarget === "switch" ? (
                        <CircularProgress size={16} />
                      ) : (
                        <GroupSwitchIcon />
                      )
                    }
                    variant="outlined"
                  >
                    切り替え
                  </Button>
                </Stack>
              ) : isOwner ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    disabled={savingTarget !== null}
                    fullWidth
                    label="グループ名"
                    onChange={(event) => setGroupNameDraft(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: MAX_GROUP_NAME_LENGTH } }}
                    value={groupNameDraft}
                  />
                  <Button
                    disabled={savingTarget !== null || groupNameDraft.trim() === group.name.trim()}
                    onClick={() => void handleUpdateGroupName()}
                    startIcon={
                      savingTarget === "rename" ? <CircularProgress size={16} /> : undefined
                    }
                    variant="outlined"
                  >
                    保存
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body1">{group.name}</Typography>
              )}
            </Stack>
          </GroupSettingsSection>

          <Divider />

          <GroupSettingsSection
            description={
              isOwner
                ? "所属メンバーを確認し、ロール変更やグループからの除外を行います。"
                : "所属メンバーを確認できます。メンバーの追加・削除はオーナーのみ操作できます。"
            }
            testId="member-management-section"
            title="メンバー管理"
          >
            <GroupMemberList
              currentUserDisplayName={currentUserDisplayName}
              currentUserId={userId}
              isOwner={isOwner}
              members={members}
              onRequestRemove={isOwner ? handleRequestRemoveMember : undefined}
              onRequestRoleChange={isOwner ? handleRequestRoleChange : undefined}
              ownerCount={ownerCount}
              savingTarget={savingTarget}
            />
          </GroupSettingsSection>

          {!isOwner ? (
            <Alert severity="info" variant="outlined">
              招待と削除はオーナーのみ操作できます。
            </Alert>
          ) : null}

          {isOwner ? (
            <>
              <Divider />

              <GroupSettingsSection
                description="メール招待の送信と、送信済み招待の確認・取り消しを行います。"
                testId="invite-management-section"
                title="招待管理"
              >
                <Stack spacing={1.5}>
                  <Box component="form" onSubmit={handleInviteMember}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        disabled={savingTarget !== null}
                        fullWidth
                        label="招待するメールアドレス"
                        name="memberEmail"
                        onChange={(event) => setEmail(event.target.value)}
                        type="email"
                        value={email}
                      />
                      <Button
                        disabled={savingTarget !== null}
                        startIcon={
                          savingTarget === "add" ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PersonAddIcon />
                          )
                        }
                        type="submit"
                        variant="contained"
                      >
                        招待を送る
                      </Button>
                    </Stack>
                  </Box>

                  <GroupPendingInvitationList
                    invitations={pendingInvitations ?? []}
                    onRequestCancel={handleRequestCancelInvitation}
                    savingTarget={savingTarget}
                  />
                </Stack>
              </GroupSettingsSection>

              <Divider />

              <GroupSettingsSection
                description="グループ名変更、メンバー解除、招待取り消しなどの管理操作履歴を確認できます。"
                testId="management-audit-log-section"
                title="管理操作ログ"
              >
                <GroupManagementAuditLogList logs={managementAuditLogs ?? []} />
              </GroupSettingsSection>

              <Divider />

              <GroupSettingsSection
                description="誤操作でデータを失わないよう、不可逆な操作は別セクションにまとめます。"
                testId="danger-zone-section"
                title="危険な操作"
              >
                <Stack spacing={2}>
                  <Box>
                    <Typography sx={{ mb: 1 }} variant="subtitle2">
                      オーナー権限の譲渡
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
                      グループの管理責任を別のメンバーへ引き渡します。譲渡後、あなたはメンバーになり、管理操作は実行できなくなります。
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
                    <Typography sx={{ mb: 1 }} variant="subtitle2">
                      今後追加予定
                    </Typography>
                    <Alert severity="warning" variant="outlined">
                      以下の操作は今後のアップデートで追加予定です。現在は実行できません。
                    </Alert>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {PHASE2_PLACEHOLDER_OPERATIONS.map((operation) => (
                        <Typography component="li" key={operation} variant="body2">
                          {operation}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </Stack>
              </GroupSettingsSection>
            </>
          ) : null}
        </Stack>
      </Box>

      <ConfirmDangerousActionDialog
        cancelLabel="戻る"
        confirmLabel="ロールを変更する"
        confirming={pendingRoleChange !== null && savingTarget === pendingRoleChange.userId}
        description={
          pendingRoleChange
            ? `${pendingRoleChange.displayLabel} のロールを「${formatGroupRoleLabel(pendingRoleChange.currentRole)}」から「${formatGroupRoleLabel(pendingRoleChange.newRole)}」に変更します。`
            : ""
        }
        onCancel={handleCancelRoleChange}
        onConfirm={() => void handleConfirmRoleChange()}
        open={pendingRoleChange !== null}
        title="メンバーのロールを変更しますか？"
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
        onCancel={handleCancelOwnershipTransfer}
        onConfirm={() => void handleConfirmOwnershipTransfer()}
        open={pendingOwnershipTransfer !== null}
        title="オーナー権限を譲渡しますか？"
      />

      <ConfirmDangerousActionDialog
        confirmLabel="グループから外す"
        confirming={pendingRemoveMember !== null && savingTarget === pendingRemoveMember.userId}
        description={
          pendingRemoveMember
            ? `${pendingRemoveMember.displayLabel} をこのグループから外します。Clerk アカウント自体は削除されず、他のグループへの所属はそのままです。`
            : ""
        }
        onCancel={handleCancelRemoveMember}
        onConfirm={() => void handleConfirmRemoveMember()}
        open={pendingRemoveMember !== null}
        title="メンバーをグループから外しますか？"
      />

      <ConfirmDangerousActionDialog
        cancelLabel="戻る"
        confirmLabel="招待を取り消す"
        confirming={
          pendingCancelInvitation !== null && savingTarget === pendingCancelInvitation.invitationId
        }
        description={
          pendingCancelInvitation
            ? `${pendingCancelInvitation.email} への招待を取り消します。送信済みの招待リンクは無効になり、相手はこの招待で参加できなくなります。`
            : ""
        }
        onCancel={handleCancelCancelInvitation}
        onConfirm={() => void handleConfirmCancelInvitation()}
        open={pendingCancelInvitation !== null}
        title="招待を取り消しますか？"
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
    </Paper>
  );
}
