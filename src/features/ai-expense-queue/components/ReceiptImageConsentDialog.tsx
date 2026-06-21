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

export function ReceiptImageConsentDialog({
  open,
  saving,
  onAccept,
  onDecline,
}: {
  open: boolean;
  saving: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Dialog
      aria-labelledby="receipt-image-consent-dialog-title"
      onClose={() => {
        if (!saving) {
          onDecline();
        }
      }}
      open={open}
    >
      <DialogTitle id="receipt-image-consent-dialog-title">
        画像の外部API送信に同意しますか
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            レシート画像を解析するため、画像データを外部APIへ送信します。画像は長期保存しません。
          </Typography>
          <Typography variant="body2">
            読み取った内容は確認用の下書きとして表示され、自動では家計簿に登録されません。
          </Typography>
          <Typography variant="body2">
            同意しない場合や読み取りに失敗した場合も、手入力で登録できます。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onDecline} type="button">
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
