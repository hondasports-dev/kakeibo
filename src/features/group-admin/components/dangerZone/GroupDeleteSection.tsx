import { Box, Button, Typography } from "@mui/material";

type GroupDeleteSectionProps = {
  disabled: boolean;
  onRequestDelete: () => void;
};

export function GroupDeleteSection({ disabled, onRequestDelete }: GroupDeleteSectionProps) {
  return (
    <Box>
      <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
        グループの削除
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
        このグループと紐づく家計データを完全に削除します。復旧はできません。
      </Typography>
      <Button
        color="error"
        data-testid="delete-group-request-button"
        disabled={disabled}
        onClick={onRequestDelete}
        variant="outlined"
      >
        削除を開始
      </Button>
    </Box>
  );
}
