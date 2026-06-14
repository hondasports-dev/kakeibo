import { Box, Button } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";

export function ImageInputButton({
  buttonLabel,
  inputLabel,
  inputRef,
  onFilesSelected,
  variant,
  capture = false,
}: {
  buttonLabel: string;
  inputLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
  variant: "contained" | "outlined";
  capture?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Button
        onClick={() => inputRef.current?.click()}
        startIcon={<AddPhotoAlternateIcon />}
        type="button"
        variant={variant}
      >
        {buttonLabel}
      </Button>
      <input
        accept="image/*"
        aria-label={inputLabel}
        capture={capture ? "environment" : undefined}
        className="visually-hidden-file-input"
        multiple
        onChange={onFilesSelected}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </Box>
  );
}
