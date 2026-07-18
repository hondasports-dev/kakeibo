import { useEffect, useMemo, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SystemAdminListItem, UserSearchItem } from "../types";

export type SystemAdminAction = "grant" | "regrant" | "revoke";

type SystemAdminActionDialogProps = {
  open: boolean;
  action: SystemAdminAction;
  target: SystemAdminListItem | UserSearchItem | null;
  environment: string;
  confirming: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

const actionLabel: Record<SystemAdminAction, string> = {
  grant: "付与",
  regrant: "再付与",
  revoke: "剥奪",
};

export function SystemAdminActionDialog({
  open,
  action,
  target,
  environment,
  confirming,
  error,
  onCancel,
  onConfirm,
}: SystemAdminActionDialogProps) {
  const [reason, setReason] = useState("");
  const targetKey = target ? ("targetUserId" in target ? target.targetUserId : target.id) : null;
  useEffect(() => {
    if (open) setReason("");
  }, [open, targetKey]);

  const normalizedReason = reason.trim();
  const reasonError = useMemo(() => {
    if (normalizedReason.length === 0 || normalizedReason.length > 500) {
      return "理由は1〜500文字で入力してください";
    }
    return "";
  }, [normalizedReason]);
  const titleId = "system-admin-action-dialog-title";
  const descriptionId = "system-admin-action-dialog-description";
  const helperTextId = "system-admin-reason-helper";
  const label = actionLabel[action];

  return (
    <Dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
      onClose={confirming ? undefined : onCancel}
      open={open}
    >
      <DialogTitle id={titleId}>{label}を確認</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography id={descriptionId} variant="body2">
            {target?.displayName ?? "対象ユーザー"}（
            {target ? ("targetUserId" in target ? target.targetUserId : target.userId) : "不明"}
            ）に対して「{label}
            」を実行します。 環境: {environment}。この操作は監査ログに記録されます。
          </Typography>
          <TextField
            autoFocus
            disabled={confirming}
            error={Boolean(reasonError)}
            fullWidth
            helperText={reasonError || "監査目的の理由を入力してください"}
            slotProps={{
              formHelperText: { id: helperTextId },
              htmlInput: {
                "aria-describedby": `${descriptionId} ${helperTextId} system-admin-reason-count`,
              },
            }}
            label="操作理由"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
          <Typography
            aria-live="polite"
            color={normalizedReason.length > 500 ? "error" : "text.secondary"}
            id="system-admin-reason-count"
            variant="caption"
          >
            {normalizedReason.length}/500文字
          </Typography>
          {error ? (
            <Typography color="error" role="alert" variant="body2">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={confirming} onClick={onCancel}>
          戻る
        </Button>
        <Button
          color={action === "revoke" ? "error" : "primary"}
          disabled={confirming || Boolean(reasonError) || !target}
          onClick={() => onConfirm(normalizedReason)}
          startIcon={confirming ? <CircularProgress color="inherit" size={16} /> : undefined}
          variant="contained"
        >
          {label}する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
