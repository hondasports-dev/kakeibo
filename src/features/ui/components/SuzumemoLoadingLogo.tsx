import { Box } from "@mui/material";
import "./SuzumemoLoading.css";

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

export function SuzumemoLoadingLogo() {
  return (
    <Box aria-hidden="true" className="suzumemo-loading-stage" data-testid="suzumemo-loading-logo">
      {wordmarkSlices.map(([left, right], index) => (
        <img
          key={`wordmark-${left}`}
          alt=""
          className={`suzumemo-loading-layer suzumemo-loading-letter suzumemo-loading-wordmark-wave-${index + 1}`}
          data-testid="suzumemo-loading-wordmark-letter"
          height={161}
          src={`${animationBasePath}/wordmark.svg`}
          style={{ clipPath: `inset(0 ${100 - right}% 0 ${left}%)` }}
          width={600}
        />
      ))}
      {subtitleSlices.map(([left, right], index) => (
        <img
          key={`subtitle-${left}`}
          alt=""
          className={`suzumemo-loading-layer suzumemo-loading-letter suzumemo-loading-subtitle-wave-${index + 1}`}
          data-testid="suzumemo-loading-subtitle-letter"
          height={161}
          src={`${animationBasePath}/subtitle.svg`}
          style={{ clipPath: `inset(0 ${100 - right}% 0 ${left}%)` }}
          width={600}
        />
      ))}
      <img
        alt=""
        className="suzumemo-loading-layer suzumemo-loading-leaf-left"
        data-testid="suzumemo-loading-leaf"
        height={161}
        src={`${animationBasePath}/leaf-left.svg`}
        width={600}
      />
      <img
        alt=""
        className="suzumemo-loading-layer suzumemo-loading-leaf-right"
        data-testid="suzumemo-loading-leaf"
        height={161}
        src={`${animationBasePath}/leaf-right.svg`}
        width={600}
      />
    </Box>
  );
}
