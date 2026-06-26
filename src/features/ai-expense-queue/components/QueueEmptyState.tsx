import { Stack, Typography } from "@mui/material";
import { CollapsibleHelp } from "../../ui";

export function QueueEmptyState() {
  return (
    <Stack spacing={1} sx={{ py: 0.5 }}>
      <Typography color="text.secondary" variant="body2">
        レシートを読み取って下書きを作ります。
      </Typography>
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
