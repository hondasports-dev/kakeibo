import { type FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import GroupSwitchIcon from "@mui/icons-material/SyncAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useAuth, useUser } from "@clerk/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MAX_GROUP_NAME_LENGTH } from "../../../../convex/groups/lib/groupName";
import { getClerkUserFriendlyDisplayName } from "../../auth";
import { getConvexErrorMessage } from "../../auth";
import { ConfirmDangerousActionDialog } from "./ConfirmDangerousActionDialog";
import { GroupMemberList } from "./GroupMemberList";
import type { GroupMemberListItem } from "../utils/groupMemberDisplay";
import { GroupPendingInvitationList } from "./GroupPendingInvitationList";
import type { GroupPendingInvitationListItem } from "../utils/groupInvitationDisplay";
import { GroupManagementAuditLogList } from "./GroupManagementAuditLogList";
import { formatGroupRoleLabel } from "../utils/groupRoleDisplay";
import { GroupSettingsSection } from "./GroupSettingsSection";
import {
  GroupSettingsProvider,
  useGroupSettings,
  useHasGroupSettingsProvider,
} from "./GroupSettingsProvider";

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

function getErrorMessage(error: unknown, fallback: string) {
  return getConvexErrorMessage(error, fallback);
}

type GroupSettingsPanelProps = {
  defaultExpanded?: boolean;
};

function GroupSettingsPanelContent({ defaultExpanded = true }: GroupSettingsPanelProps) {
  const { userId } = useAuth();
  const { user } = useUser();
  const {
    cancelPendingGroupInvitation,
    changeMemberRole,
    group,
    groups,
    inviteMember,
    managementAuditLogs,
    members,
    pendingInvitations,
    setActiveGroup,
    updateGroupName,
  } = useGroupSettings();

  const [activeGroupId, setActiveGroupId] = useState<Id<"groups"> | "">("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [email, setEmail] = useState("");
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [pendingCancelInvitation, setPendingCancelInvitation] =
    useState<PendingCancelInvitation | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(defaultExpanded);

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
      <Stack aria-label="グループ設定を読み込んでいます" spacing={1.5}>
        <CircularProgress size={20} />
        <Typography color="text.secondary" variant="body2">
          グループ設定を読み込んでいます。
        </Typography>
      </Stack>
    );
  }

  if (group === null) {
    return (
      <Stack spacing={2}>
        <Typography component="h2" variant="h5">
          グループ
        </Typography>
        <Alert severity="info" variant="outlined">
          グループ作成後にメンバー管理を利用できます。
        </Alert>
      </Stack>
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

  return (
    <>
      <Stack spacing={3}>
        <Box>
          <Typography component="h2" variant="h5">
            グループ
          </Typography>
          <Typography color="text.secondary" variant="body2">
            現在のグループとメンバー・招待の状態を確認します。
          </Typography>
        </Box>

        {error ? (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        ) : null}

        <Box className="settings-row group-settings-summary">
          <Typography color="text.secondary" variant="body2">
            現在のグループ
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{group.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {members.length}人・{isOwner ? "オーナー" : "メンバー"}
              {isOwner ? `・保留中の招待 ${pendingInvitations?.length ?? 0}件` : ""}
            </Typography>
          </Box>
          <Button
            aria-controls="group-management-content"
            aria-expanded={isManagementOpen}
            onClick={() => setIsManagementOpen((open) => !open)}
            sx={{ justifySelf: { md: "end" } }}
            variant="outlined"
          >
            {isManagementOpen ? "管理を閉じる" : "管理する"}
          </Button>
        </Box>

        <Collapse id="group-management-content" in={isManagementOpen} unmountOnExit>
          <Stack spacing={3}>
            <GroupSettingsSection
              description="現在のグループ名と表示中グループを確認・切り替えします。"
              testId="group-info-section"
              title="グループ情報"
            >
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip
                    color={isOwner ? "primary" : "secondary"}
                    label={isOwner ? "オーナー" : "メンバー"}
                  />
                  <Chip label={`${members.length}人`} variant="outlined" />
                </Stack>

                {canSwitchGroups ? (
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        fullWidth
                        label="現在のグループ"
                        onChange={(event) => setActiveGroupId(event.target.value as Id<"groups">)}
                        select
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
                    {isOwner ? (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <TextField
                          disabled={savingTarget === "rename"}
                          fullWidth
                          label="グループ名"
                          onChange={(event) => setGroupNameDraft(event.target.value)}
                          slotProps={{ htmlInput: { maxLength: MAX_GROUP_NAME_LENGTH } }}
                          value={groupNameDraft}
                        />
                        <Button
                          disabled={
                            savingTarget === "rename" || groupNameDraft.trim() === group.name.trim()
                          }
                          onClick={() => void handleUpdateGroupName()}
                          startIcon={
                            savingTarget === "rename" ? <CircularProgress size={16} /> : undefined
                          }
                          variant="outlined"
                        >
                          保存
                        </Button>
                      </Stack>
                    ) : null}
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
                      disabled={
                        savingTarget !== null || groupNameDraft.trim() === group.name.trim()
                      }
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
                  ? "所属メンバーを確認し、ロールを変更します。メンバー解除は危険な操作から行います。"
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
              </>
            ) : null}
          </Stack>
        </Collapse>
      </Stack>

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
    </>
  );
}

export function GroupSettingsPanel(props: GroupSettingsPanelProps) {
  const hasProvider = useHasGroupSettingsProvider();
  if (hasProvider) return <GroupSettingsPanelContent {...props} />;
  return (
    <GroupSettingsProvider>
      <GroupSettingsPanelContent {...props} />
    </GroupSettingsProvider>
  );
}
