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

type ComparisonBar = {
  amount: number;
  label: string;
  tone: "current" | "previous";
};

function ComparisonBars({
  bars,
  isCompact,
  maxAmount,
}: {
  bars: ComparisonBar[];
  isCompact: boolean;
  maxAmount: number;
}) {
  if (isCompact) {
    return (
      <Stack
        aria-label="前週との比較グラフ"
        className="dashboard-comparison-bars"
        role="img"
        spacing={1.25}
      >
        {bars.map((bar) => {
          const widthPercent = maxAmount > 0 ? Math.max((bar.amount / maxAmount) * 100, 8) : 0;
          return (
            <Stack
              key={bar.label}
              className="dashboard-comparison-bar-row"
              direction="row"
              spacing={1.5}
            >
              <Typography className="dashboard-comparison-bar-label" variant="body2">
                {bar.label}
              </Typography>
              <Box className="dashboard-comparison-bar-track dashboard-comparison-bar-track--horizontal">
                <Box
                  className={`dashboard-comparison-bar-fill dashboard-comparison-bar-fill--${bar.tone}`}
                  sx={{ width: `${widthPercent}%` }}
                />
                <Typography className="dashboard-comparison-bar-amount" variant="body2">
                  {formatAmount(bar.amount)}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    );
  }

  return (
    <Box
      aria-label="前週との比較グラフ"
      className="dashboard-comparison-bars dashboard-comparison-bars--vertical"
      role="img"
    >
      {bars.map((bar) => {
        const heightPercent = maxAmount > 0 ? Math.max((bar.amount / maxAmount) * 100, 12) : 0;
        return (
          <Stack
            key={bar.label}
            className="dashboard-comparison-bar-col"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <Typography className="dashboard-comparison-bar-amount" variant="body2">
              {formatAmount(bar.amount)}
            </Typography>
            <Box className="dashboard-comparison-bar-track dashboard-comparison-bar-track--vertical">
              <Box
                className={`dashboard-comparison-bar-fill dashboard-comparison-bar-fill--${bar.tone}`}
                sx={{ height: `${heightPercent}%` }}
              />
            </Box>
            <Typography
              className="dashboard-comparison-bar-label"
              color="text.secondary"
              variant="body2"
            >
              {bar.label}
            </Typography>
          </Stack>
        );
      })}
    </Box>
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

  const bars: ComparisonBar[] =
    prevWeekTotalAmountYen !== null
      ? [
          { amount: prevWeekTotalAmountYen, label: "前週", tone: "previous" },
          { amount: currentTotalAmountYen, label: "今週", tone: "current" },
        ]
      : [{ amount: currentTotalAmountYen, label: "今週", tone: "current" }];

  const maxAmount = Math.max(...bars.map((bar) => bar.amount), 1);
  const diffSummary = formatDiffSummary(diff, rate);

  return (
    <Paper className="paper-panel" data-testid="week-comparison-chart" elevation={0}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" variant="h6">
          前週との比較
        </Typography>

        {!isCompact && (
          <Typography color={diffColor} sx={{ fontWeight: 700, mt: 0.5, mb: 2 }} variant="body2">
            {diffSummary}
          </Typography>
        )}

        <ComparisonBars bars={bars} isCompact={isCompact} maxAmount={maxAmount} />

        {isCompact && (
          <Typography color={diffColor} sx={{ fontWeight: 700, mt: 1.5 }} variant="body2">
            {diffSummary}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
