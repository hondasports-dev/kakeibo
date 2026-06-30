import { Box, Button, Stack, Typography } from "@mui/material";

type ReceiptImagePreviewProps = {
  disabled: boolean;
  fileName: string;
  onClear: () => void;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
};

export function ReceiptImagePreview({
  disabled,
  fileName,
  onClear,
  previewCanvasRef,
}: ReceiptImagePreviewProps) {
  return (
    <Stack spacing={1.5}>
      <Box className="receipt-image-preview">
        <canvas
          aria-label="選択したレシート画像のプレビュー"
          height={360}
          ref={previewCanvasRef}
          role="img"
          width={640}
        />
      </Box>
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Typography className="receipt-image-file-name" variant="body2">
          {fileName}
        </Typography>
        <Button
          color="error"
          disabled={disabled}
          onClick={onClear}
          type="button"
          variant="text"
          sx={{ alignSelf: "flex-start" }}
        >
          選択画像を削除
        </Button>
      </Stack>
    </Stack>
  );
}
