import { BarChart } from "@mui/x-charts/BarChart";
import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { HistoryTrendPoint } from "../../../../lib/domain/expenseSearch/analytics";
import { formatYenCompact } from "../../../utils/currency";
import { formatDateForDisplay } from "../../../utils/date";

function pointLabel(point: HistoryTrendPoint): string {
  if (point.granularity === "day") {
    return formatDateForDisplay(point.startDate);
  }
  if (point.granularity === "month") {
    return point.startDate.slice(0, 7).replace("-", "/");
  }
  return `${formatDateForDisplay(point.startDate)}〜${formatDateForDisplay(point.endDate)}`;
}

export function HistoryTrendChart({
  points,
  isLoading = false,
  onPointSelect,
}: {
  points: HistoryTrendPoint[];
  isLoading?: boolean;
  onPointSelect?: (point: HistoryTrendPoint) => void;
}) {
  const theme = useTheme();
  const isCompact =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(theme.breakpoints.down("sm")).matches
      : false;
  const chartHeight = isCompact ? 220 : 260;
  const chartMargin = isCompact
    ? { bottom: 48, left: 60, right: 8, top: 16 }
    : { bottom: 42, left: 56, right: 12, top: 16 };
  const hasData = points.some((point) => point.totalExpenseYen > 0 || point.totalIncomeYen > 0);
  const dataset = points.map((point) => ({
    label: pointLabel(point),
    expense: point.totalExpenseYen,
    income: point.totalIncomeYen,
  }));

  return (
    <Paper className="paper-panel" data-testid="history-trend-chart" elevation={0}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
          期間推移
        </Typography>
        {isLoading ? (
          <Skeleton
            data-testid="history-trend-chart-loading"
            height={chartHeight}
            variant="rectangular"
          />
        ) : points.length === 0 || !hasData ? (
          <Typography
            color="text.secondary"
            data-testid="history-trend-chart-empty"
            variant="body2"
          >
            期間内の支出・収入データがあると表示されます
          </Typography>
        ) : (
          <>
            <Box
              aria-label="期間推移グラフ"
              data-chart-height={chartHeight}
              role="img"
              sx={{ minWidth: 0, width: "100%" }}
            >
              <BarChart
                axisHighlight={{ x: "band" }}
                borderRadius={6}
                colors={[theme.palette.error.main, theme.palette.success.main]}
                dataset={dataset}
                height={chartHeight}
                hideLegend
                margin={chartMargin}
                onItemClick={(_event, item) => {
                  const point = points[item.dataIndex];
                  if (point !== undefined) {
                    onPointSelect?.(point);
                  }
                }}
                series={[
                  {
                    dataKey: "expense",
                    label: "支出",
                    valueFormatter: (value: number | null) => formatYenCompact(value ?? 0),
                  },
                  {
                    dataKey: "income",
                    label: "収入",
                    valueFormatter: (value: number | null) => formatYenCompact(value ?? 0),
                  },
                ]}
                skipAnimation
                xAxis={[{ dataKey: "label", scaleType: "band" }]}
                yAxis={[
                  {
                    valueFormatter: (value: number | null) => formatYenCompact(value ?? 0),
                    width: isCompact ? 62 : 56,
                  },
                ]}
              />
            </Box>
            <Stack aria-label="期間推移の凡例" direction="row" spacing={2} useFlexGap>
              <Typography color="error.main" variant="caption">
                支出
              </Typography>
              <Typography color="success.main" variant="caption">
                収入
              </Typography>
            </Stack>
            {onPointSelect ? (
              <Typography color="text.secondary" variant="caption">
                グラフをクリックすると、その期間で絞り込めます
              </Typography>
            ) : null}
          </>
        )}
      </Box>
    </Paper>
  );
}
