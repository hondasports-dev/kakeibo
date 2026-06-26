import { Button, Stack, Typography } from "@mui/material";
import { CollapsibleHelp } from "../../ui";

export function QueueEmptyState({ onAddReceipt }: { onAddReceipt?: () => void }) {
  return (
    <Stack spacing={1.5} sx={{ py: 0.5 }}>
      <Typography sx={{ fontWeight: 700 }} variant="body1">
        まだ下書きはありません
      </Typography>
      <Typography color="text.secondary" variant="body2">
        レシートを追加すると、AIが支出下書きを作ります。
      </Typography>
      {onAddReceipt && (
        <Button
          onClick={onAddReceipt}
          type="button"
          variant="contained"
          sx={{ alignSelf: "flex-start" }}
        >
          レシートを追加
        </Button>
      )}
      <CollapsibleHelp summary="詳しい説明">
        <Typography color="text.secondary" variant="body2">
          追加したレシートは状態別に表示されます。撮影または画像選択で追加できます。
        </Typography>
        <Typography color="text.secondary" variant="body2">
          読み取り時は画像を外部APIへ送信します（初回は同意が必要です）。
        </Typography>
      </CollapsibleHelp>
    </Stack>
  );
}
