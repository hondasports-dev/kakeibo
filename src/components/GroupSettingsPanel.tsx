import { type FormEvent, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupSwitchIcon from "@mui/icons-material/SyncAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useAuth, useUser } from "@clerk/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClerkUserFriendlyDisplayName } from "../lib/clerkUserDisplayName";
import { getConvexErrorMessage } from "../lib/convexError";
import { ConfirmDangerousActionDialog } from "./groupAdmin/ConfirmDangerousActionDialog";
import { GroupSettingsSection } from "./groupAdmin/GroupSettingsSection";

type GroupInfo = {
  _id: Id<"groups">;
  name: string;
  role: "owner" | "member";
  createdAt: number;
};

type GroupMember = {
  userId: string;
  role: "owner" | "member";
  displayName: string;
  email: string | null;
  createdAt: number;
};

type PendingRemoveMember = {
  userId: string;
  displayLabel: string;
};

const PHASE2_DANGER_OPERATIONS = [
  "オーナー権限の譲渡",
  "メンバーのロール変更",
  "グループの削除",
  "管理操作の監査ログ",
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  return getConvexErrorMessage(error, fallback);
}

function getMemberInitial(primaryLabel: string) {
  return primaryLabel.trim().slice(0, 1).toUpperCase() || "?";
}

function getMemberPrimaryLabel(member: GroupMember, currentUserDisplayName: string | null) {
  if (currentUserDisplayName) {
    return currentUserDisplayName;
  }
  if (member.displayName !== "ユーザー") {
    return member.displayName;
  }
  return member.email ?? "ユーザー";
}

function getMemberSecondaryLabel(member: GroupMember, primaryLabel: string) {
  if (member.email) {
    return member.email === primaryLabel ? "メール登録済み" : member.email;
  }
  return `ID: ${member.userId.slice(-8)}`;
}

function isCurrentUserMember(memberUserId: string, clerkUserId: string | null | undefined) {
  return Boolean(
    clerkUserId && (memberUserId === clerkUserId || memberUserId.endsWith(`|${clerkUserId}`)),
  );
}

export function GroupSettingsPanel() {
  const { userId } = useAuth();
  const { user } = useUser();
  const group = useQuery(api.groups.getMyGroup) as GroupInfo | null | undefined;
  const groups = useQuery(api.groups.listMyGroups) as
    | { _id: Id<"groups">; name: string; role: "owner" | "member"; isActive: boolean }[]
    | undefined;
  const members = useQuery(api.groups.getGroupMembers) as GroupMember[] | undefined;
  const setActiveGroup = useMutation(api.groups.setActiveGroup);
  const removeMember = useMutation(api.groups.removeMember);
  const inviteMember = useAction(api.groupInvitations.inviteMember);

  const [activeGroupId, setActiveGroupId] = useState<Id<"groups"> | "">("");
  const [email, setEmail] = useState("");
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [pendingRemoveMember, setPendingRemoveMember] = useState<PendingRemoveMember | null>(null);

  useEffect(() => {
    if (group) {
      setActiveGroupId(group._id);
    }
  }, [group]);

  if (group === undefined || members === undefined || groups === undefined) {
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

  const handleRequestRemoveMember = (member: GroupMember, displayLabel: string) => {
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
              ) : (
                <Typography variant="body1">{group.name}</Typography>
              )}

              {isOwner ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    disabled
                    fullWidth
                    helperText="グループ名の変更は次の更新で利用できます。"
                    label="グループ名"
                    value={group.name}
                  />
                  <Button disabled variant="outlined">
                    保存
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </GroupSettingsSection>

          <Divider />

          <GroupSettingsSection
            description={
              isOwner
                ? "所属メンバーを確認し、必要に応じてグループから外します。"
                : "所属メンバーを確認できます。メンバーの追加・削除はオーナーのみ操作できます。"
            }
            testId="member-management-section"
            title="メンバー管理"
          >
            <Box component="ul" className="group-member-list">
              {members.map((member) => {
                const canRemove = isOwner && member.role !== "owner";
                const isCurrentUser = isCurrentUserMember(member.userId, userId);
                const primaryLabel = getMemberPrimaryLabel(
                  member,
                  isCurrentUser ? currentUserDisplayName : null,
                );
                const secondaryLabel = getMemberSecondaryLabel(member, primaryLabel);
                return (
                  <Box className="group-member-row" component="li" key={member.userId}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                      <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
                        {getMemberInitial(primaryLabel)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {primaryLabel}
                          </Typography>
                          {isCurrentUser ? (
                            <Chip label="あなた" size="small" variant="outlined" />
                          ) : null}
                        </Stack>
                        <Typography color="text.secondary" variant="body2" noWrap>
                          {secondaryLabel}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip
                        color={member.role === "owner" ? "primary" : "secondary"}
                        label={member.role === "owner" ? "オーナー" : "メンバー"}
                        size="small"
                        variant={member.role === "owner" ? "filled" : "outlined"}
                      />
                      {isOwner ? (
                        <Tooltip title={canRemove ? "グループから外す" : "外せません"}>
                          <span>
                            <IconButton
                              aria-label={`${primaryLabel}をグループから外す`}
                              color="error"
                              disabled={!canRemove || savingTarget !== null}
                              onClick={() => handleRequestRemoveMember(member, primaryLabel)}
                              size="small"
                            >
                              {savingTarget === member.userId ? (
                                <CircularProgress size={18} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
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

                  <Box
                    data-testid="pending-invites-placeholder"
                    sx={{
                      p: 1.5,
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <Typography color="text.secondary" variant="body2">
                      送信済みの招待はありません。pending 招待一覧は次の更新で表示されます。
                    </Typography>
                  </Box>
                </Stack>
              </GroupSettingsSection>

              <Divider />

              <GroupSettingsSection
                description="誤操作でデータを失わないよう、不可逆な操作は別セクションにまとめます。"
                testId="danger-zone-section"
                title="危険な操作"
              >
                <Alert severity="warning" variant="outlined">
                  以下の操作は Phase2 で追加予定です。Phase1 では実行できません。
                </Alert>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {PHASE2_DANGER_OPERATIONS.map((operation) => (
                    <Typography component="li" key={operation} variant="body2">
                      {operation}
                    </Typography>
                  ))}
                </Box>
              </GroupSettingsSection>
            </>
          ) : null}
        </Stack>
      </Box>

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
