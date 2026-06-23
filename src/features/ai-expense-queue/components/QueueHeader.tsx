import { Box, Stack, Typography } from "@mui/material";
import { ImageInputButton } from "./ImageInputButton";

export function QueueHeader({
  disabled,
  inputRef,
  cameraInputRef,
  retryInputRef,
  onFilesSelected,
  onRetryFileSelected,
}: {
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  retryInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
  onRetryFileSelected: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
    >
      <Box>
        <Typography component="h2" id="ai-expense-queue-heading" variant="h5">
          読み取り
        </Typography>
        <Typography color="text.secondary" variant="body2">
          レシート・払込票をまとめて追加できます。
        </Typography>
        <Typography color="text.secondary" variant="body2">
          スマートフォンでは撮影、PCでは画像選択から追加できます。
        </Typography>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <ImageInputButton
          buttonLabel="撮影する"
          disabled={disabled}
          inputLabel="読み取り用カメラ画像を追加"
          inputRef={cameraInputRef}
          onFilesSelected={onFilesSelected}
          variant="contained"
          capture
        />
        <ImageInputButton
          buttonLabel="画像を追加"
          disabled={disabled}
          inputLabel="読み取り用画像を追加"
          inputRef={inputRef}
          onFilesSelected={onFilesSelected}
          variant="outlined"
        />
      </Stack>
      <input
        accept="image/*"
        aria-label="再試行する画像を選択"
        className="visually-hidden-file-input"
        onChange={onRetryFileSelected}
        ref={retryInputRef}
        tabIndex={-1}
        type="file"
      />
    </Stack>
  );
}
