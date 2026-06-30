import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

type ReceiptImageExtractorConsentDialogProps = {
  onAccept: () => void;
  onClose: () => void;
  onDecline: () => void;
  open: boolean;
  saving: boolean;
};

export function ReceiptImageExtractorConsentDialog({
  onAccept,
  onClose,
  onDecline,
  open,
  saving,
}: ReceiptImageExtractorConsentDialogProps) {
  return (
    <Dialog aria-labelledby="receipt-image-consent-dialog-title" onClose={onClose} open={open}>
      <DialogTitle id="receipt-image-consent-dialog-title">
        画像の外部API送信に同意しますか
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            レシート画像を解析するため、外部APIへ送信します。画像は長期保存しません。
          </Typography>
          <Typography variant="body2">
            読み取った店名・日付・金額はフォーム候補として反映されますが、自動保存はされません。不同意の場合は手入力できます。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDecline} type="button">
          手入力する
        </Button>
        <Button
          disabled={saving}
          onClick={onAccept}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
          type="button"
          variant="contained"
        >
          {saving ? "保存中..." : "同意して読み取る"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
