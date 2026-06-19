import { Chip, Stack, Typography } from "@mui/material";

type PreviousWeekComparisonProps = {
  currentTotalAmountYen: number;
  prevWeekTotalAmountYen: number | null;
  isLoading?: boolean;
  size?: "body2" | "caption";
};

function formatDiff(current: number, prev: number): string {
  const diff = current - prev;
  if (diff === 0) return "±0円";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toLocaleString()}円`;
}

export function PreviousWeekComparison({
  currentTotalAmountYen,
  prevWeekTotalAmountYen,
  isLoading = false,
  size = "body2",
}: PreviousWeekComparisonProps) {
  const hasPrevWeekData = prevWeekTotalAmountYen !== null;
  const isIncrease = hasPrevWeekData && currentTotalAmountYen > prevWeekTotalAmountYen;
  const isDecrease = hasPrevWeekData && currentTotalAmountYen < prevWeekTotalAmountYen;
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
      ) : hasPrevWeekData ? (
        <Typography sx={{ color: valueColor, fontWeight: 700 }} variant={size}>
          {formatDiff(currentTotalAmountYen, prevWeekTotalAmountYen)}
        </Typography>
      ) : (
        <Typography color="text.secondary" variant={size}>
          前週データなし
        </Typography>
      )}
    </Stack>
  );
}
