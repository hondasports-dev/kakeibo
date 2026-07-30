import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { formatYen } from "../../../utils/currency";
import type { DailySpendingPulse } from "../utils/dailySpendingPulse";

type SpendingPulseCardProps = {
  isLoading?: boolean;
  pulse?: DailySpendingPulse;
};

function formatDayLabel(date: string, label: string): string {
  const [, , month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return `${Number(month)}/${Number(day)}（${label}）`;
}

export function SpendingPulseCard({ isLoading = false, pulse }: SpendingPulseCardProps) {
  if (isLoading || pulse === undefined) {
    return (
      <Paper
        className="paper-panel dashboard-spending-pulse"
        data-testid="dashboard-spending-pulse-loading"
        elevation={0}
      >
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography component="h2" sx={{ mb: 1.5 }} variant="h6">
            曜日別の支出リズム
          </Typography>
          <Skeleton height={112} variant="rectangular" />
        </Box>
      </Paper>
    );
  }

  const hasSpending = pulse.totalAmountYen > 0;

  return (
    <Paper
      className="paper-panel dashboard-spending-pulse"
      data-testid="dashboard-spending-pulse"
      elevation={0}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "baseline" }, justifyContent: "space-between", mb: 2 }}
        >
          <Typography component="h2" variant="h6">
            曜日別の支出リズム
          </Typography>
          {hasSpending && (
            <Typography color="text.secondary" variant="body2">
              支出のある日 {pulse.activeDayCount}日
            </Typography>
          )}
        </Stack>

        {!hasSpending ? (
          <Typography color="text.secondary" variant="body2">
            入力すると、曜日ごとの支出リズムが見えてきます。
          </Typography>
        ) : (
          <>
            <Box aria-label="曜日別の支出" className="dashboard-spending-pulse-days" component="ul">
              {pulse.days.map((day) => {
                const heightPercent =
                  pulse.maxAmountYen > 0
                    ? Math.max(
                        (day.amountYen / pulse.maxAmountYen) * 100,
                        day.amountYen > 0 ? 8 : 0,
                      )
                    : 0;
                const ariaLabel = `${formatDayLabel(day.date, day.label)}、${formatYen(day.amountYen)}${day.isToday ? "、今日" : day.isFuture ? "、これから" : ""}`;
                return (
                  <Box
                    aria-label={ariaLabel}
                    className={`dashboard-spending-pulse-day${day.isToday ? " dashboard-spending-pulse-day--today" : ""}${day.isFuture ? " dashboard-spending-pulse-day--future" : ""}`}
                    component="li"
                    key={day.date}
                    title={ariaLabel}
                  >
                    <Box className="dashboard-spending-pulse-track">
                      <Box
                        className="dashboard-spending-pulse-bar"
                        sx={{ height: `${heightPercent}%` }}
                      />
                    </Box>
                    <Typography className="dashboard-spending-pulse-day-label" variant="caption">
                      {day.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "baseline", justifyContent: "space-between", mt: 1.5 }}
            >
              <Typography color="text.secondary" variant="caption">
                月〜日
              </Typography>
              <Typography sx={{ fontWeight: 700 }} variant="body2">
                週合計 {formatYen(pulse.totalAmountYen)}
              </Typography>
            </Stack>
          </>
        )}
      </Box>
    </Paper>
  );
}
