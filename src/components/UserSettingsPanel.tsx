import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function UserSettingsPanel() {
  const profile = useQuery(api.users.getUserProfile);
  const updateMonthlyIncome = useMutation(api.users.updateMonthlyIncome);

  const currentMonthlyIncome = profile?.monthlyIncome ?? null;

  const [inputValue, setInputValue] = useState<number | "">(
    currentMonthlyIncome !== null ? currentMonthlyIncome : "",
  );
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");

  // profile が更新されたら入力値も同期する（初回ロード時）
  const [lastSyncedIncome, setLastSyncedIncome] = useState<number | null | undefined>(undefined);
  if (lastSyncedIncome !== currentMonthlyIncome && profile !== undefined) {
    setLastSyncedIncome(currentMonthlyIncome);
    setInputValue(currentMonthlyIncome !== null ? currentMonthlyIncome : "");
  }

  const handleSave = async () => {
    const value = inputValue === "" ? null : inputValue;

    // クライアントバリデーション
    if (value !== null && (value < 0 || !Number.isInteger(value))) {
      setError("月収入は0以上の整数で入力してください");
      return;
    }

    setStatus("saving");
    setError("");
    try {
      await updateMonthlyIncome({ monthlyIncome: value });
      setSnackbar("月収入を保存しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "月収入を保存できませんでした。"));
    } finally {
      setStatus("idle");
    }
  };

  const handleClear = async () => {
    setStatus("saving");
    setError("");
    try {
      await updateMonthlyIncome({ monthlyIncome: null });
      setInputValue("");
      setSnackbar("月収入をクリアしました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "月収入をクリアできませんでした。"));
    } finally {
      setStatus("idle");
    }
  };

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          <Typography component="h2" variant="h5">
            ユーザー設定
          </Typography>
          <Typography color="text.secondary" variant="body2">
            月収入を設定すると、ダッシュボードに今月の残金が表示されます。
          </Typography>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <TextField
            fullWidth
            label="月収入（円）"
            onChange={(event) => {
              const val = event.target.value;
              if (val === "") {
                setInputValue("");
              } else {
                setInputValue(Number(val));
              }
              setError("");
            }}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            type="number"
            value={inputValue}
          />

          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={status === "saving"}
              onClick={handleSave}
              startIcon={status === "saving" ? <CircularProgress size={16} /> : undefined}
              variant="contained"
            >
              保存
            </Button>
            <Button
              disabled={status === "saving"}
              onClick={handleClear}
              variant="outlined"
            >
              クリア（未設定に戻す）
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Snackbar
        autoHideDuration={3000}
        message={snackbar}
        onClose={() => setSnackbar("")}
        open={snackbar !== ""}
      />
    </Paper>
  );
}
