import { BarChart } from "@mui/x-charts/BarChart";
import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  formatWeeklyExpenseTooltip,
  type WeeklyExpenseChartItem,
} from "../utils/weeklyExpenseChartData";

type WeeklyTrendChartProps = {
  items?: WeeklyExpenseChartItem[];
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

function formatDiff(amount: number | null): string {
  if (amount === null) return "比較データなし";
  return `${amount > 0 ? "+" : ""}${currencyFormatter.format(amount)}円`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "比較データなし";
  return `${rate > 0 ? "+" : ""}${rate}%`;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700 }} variant="body1">
        {value}
      </Typography>
    </Stack>
  );
}

export function WeeklyTrendChart({ items = [], isLoading = false }: WeeklyTrendChartProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            週別支出推移
          </Typography>
          <Skeleton height={220} variant="rectangular" />
        </Box>
      </Paper>
    );
  }

  if (items.length === 0 || items.every((item) => item.amount === 0)) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            週別支出推移
          </Typography>
          <Typography color="text.secondary" variant="body2">
            週別の支出データがあると表示されます
          </Typography>
        </Box>
      </Paper>
    );
  }

  const targetWeek = items.at(-1)!;

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
          週別支出推移
        </Typography>

        <Stack
          direction="row"
          spacing={{ xs: 2, sm: 4 }}
          sx={{ mb: 1, overflowX: "auto", pb: 0.5 }}
        >
          <SummaryMetric label="対象週の支出" value={formatAmount(targetWeek.amount)} />
          <SummaryMetric label="前週差" value={formatDiff(targetWeek.previousDiff)} />
          <SummaryMetric label="2週平均比" value={formatRate(targetWeek.averageRate)} />
        </Stack>

        <Box aria-label="週別支出推移グラフ" role="img" sx={{ minWidth: 0, width: "100%" }}>
          <BarChart
            axisHighlight={{ x: "band" }}
            borderRadius={6}
            colors={[theme.palette.primary.main]}
            dataset={items}
            height={220}
            hideLegend
            margin={{ bottom: 28, left: 64, right: 12, top: 16 }}
            series={[
              {
                dataKey: "amount",
                label: "支出合計",
                valueFormatter: (_value, context) => {
                  const item = items[context.dataIndex];
                  return item ? formatWeeklyExpenseTooltip(item) : "";
                },
              },
            ]}
            skipAnimation
            xAxis={[{ dataKey: "label", scaleType: "band" }]}
            yAxis={[
              {
                valueFormatter: formatAxisAmount,
                width: 56,
              },
            ]}
          />
        </Box>
      </Box>
    </Paper>
  );
}
