import { Box, Paper, Skeleton, Typography } from "@mui/material";

const currencyFormatter = new Intl.NumberFormat("ja-JP");

function formatSignedAmount(value: number | null): string {
  if (value === null) return "比較データなし";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${currencyFormatter.format(Math.abs(value))}円`;
}

function formatSignedRate(value: number | null): string {
  if (value === null) return "比較データなし";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value)}%`;
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning";
}) {
  const color =
    tone === "good" ? "success.main" : tone === "warning" ? "error.main" : "text.primary";
  return (
    <Box aria-label={label} className="weekly-summary-metric">
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography color={color} sx={{ fontWeight: 700 }} variant="h5">
        {value}
      </Typography>
    </Box>
  );
}

export function SummaryMetricsPanel({
  totalAmountYen,
  previousDiff,
  averageRate,
  isLoading = false,
}: {
  totalAmountYen: number;
  previousDiff: number | null;
  averageRate: number | null;
  isLoading?: boolean;
}) {
  return (
    <Paper
      className="paper-panel weekly-summary-metrics"
      data-testid={isLoading ? "weekly-summary-metrics-loading" : "weekly-summary-metrics"}
      elevation={0}
    >
      {isLoading ? (
        <Box className="weekly-summary-metrics-grid">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} height={58} variant="rounded" />
          ))}
        </Box>
      ) : (
        <Box className="weekly-summary-metrics-grid">
          <Metric label="合計支出" value={`${currencyFormatter.format(totalAmountYen)}円`} />
          <Metric
            label="前週差"
            value={formatSignedAmount(previousDiff)}
            tone={previousDiff === null ? "default" : previousDiff <= 0 ? "good" : "warning"}
          />
          <Metric
            label="2週平均比"
            value={formatSignedRate(averageRate)}
            tone={averageRate === null ? "default" : averageRate <= 0 ? "good" : "warning"}
          />
        </Box>
      )}
    </Paper>
  );
}
