import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
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

type ReviewMemoPanelProps = {
  weekStartDate: string;
  weekStatus: "draft" | "completed";
  reviewMemo?: string | null;
  totalAmountYen: number;
  prevWeekTotalAmountYen: number | null;
  isSummaryLoading?: boolean;
  /** セッション完了後に呼ばれるコールバック（省略可）。SummaryPage では不要 */
  onComplete?: () => void;
};

export function ReviewMemoPanel({
  weekStartDate,
  weekStatus,
  reviewMemo: initialReviewMemo,
  totalAmountYen,
  prevWeekTotalAmountYen,
  isSummaryLoading = false,
  onComplete,
}: ReviewMemoPanelProps) {
  const updateReviewMemo = useMutation(api.weekSessions.mutations.updateReviewMemo);
  const completeWeekSession = useMutation(api.weekSessions.mutations.completeWeekSession);
  const [reviewMemo, setReviewMemo] = useState(initialReviewMemo ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "completing">("idle");
  const [error, setError] = useState("");
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // SummaryPage では summaryWeekSession が useQuery で非同期に更新されるため、
  // initialReviewMemo が変わったときはローカル state に反映する。
  // ユーザーが編集中でない（status === "idle"）場合のみ上書きする。
  useEffect(() => {
    if (status === "idle") {
      setReviewMemo(initialReviewMemo ?? "");
    }
    // status は依存に含めない（編集中の上書きを防ぐため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReviewMemo]);

  const isCompleted = weekStatus === "completed";
  const isBusy = status !== "idle";

  const handleSave = async () => {
    setStatus("saving");
    setError("");

    try {
      await updateReviewMemo({
        weekStartDate,
        reviewMemo,
      });
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
      await completeWeekSession({
        weekStartDate,
        reviewMemo,
      });
      setSnackbarMessage("今週の入力を完了しました");
      onComplete?.();
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
              onComplete ? (
                <Button disabled={isBusy} onClick={onComplete} variant="contained">
                  週次サマリーを見る
                </Button>
              ) : null
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
