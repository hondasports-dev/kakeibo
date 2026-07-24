import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type GroupDeletionResumeDialogProps = {
  open: boolean;
  targetGroupNameSnapshot: string | undefined;
  reason: string;
  saving: boolean;
  error: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function GroupDeletionResumeDialog({
  open,
  targetGroupNameSnapshot,
  reason,
  saving,
  error,
  onReasonChange,
  onClose,
  onConfirm,
}: GroupDeletionResumeDialogProps) {
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>削除処理を再開</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>対象: {targetGroupNameSnapshot ?? "-"}</Typography>
          <Typography color="text.secondary" variant="body2">
            失敗したstageから再開します。削除開始・取消・復元は行いません。
          </Typography>
          <TextField
            autoFocus
            error={reason.trim().length > 500 || (reason.length > 0 && reason.trim().length === 0)}
            helperText={`${reason.trim().length}/500文字（必須）`}
            label="再開理由"
            minRows={3}
            multiline
            name="group-deletion-resume-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
          />
          {error ? (
            <Alert aria-live="polite" severity="error">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          キャンセル
        </Button>
        <Button
          disabled={saving || reason.trim().length < 1 || reason.trim().length > 500}
          onClick={() => void onConfirm()}
          variant="contained"
        >
          再開する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
