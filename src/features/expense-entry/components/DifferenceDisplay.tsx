import { Chip, Stack, Typography } from "@mui/material";

export function DifferenceDisplay({
  difference,
  sourceAmount,
}: {
  difference: number | null;
  sourceAmount: number;
}) {
  if (difference === null || sourceAmount <= 0) return null;

  const isZero = difference === 0;
  const isNegative = difference < 0;
  const color = isZero ? "success.main" : isNegative ? "error.main" : "warning.main";
  const label = isZero
    ? "配分完了"
    : isNegative
      ? `超過: ${Math.abs(difference).toLocaleString("ja-JP")}円`
      : `未配分: ${difference.toLocaleString("ja-JP")}円`;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        差額
      </Typography>
      <Typography aria-label="差額" variant="body2" sx={{ color, fontWeight: 700 }}>
        {isZero
          ? "0"
          : isNegative
            ? `-${Math.abs(difference).toLocaleString("ja-JP")}`
            : `+${difference.toLocaleString("ja-JP")}`}
      </Typography>
      <Chip
        label={label}
        size="small"
        color={isZero ? "success" : isNegative ? "error" : "warning"}
        variant="outlined"
      />
    </Stack>
  );
}
