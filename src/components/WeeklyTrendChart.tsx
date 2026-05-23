import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type WeekData = {
  weekStartDate: string;
  totalAmountYen: number;
};

type WeeklyTrendChartProps = {
  weeks?: WeekData[];
  /** データが存在する週の数。2未満の場合はプレースホルダーを表示する */
  weekCount?: number;
  /** true の場合は Skeleton を表示する（クエリロード中） */
  isLoading?: boolean;
};

function formatWeekLabel(weekStartDate: string): string {
  const d = new Date(weekStartDate + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}〜`;
}

export function WeeklyTrendChart({ weeks = [], weekCount = 0, isLoading = false }: WeeklyTrendChartProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            週別支出推移
          </Typography>
          <Skeleton variant="rectangular" height={168} />
        </Box>
      </Paper>
    );
  }

  if (weekCount < 2) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            週別支出推移
          </Typography>
          <Typography color="text.secondary" variant="body2">
            2週以上のデータが揃うとグラフが表示されます
          </Typography>
        </Box>
      </Paper>
    );
  }

  const maxAmount = Math.max(...weeks.map((w) => w.totalAmountYen), 1);

  // SVGレイアウト定数
  const svgWidth = 320;
  const chartHeight = 120;
  const paddingTop = 8;
  const paddingBottom = 40; // X軸ラベル用
  const paddingLeft = 8;
  const paddingRight = 8;
  const totalSvgHeight = chartHeight + paddingTop + paddingBottom;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const barAreaWidth = chartWidth / weeks.length;
  const barWidth = barAreaWidth * 0.6;
  const barOffset = barAreaWidth * 0.2; // バーを中央寄せ
  const primaryColor = theme.palette.primary.main;
  const labelOffset = 14; // バー上部の金額ラベルのオフセット

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
          週別支出推移
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <svg
            aria-label="週別支出推移グラフ"
            height={totalSvgHeight}
            role="img"
            style={{ display: "block" }}
            width={svgWidth}
          >
            {/* バーと金額ラベル */}
            {weeks.map((week, idx) => {
              const barHeight =
                week.totalAmountYen > 0
                  ? Math.max((week.totalAmountYen / maxAmount) * chartHeight, 2)
                  : 0;
              const x = paddingLeft + idx * barAreaWidth + barOffset;
              const y = paddingTop + chartHeight - barHeight;
              const labelY = y - 4;
              const labelX = x + barWidth / 2;

              return (
                <g key={week.weekStartDate}>
                  {/* バー */}
                  <rect
                    fill={primaryColor}
                    height={Math.max(barHeight, 0)}
                    rx={3}
                    width={barWidth}
                    x={x}
                    y={y}
                  />
                  {/* バー上部の金額ラベル */}
                  <text
                    dominantBaseline="auto"
                    fill={theme.palette.text.primary}
                    fontSize="10"
                    textAnchor="middle"
                    x={labelX}
                    y={labelY > paddingTop + labelOffset ? labelY : paddingTop + labelOffset}
                  >
                    {week.totalAmountYen.toLocaleString()}円
                  </text>
                  {/* X軸ラベル（週開始日） */}
                  <text
                    dominantBaseline="hanging"
                    fill={theme.palette.text.secondary}
                    fontSize="10"
                    textAnchor="middle"
                    x={labelX}
                    y={paddingTop + chartHeight + 6}
                  >
                    {formatWeekLabel(week.weekStartDate)}
                  </text>
                </g>
              );
            })}
            {/* X軸ベースライン */}
            <line
              stroke={theme.palette.divider}
              strokeWidth={1}
              x1={paddingLeft}
              x2={svgWidth - paddingRight}
              y1={paddingTop + chartHeight}
              y2={paddingTop + chartHeight}
            />
          </svg>
        </Box>
      </Box>
    </Paper>
  );
}
