import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

type ConfirmDangerousActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDangerousActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "戻る",
  confirming = false,
  onCancel,
  onConfirm,
}: ConfirmDangerousActionDialogProps) {
  return (
    <Dialog fullWidth maxWidth="xs" onClose={confirming ? undefined : onCancel} open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={confirming} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          color="error"
          disabled={confirming}
          onClick={onConfirm}
          startIcon={confirming ? <CircularProgress color="inherit" size={16} /> : undefined}
          variant="contained"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
