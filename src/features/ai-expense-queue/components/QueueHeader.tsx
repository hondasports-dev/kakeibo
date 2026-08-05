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
      className="queue-header"
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "stretch", md: "flex-start" },
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" id="ai-expense-queue-heading" variant="h5">
          レシート入力
        </Typography>
      </Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ maxWidth: "100%", minWidth: 0, width: "100%" }}
      >
        <ImageInputButton
          buttonLabel="画像を読み取る"
          disabled={disabled}
          inputLabel="読み取り用画像を追加"
          inputRef={inputRef}
          onFilesSelected={onFilesSelected}
          variant="contained"
        />
        <ImageInputButton
          buttonLabel="カメラで撮影"
          disabled={disabled}
          inputLabel="読み取り用カメラ画像を追加"
          inputRef={cameraInputRef}
          onFilesSelected={onFilesSelected}
          variant="outlined"
          capture
        />
      </Stack>
      <input
        accept="image/*"
        aria-label="再撮影する画像を選択"
        capture="environment"
        className="visually-hidden-file-input"
        onChange={onRetryFileSelected}
        ref={retryInputRef}
        tabIndex={-1}
        type="file"
      />
    </Stack>
  );
}
