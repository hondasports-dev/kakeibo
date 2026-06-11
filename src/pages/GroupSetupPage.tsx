import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { api } from "../../convex/_generated/api";
import { useGroupMembership } from "../hooks/useGroupMembership";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupSetupPage() {
  const navigate = useNavigate();
  const { group, isLoading } = useGroupMembership();
  const createGroup = useMutation(api.groups.createGroup);
  const seedDefaultCategories = useMutation(api.categories.seedDefaultCategories);
  const [groupName, setGroupName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
            <CircularProgress aria-label="グループ所属を確認中" />
            <Typography color="text.secondary">グループ所属を確認しています。</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (group) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError("グループ名を入力してください。");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await createGroup({ name });
      await seedDefaultCategories();
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "グループを作成できませんでした。"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              家族グループを作成
            </Typography>
            <Typography color="text.secondary">家計データはグループ単位で共有されます。</Typography>
          </Box>

          <Alert severity="info" variant="outlined">
            Clerk invitation で招待されたメンバーは、ログイン後にオーナーが設定画面から
            グループへ追加します。
          </Alert>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleCreate}>
            <Stack spacing={2}>
              <TextField
                autoFocus
                fullWidth
                label="グループ名"
                name="groupName"
                onChange={(event) => setGroupName(event.target.value)}
                value={groupName}
              />
              <Button
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={16} /> : <GroupAddIcon />}
                type="submit"
                variant="contained"
              >
                {isSaving ? "作成中..." : "グループを作成"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
