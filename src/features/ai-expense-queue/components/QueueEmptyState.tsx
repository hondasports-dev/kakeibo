import { Button, Stack, Typography } from "@mui/material";
import { CollapsibleHelp } from "../../ui";

export function QueueEmptyState({
  addReceiptDisabled = false,
  onAddReceipt,
}: {
  addReceiptDisabled?: boolean;
  onAddReceipt?: () => void;
}) {
  return (
    <Stack spacing={1.5} sx={{ py: 0.5 }}>
      <Typography sx={{ fontWeight: 700 }} variant="body1">
        まだ下書きはありません
      </Typography>
      <Typography color="text.secondary" variant="body2">
        画像を解析して下書きを作成します。登録前に内容を確認できます。
      </Typography>
      {onAddReceipt && (
        <Button
          disabled={addReceiptDisabled}
          onClick={onAddReceipt}
          type="button"
          variant="contained"
          sx={{ alignSelf: "flex-start" }}
        >
          画像を読み取る
        </Button>
      )}
      <CollapsibleHelp summary="詳しい説明">
        <Typography color="text.secondary" variant="body2">
          読み取り時は画像を外部APIへ送信します（初回は同意が必要です）。
        </Typography>
      </CollapsibleHelp>
    </Stack>
  );
}
