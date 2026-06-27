import { BarChart } from "@mui/x-charts/BarChart";
import { Box, Paper, Skeleton, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  calcPrevWeekDiff,
  calcPrevWeekRate,
  formatPrevWeekDiff,
  formatPrevWeekRate,
} from "../utils/weekComparison";

type WeekComparisonChartProps = {
  currentTotalAmountYen: number;
  prevWeekTotalAmountYen: number | null;
  isLoading?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("ja-JP");

function formatAmount(amount: number): string {
  return `${currencyFormatter.format(amount)}円`;
}

function formatAxisAmount(amount: number): string {
  if (Math.abs(amount) >= 10_000) {
    const amountInTenThousands = Number((amount / 10_000).toFixed(1));
    return `${amountInTenThousands}万円`;
  }
  return formatAmount(amount);
}

function formatDiffSummary(diff: number | null, rate: number | null): string {
  if (diff === null) {
    return "前週データなし";
  }
  const diffText = formatPrevWeekDiff(diff);
  if (rate === null) {
    return `差額 ${diffText}`;
  }
  return `差額 ${diffText} (${formatPrevWeekRate(rate)})`;
}

function hasComparisonData(
  currentTotalAmountYen: number,
  prevWeekTotalAmountYen: number | null,
): boolean {
  return (
    currentTotalAmountYen > 0 || (prevWeekTotalAmountYen !== null && prevWeekTotalAmountYen > 0)
  );
}

export function WeekComparisonChart({
  currentTotalAmountYen,
  prevWeekTotalAmountYen,
  isLoading = false,
}: WeekComparisonChartProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const diff = calcPrevWeekDiff(currentTotalAmountYen, prevWeekTotalAmountYen);
  const rate = calcPrevWeekRate(currentTotalAmountYen, prevWeekTotalAmountYen);
  const diffColor =
    diff === null
      ? "text.secondary"
      : diff > 0
        ? "error.main"
        : diff < 0
          ? "success.main"
          : "text.secondary";

  if (isLoading) {
    return (
      <Paper className="paper-panel" data-testid="week-comparison-loading" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            前週との比較
          </Typography>
          <Skeleton height={180} variant="rectangular" />
        </Box>
      </Paper>
    );
  }

  if (!hasComparisonData(currentTotalAmountYen, prevWeekTotalAmountYen)) {
    return (
      <Paper className="paper-panel" data-testid="week-comparison-empty" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            前週との比較
          </Typography>
          <Typography color="text.secondary" variant="body2">
            前週との比較データがあると表示されます
          </Typography>
        </Box>
      </Paper>
    );
  }

  const dataset =
    prevWeekTotalAmountYen !== null
      ? [
          { label: "前週", amount: prevWeekTotalAmountYen },
          { label: "今週", amount: currentTotalAmountYen },
        ]
      : [{ label: "今週", amount: currentTotalAmountYen }];

  const chartHeight = isCompact ? 140 : 200;
  const chartMargin = isCompact
    ? { bottom: 8, left: 72, right: 16, top: 8 }
    : { bottom: 28, left: 52, right: 12, top: 16 };

  return (
    <Paper className="paper-panel" data-testid="week-comparison-chart" elevation={0}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" sx={{ mb: 0.5 }} variant="h6">
          前週との比較
        </Typography>
        <Typography color={diffColor} sx={{ fontWeight: 700, mb: 1.5 }} variant="body2">
          {formatDiffSummary(diff, rate)}
        </Typography>

        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: "space-around", mb: 1.5, flexWrap: "wrap" }}
        >
          {prevWeekTotalAmountYen !== null && (
            <Typography variant="body2">
              <Typography color="text.secondary" component="span">
                前週{" "}
              </Typography>
              <Typography component="span" sx={{ fontWeight: 700 }}>
                {formatAmount(prevWeekTotalAmountYen)}
              </Typography>
            </Typography>
          )}
          <Typography variant="body2">
            <Typography color="text.secondary" component="span">
              今週{" "}
            </Typography>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {formatAmount(currentTotalAmountYen)}
            </Typography>
          </Typography>
        </Stack>

        <Box aria-label="前週との比較グラフ" role="img" sx={{ minWidth: 0, width: "100%" }}>
          <BarChart
            borderRadius={6}
            colors={[theme.palette.grey[400], theme.palette.primary.main]}
            dataset={dataset}
            height={chartHeight}
            hideLegend
            layout={isCompact ? "horizontal" : "vertical"}
            margin={chartMargin}
            series={[
              {
                barLabel: (item) => formatAmount(item.value ?? 0),
                dataKey: "amount",
                label: "支出",
              },
            ]}
            skipAnimation
            xAxis={
              isCompact
                ? [{ valueFormatter: formatAxisAmount }]
                : [{ dataKey: "label", scaleType: "band" }]
            }
            yAxis={
              isCompact
                ? [{ dataKey: "label", scaleType: "band", width: 56 }]
                : [{ valueFormatter: formatAxisAmount, width: 52 }]
            }
          />
        </Box>
      </Box>
    </Paper>
  );
}
