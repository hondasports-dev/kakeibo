import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";

export function AccountDeletionStatusPage() {
  const status = useQuery(api.accountDeletion.getMyAccountDeletionStatus);
  const retry = useMutation(api.accountDeletion.retryAccountDeletion);
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  if (status === undefined)
    return (
      <Box className="app-main" role="status">
        <CircularProgress aria-label="退会状況を読み込み中" />
      </Box>
    );
  if (status === null)
    return (
      <Box className="app-main">
        <Paper className="settings-ledger" elevation={0}>
          <Stack spacing={2.5}>
            <Typography component="h1" variant="h5">
              アカウント削除の要求が見つかりません
            </Typography>
            <Typography color="text.secondary">
              進行中のアカウント削除処理がありません。設定画面からアカウント削除を開始できます。
            </Typography>
            <Button onClick={() => navigate("/settings")} variant="outlined">
              設定に戻る
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  const failed = status.status === "failed";
  return (
    <Box className="app-main">
      <Paper className="settings-ledger" elevation={0}>
        <Stack spacing={2.5}>
          <Typography component="h1" variant="h5">
            {failed ? "アカウントを削除できませんでした" : "アカウントを削除しています"}
          </Typography>
          {failed ? (
            <>
              <Alert severity="error">
                退会処理を完了できませんでした。もう一度試すことができます。
              </Alert>
              {retryError ? <Alert severity="error">{retryError}</Alert> : null}
              <Button
                color="error"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  setRetryError("");
                  try {
                    await retry({});
                  } catch {
                    setRetryError(
                      "再試行を開始できませんでした。しばらくしてからもう一度お試しください。",
                    );
                  } finally {
                    setRetrying(false);
                  }
                }}
                variant="contained"
              >
                {retrying ? <CircularProgress color="inherit" size={20} /> : "もう一度試す"}
              </Button>
            </>
          ) : (
            <>
              <Typography color="text.secondary">
                退会手続きを進めています。処理が完了すると、登録されているメールアドレスへお知らせします。
              </Typography>
              <Typography color="text.secondary">この処理は取り消せません。</Typography>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
