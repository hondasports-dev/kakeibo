import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import DeleteIcon from "@mui/icons-material/Delete";
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
  const members = useQuery(api.groups.getGroupMembers) as GroupMember[] | undefined;
  const addMemberByEmail = useMutation(api.groups.addMemberByEmail);
  const removeMember = useMutation(api.groups.removeMember);

  const [email, setEmail] = useState("");
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");

  if (group === undefined || members === undefined) {
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

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("メールアドレスを入力してください。");
      return;
    }

    setSavingTarget("add");
    setError("");
    try {
      await addMemberByEmail({ email: normalizedEmail });
      setEmail("");
      setSnackbar("メンバーを追加しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "メンバーを追加できませんでした。"));
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

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleAddMember}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                disabled={!isOwner || savingTarget !== null}
                fullWidth
                label="Clerk招待済みメンバーのメールアドレス"
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
                追加
              </Button>
            </Stack>
          </Box>

          {!isOwner ? (
            <Alert severity="info" variant="outlined">
              メンバーの追加と削除はオーナーのみ操作できます。
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
