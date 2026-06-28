import { Chip, Stack, Typography } from "@mui/material";
import { calcPrevWeekRatio, formatPrevWeekRatioWithArrow } from "../../../lib/weekComparison";

type PreviousWeekComparisonProps = {
  currentTotalAmountYen: number;
  prevWeekTotalAmountYen: number | null;
  isLoading?: boolean;
  size?: "body2" | "caption";
};

export function PreviousWeekComparison({
  currentTotalAmountYen,
  prevWeekTotalAmountYen,
  isLoading = false,
  size = "body2",
}: PreviousWeekComparisonProps) {
  const ratio = calcPrevWeekRatio(currentTotalAmountYen, prevWeekTotalAmountYen);
  const hasPrevWeekData = ratio !== null;
  const isIncrease = hasPrevWeekData && ratio > 100;
  const isDecrease = hasPrevWeekData && ratio < 100;
  const valueColor = isIncrease ? "error.main" : isDecrease ? "success.main" : "text.secondary";

  return (
    <Stack
      aria-label="前週比"
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap" }}
    >
      <Chip label="前週比" size="small" variant="outlined" />
      {isLoading ? (
        <Typography color="text.secondary" variant={size}>
          確認中
        </Typography>
      ) : (
        <Typography sx={{ color: valueColor, fontWeight: 700 }} variant={size}>
          {formatPrevWeekRatioWithArrow(ratio)}
        </Typography>
      )}
    </Stack>
  );
}
