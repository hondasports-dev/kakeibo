import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import { SystemAdminEmptyState, SystemAdminPageFrame } from "./SystemAdminPageFrame";
import type { AppEnvironment } from "../types";

type StatusFilter = "" | "running" | "retry_wait" | "failed" | "completed";

const statusLabels: Record<StatusFilter, string> = {
  "": "すべて",
  running: "running",
  retry_wait: "retry_wait",
  failed: "failed",
  completed: "completed",
};

export function SystemAdminGroupDeletionPage() {
  const [status, setStatus] = useState<StatusFilter>("failed");
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const list = useQuery(api.systemAdminGroupDeletion.listGroupDeletionJobs, {
    paginationOpts: { numItems: 20, cursor },
    status: status || undefined,
  });
  const resume = useMutation(api.systemAdminGroupDeletion.resumeGroupDeletion);

  const selected = list?.page.find((job) => job.jobId === selectedJobId);
  const environment = (list?.environment ?? "development") as AppEnvironment;

  const closeDialog = () => {
    setSelectedJobId(null);
    setReason("");
    setError("");
  };

  const submit = async () => {
    if (!selected || reason.trim().length < 1 || reason.trim().length > 500) return;
    setSaving(true);
    setError("");
    try {
      await resume({ jobId: selected.jobId, reason: reason.trim() });
      closeDialog();
      setSuccess("削除ジョブの再開を受け付けました。監査ログに記録しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "再開に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SystemAdminPageFrame
      description="削除処理の状態と再試行可能な失敗だけを確認します。家計内容は取得しません。"
      title="グループ削除ジョブ"
    >
      {environment === "production" ? (
        <Alert severity="warning">
          Production環境です。再開理由と対象を確認してから操作してください。
        </Alert>
      ) : null}
      {success ? (
        <Alert aria-live="polite" severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id="group-deletion-status-label">状態</InputLabel>
        <Select
          label="状態"
          labelId="group-deletion-status-label"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter);
            setCursor(null);
          }}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {list === undefined ? (
        <Typography role="status">削除ジョブを読み込んでいます…</Typography>
      ) : null}
      {list && list.page.length === 0 ? (
        <SystemAdminEmptyState message="該当する削除ジョブはありません。" />
      ) : null}
      {list && list.page.length > 0 ? (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {list.page.map((job) => (
            <Stack
              key={job.jobId}
              spacing={1}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "space-between" }}
              >
                <Stack>
                  <Typography component="h2" variant="h6">
                    {job.targetGroupNameSnapshot}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    groupId: {job.targetGroupIdSnapshot}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    source: {job.source} / stage: {job.stage}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    attempt: {job.attemptCount}/{job.maxAttempts} / 更新:{" "}
                    {new Intl.DateTimeFormat("ja-JP").format(job.updatedAt)}
                  </Typography>
                  {job.lastErrorCategory ? (
                    <Typography color="error" variant="body2">
                      error: {job.lastErrorCategory}
                    </Typography>
                  ) : null}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Chip
                    color={
                      job.status === "failed"
                        ? "error"
                        : job.status === "completed"
                          ? "default"
                          : "warning"
                    }
                    label={job.status}
                    size="small"
                  />
                  {job.status === "failed" ? (
                    <Button onClick={() => setSelectedJobId(job.jobId)} variant="outlined">
                      再開
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>
          ))}
          <Button disabled={list.isDone} onClick={() => setCursor(list.continueCursor)}>
            次のページ
          </Button>
        </Stack>
      ) : null}
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={closeDialog}
        open={selected !== undefined && selected !== null}
      >
        <DialogTitle>削除処理を再開</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>対象: {selected?.targetGroupNameSnapshot ?? "-"}</Typography>
            <Typography color="text.secondary" variant="body2">
              失敗したstageから再開します。削除開始・取消・復元は行いません。
            </Typography>
            <TextField
              autoFocus
              error={
                reason.trim().length > 500 || (reason.length > 0 && reason.trim().length === 0)
              }
              helperText={`${reason.trim().length}/500文字（必須）`}
              label="再開理由"
              multiline
              minRows={3}
              name="group-deletion-resume-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {error ? (
              <Alert aria-live="polite" severity="error">
                {error}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={closeDialog}>
            キャンセル
          </Button>
          <Button
            disabled={saving || reason.trim().length < 1 || reason.trim().length > 500}
            onClick={() => void submit()}
            variant="contained"
          >
            再開する
          </Button>
        </DialogActions>
      </Dialog>
    </SystemAdminPageFrame>
  );
}
