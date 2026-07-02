import { Box, Button } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";

export function ImageInputButton({
  buttonLabel,
  disabled,
  inputLabel,
  inputRef,
  onFilesSelected,
  variant,
  capture = false,
}: {
  buttonLabel: string;
  disabled: boolean;
  inputLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
  variant: "contained" | "outlined";
  capture?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        width: { xs: "100%", md: "auto" },
      }}
    >
      <Button
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        startIcon={<AddPhotoAlternateIcon />}
        sx={{
          justifyContent: "center",
          minWidth: 0,
          overflowWrap: "anywhere",
          whiteSpace: "normal",
          width: "100%",
        }}
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
        disabled={disabled}
        multiple
        onChange={onFilesSelected}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </Box>
  );
}
