import { type FormEvent, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Alert,
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
import { api } from "../../convex/_generated/api";

type GroupInfo = {
  _id: string;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupSettingsPanel() {
  const group = useQuery(api.groups.getMyGroup) as GroupInfo | null | undefined;
  const groups = useQuery(api.groups.listMyGroups) as
    | { _id: string; name: string; role: "owner" | "member"; isActive: boolean }[]
    | undefined;
  const members = useQuery(api.groups.getGroupMembers) as GroupMember[] | undefined;
  const setActiveGroup = useMutation(api.groups.setActiveGroup);
  const removeMember = useMutation(api.groups.removeMember);
  const inviteMember = useAction(api.groupInvitations.inviteMember);

  const [activeGroupId, setActiveGroupId] = useState("");
  const [email, setEmail] = useState("");
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");

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
      await setActiveGroup({ groupId: activeGroupId as never });
      setSnackbar("表示中のグループを切り替えました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "グループを切り替えられませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    setSavingTarget(targetUserId);
    setError("");
    try {
      await removeMember({ targetUserId });
      setSnackbar("メンバーを削除しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "メンバーを削除できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography component="h2" variant="h5">
              グループ管理
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {group.name}
            </Typography>
          </Box>

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
                onChange={(event) => setActiveGroupId(event.target.value)}
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
                  savingTarget === "switch" ? <CircularProgress size={16} /> : <GroupSwitchIcon />
                }
                variant="outlined"
              >
                切り替え
              </Button>
            </Stack>
          ) : null}

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleInviteMember}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                disabled={!isOwner || savingTarget !== null}
                fullWidth
                label="招待するメールアドレス"
                name="memberEmail"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <Button
                disabled={!isOwner || savingTarget !== null}
                startIcon={
                  savingTarget === "add" ? <CircularProgress size={16} /> : <PersonAddIcon />
                }
                type="submit"
                variant="contained"
              >
                招待を送る
              </Button>
            </Stack>
          </Box>

          {!isOwner ? (
            <Alert severity="info" variant="outlined">
              招待と削除はオーナーのみ操作できます。
            </Alert>
          ) : null}

          <Divider />

          <Box component="ul" className="group-member-list">
            {members.map((member) => {
              const canRemove = isOwner && member.role !== "owner";
              const label = member.email ?? member.userId;
              return (
                <Box className="group-member-row" component="li" key={member.userId}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {member.displayName}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {label}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Chip
                      color={member.role === "owner" ? "primary" : "secondary"}
                      label={member.role === "owner" ? "オーナー" : "メンバー"}
                      size="small"
                      variant={member.role === "owner" ? "filled" : "outlined"}
                    />
                    <Tooltip title={canRemove ? "メンバーを削除" : "削除できません"}>
                      <span>
                        <IconButton
                          aria-label={`${member.displayName}を削除`}
                          color="error"
                          disabled={!canRemove || savingTarget !== null}
                          onClick={() => handleRemoveMember(member.userId)}
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
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Stack>
      </Box>

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
