import { Box, Typography } from "@mui/material";
import "./SuzumemoLoadingScreen.css";

interface SuzumemoLoadingScreenProps {
  label: string;
  message: string;
}

const animationBasePath = "/animations/suzumemo-loading";

export function SuzumemoLoadingScreen({ label, message }: SuzumemoLoadingScreenProps) {
  return (
    <Box aria-label={label} className="suzumemo-loading-screen" role="status">
      <Box className="suzumemo-loading-panel">
        <Box aria-hidden="true" className="suzumemo-loading-stage">
          <Box
            alt=""
            className="suzumemo-loading-layer suzumemo-loading-wordmark"
            component="img"
            src={`${animationBasePath}/wordmark.svg`}
          />
          <Box
            alt=""
            className="suzumemo-loading-layer suzumemo-loading-subtitle"
            component="img"
            src={`${animationBasePath}/subtitle.svg`}
          />
          <Box
            alt=""
            className="suzumemo-loading-layer suzumemo-loading-leaf-left"
            component="img"
            data-testid="suzumemo-loading-leaf"
            src={`${animationBasePath}/leaf-left.svg`}
          />
          <Box
            alt=""
            className="suzumemo-loading-layer suzumemo-loading-leaf-right"
            component="img"
            data-testid="suzumemo-loading-leaf"
            src={`${animationBasePath}/leaf-right.svg`}
          />
          <Box
            alt=""
            className="suzumemo-loading-layer suzumemo-loading-dot"
            component="img"
            src={`${animationBasePath}/dot.svg`}
          />
        </Box>
        <Typography color="inherit">{message}</Typography>
      </Box>
    </Box>
  );
}
