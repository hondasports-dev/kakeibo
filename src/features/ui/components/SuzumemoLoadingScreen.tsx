import { Box, Typography } from "@mui/material";
import "./SuzumemoLoadingScreen.css";

interface SuzumemoLoadingScreenProps {
  label: string;
  message: string;
}

const animationBasePath = "/animations/suzumemo-loading";
const wordmarkSlices = [
  [3, 15],
  [15, 26],
  [26, 35],
  [35, 46],
  [46, 61],
  [61, 72],
  [72, 88],
  [88, 98],
] as const;
const subtitleSlices = [
  [34, 43],
  [43, 52],
  [52, 61],
  [61, 70],
] as const;

export function SuzumemoLoadingScreen({ label, message }: SuzumemoLoadingScreenProps) {
  return (
    <Box aria-label={label} className="suzumemo-loading-screen" role="status">
      <Box className="suzumemo-loading-panel">
        <Box aria-hidden="true" className="suzumemo-loading-stage">
          {wordmarkSlices.map(([left, right], index) => (
            <Box
              key={`wordmark-${left}`}
              alt=""
              className={`suzumemo-loading-layer suzumemo-loading-letter suzumemo-loading-wordmark-wave-${index + 1}`}
              component="img"
              data-testid="suzumemo-loading-wordmark-letter"
              src={`${animationBasePath}/wordmark.svg`}
              style={{
                clipPath: `inset(0 ${100 - right}% 0 ${left}%)`,
              }}
            />
          ))}
          {subtitleSlices.map(([left, right], index) => (
            <Box
              key={`subtitle-${left}`}
              alt=""
              className={`suzumemo-loading-layer suzumemo-loading-letter suzumemo-loading-subtitle-wave-${index + 1}`}
              component="img"
              data-testid="suzumemo-loading-subtitle-letter"
              src={`${animationBasePath}/subtitle.svg`}
              style={{
                clipPath: `inset(0 ${100 - right}% 0 ${left}%)`,
              }}
            />
          ))}
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
        </Box>
        <Typography color="inherit">{message}</Typography>
      </Box>
    </Box>
  );
}
