import { Box, Typography } from "@mui/material";
import { SuzumemoLoadingLogo } from "./SuzumemoLoadingLogo";
import "./SuzumemoLoading.css";

interface SuzumemoLoadingStateProps {
  label: string;
  message: string;
  variant: "fullscreen" | "page";
}

export function SuzumemoLoadingState({ label, message, variant }: SuzumemoLoadingStateProps) {
  return (
    <Box
      aria-label={label}
      className={`suzumemo-loading-state suzumemo-loading-state--${variant}`}
      role="status"
    >
      <Box className="suzumemo-loading-panel">
        <SuzumemoLoadingLogo />
        <Typography color="inherit">{message}</Typography>
      </Box>
    </Box>
  );
}
