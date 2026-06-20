import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type DailyData = {
  date: string;
  totalAmountYen: number;
};

type WeeklyTrendChartProps = {
  currentWeek?: DailyData[];
  previousWeek?: DailyData[];
  /** true の場合は Skeleton を表示する（クエリロード中） */
  isLoading?: boolean;
  /** データポイントクリック時のコールバック */
  onPointClick?: (date: string) => void;
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function hasData(week?: DailyData[]): boolean {
  return (week ?? []).some((d) => d.totalAmountYen > 0);
}

export function WeeklyTrendChart({
  currentWeek = [],
  previousWeek = [],
  isLoading = false,
  onPointClick,
}: WeeklyTrendChartProps) {
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

  if (!hasData(currentWeek) && !hasData(previousWeek)) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            週別支出推移
          </Typography>
          <Typography color="text.secondary" variant="body2">
            今週または前週の支出データがあると表示されます
          </Typography>
        </Box>
      </Paper>
    );
  }

  // SVGレイアウト定数
  const svgWidth = 320;
  const chartHeight = 120;
  const paddingTop = 8;
  const paddingBottom = 40; // X軸ラベル用
  const paddingLeft = 40; // Y軸ラベル用
  const paddingRight = 16;
  const totalSvgHeight = chartHeight + paddingTop + paddingBottom;
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  const allAmounts = [...currentWeek, ...previousWeek].map((d) => d.totalAmountYen);
  const maxAmount = Math.max(...allAmounts, 1);

  const currentColor = theme.palette.primary.main;
  const previousColor = theme.palette.text.secondary;

  function getPoints(week: DailyData[]): string {
    if (week.length === 0) return "";
    return week
      .map((d, i) => {
        const x = paddingLeft + (i / 6) * chartWidth;
        const y = paddingTop + chartHeight - (d.totalAmountYen / maxAmount) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
          週別支出推移
        </Typography>
        <Box>
          <svg
            aria-label="週別支出推移グラフ"
            height="auto"
            role="img"
            style={{ display: "block" }}
            viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`}
            width="100%"
          >
            {/* 今週の折れ線 */}
            {hasData(currentWeek) && (
              <polyline
                fill="none"
                points={getPoints(currentWeek)}
                stroke={currentColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            )}
            {/* 前週の折れ線 */}
            {hasData(previousWeek) && (
              <polyline
                fill="none"
                points={getPoints(previousWeek)}
                stroke={previousColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
                strokeWidth={2}
              />
            )}
            {/* データポイント（今週） */}
            {currentWeek.map((d, i) => {
              const x = paddingLeft + (i / 6) * chartWidth;
              const y = paddingTop + chartHeight - (d.totalAmountYen / maxAmount) * chartHeight;
              return (
                <g key={`current-${d.date}`}>
                  <circle
                    cx={x}
                    cy={y}
                    fill={currentColor}
                    onClick={() => onPointClick?.(d.date)}
                    r={4}
                    style={{ cursor: onPointClick ? "pointer" : "default" }}
                  />
                </g>
              );
            })}
            {/* データポイント（前週） */}
            {previousWeek.map((d, i) => {
              const x = paddingLeft + (i / 6) * chartWidth;
              const y = paddingTop + chartHeight - (d.totalAmountYen / maxAmount) * chartHeight;
              return (
                <g key={`previous-${d.date}`}>
                  <circle
                    cx={x}
                    cy={y}
                    fill={previousColor}
                    onClick={() => onPointClick?.(d.date)}
                    r={4}
                    style={{ cursor: onPointClick ? "pointer" : "default" }}
                  />
                </g>
              );
            })}
            {/* X軸ラベル */}
            {(currentWeek.length > 0 ? currentWeek : previousWeek).map((d, i) => {
              const x = paddingLeft + (i / 6) * chartWidth;
              return (
                <text
                  key={`label-${d.date}`}
                  dominantBaseline="hanging"
                  fill={theme.palette.text.secondary}
                  fontSize="10"
                  textAnchor="middle"
                  x={x}
                  y={paddingTop + chartHeight + 6}
                >
                  {formatDayLabel(d.date)}
                </text>
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
            {/* 凡例 */}
            <g transform={`translate(${paddingLeft}, 2)`}>
              <rect fill={currentColor} height={8} rx={2} width={16} x={0} y={0} />
              <text
                dominantBaseline="middle"
                fill={theme.palette.text.primary}
                fontSize="10"
                x={22}
                y={4}
              >
                今週
              </text>
              <rect
                fill="none"
                height={8}
                rx={2}
                stroke={previousColor}
                strokeDasharray="4 2"
                strokeWidth={1}
                width={16}
                x={60}
                y={0}
              />
              <text
                dominantBaseline="middle"
                fill={theme.palette.text.primary}
                fontSize="10"
                x={82}
                y={4}
              >
                前週
              </text>
            </g>
          </svg>
        </Box>
      </Box>
    </Paper>
  );
}
