import {
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";

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
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      <DialogTitle id="receipt-image-consent-dialog-title">画像を読み取る</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            画像を解析して下書きを作成します。登録前に内容を確認できます。
          </Typography>
          <Button
            onClick={() => setDetailsOpen((current) => !current)}
            size="small"
            type="button"
            variant="text"
            sx={{ alignSelf: "flex-start" }}
          >
            外部APIへの送信について
          </Button>
          <Collapse in={detailsOpen}>
            <Typography color="text.secondary" variant="body2">
              解析のため画像を外部APIへ送信します。画像は長期保存しません。読み取った内容は下書きとして表示され、自動では登録されません。
            </Typography>
          </Collapse>
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
          {saving ? "読み取り中…" : "画像を読み取る"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
