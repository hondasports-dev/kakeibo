import { useState } from "react";
import { useMutation } from "convex/react";
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
import { PreviousWeekComparison } from "./PreviousWeekComparison";
import type { WeekSession } from "../hooks/useWeekSession";

type ReviewMemoPanelProps = {
  weekSession: WeekSession;
  totalAmountYen: number;
  prevWeekTotalAmountYen: number | null;
  isSummaryLoading?: boolean;
  onSessionUpdated: (weekSession: WeekSession) => void;
  onShowSummary: () => void;
};

export function ReviewMemoPanel({
  weekSession,
  totalAmountYen,
  prevWeekTotalAmountYen,
  isSummaryLoading = false,
  onSessionUpdated,
  onShowSummary,
}: ReviewMemoPanelProps) {
  const updateReviewMemo = useMutation(api.weekSessions.updateReviewMemo);
  const completeWeekSession = useMutation(api.weekSessions.completeWeekSession);
  const [reviewMemo, setReviewMemo] = useState(weekSession.reviewMemo ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "completing">("idle");
  const [error, setError] = useState("");
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const isCompleted = weekSession.status === "completed";
  const isBusy = status !== "idle";

  const handleSave = async () => {
    setStatus("saving");
    setError("");

    try {
      const updatedSession = await updateReviewMemo({
        weekStartDate: weekSession.weekStartDate,
        reviewMemo,
      });
      onSessionUpdated(updatedSession);
      setSnackbarMessage(isCompleted ? "振り返りメモを更新しました" : "振り返りメモを保存しました");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "振り返りメモを保存できませんでした。もう一度お試しください。";
      setError(message);
    } finally {
      setStatus("idle");
    }
  };

  const handleComplete = async () => {
    setStatus("completing");
    setError("");

    try {
      const updatedSession = await completeWeekSession({
        weekStartDate: weekSession.weekStartDate,
        reviewMemo,
      });
      onSessionUpdated(updatedSession);
      setSnackbarMessage("今週の入力を完了しました");
      onShowSummary();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "セッションを完了できませんでした。もう一度お試しください。";
      setError(message);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography component="h2" variant="h5">
              週次振り返り
            </Typography>
            <Typography color="text.secondary" variant="body2">
              今週の気づきや、来週の買い方メモを残します。
            </Typography>
          </Box>

          <Box className="budget-strip">
            <span>今週の支出</span>
            <Stack spacing={0.75} sx={{ alignItems: "flex-end" }}>
              <strong>{totalAmountYen.toLocaleString()}円</strong>
              <PreviousWeekComparison
                currentTotalAmountYen={totalAmountYen}
                isLoading={isSummaryLoading}
                prevWeekTotalAmountYen={prevWeekTotalAmountYen}
                size="caption"
              />
            </Stack>
          </Box>

          <Alert severity={isCompleted ? "success" : "info"} variant="outlined">
            {isCompleted
              ? "この週は完了済みです。振り返りメモは完了後も再編集できます。"
              : "メモを保存してからセッションを完了できます。完了後もメモは再編集できます。"}
          </Alert>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <TextField
            disabled={isBusy}
            fullWidth
            label="振り返りメモ"
            minRows={4}
            multiline
            name="reviewMemo"
            onChange={(event) => setReviewMemo(event.target.value)}
            placeholder="例: 外食が多かった。来週は平日2日は作り置きにする。"
            value={reviewMemo}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              disabled={isBusy}
              onClick={handleSave}
              startIcon={status === "saving" ? <CircularProgress size={16} /> : undefined}
              variant="outlined"
            >
              {status === "saving" ? "保存中..." : isCompleted ? "メモを更新" : "メモを保存"}
            </Button>
            {isCompleted ? (
              <Button disabled={isBusy} onClick={onShowSummary} variant="contained">
                週次サマリーを見る
              </Button>
            ) : (
              <Button
                disabled={isBusy}
                onClick={handleComplete}
                startIcon={status === "completing" ? <CircularProgress size={16} /> : undefined}
                variant="contained"
              >
                {status === "completing" ? "完了中..." : "セッションを完了"}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage("")}
        open={!!snackbarMessage}
        message={snackbarMessage}
      />
    </Paper>
  );
}
