import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, Divider, Paper, Skeleton, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { AnimatedCounter } from "../../ui";
import { formatAggregationPeriod } from "../utils/formatAggregationPeriod";
import { calcPrevWeekRate, formatPrevWeekRateWithArrow } from "../utils/weekComparison";

type DashboardSummaryRowProps = {
  count: number;
  currentTotalAmountYen: number;
  isLoading?: boolean;
  prevWeekTotalAmountYen: number | null;
  weekEndDate: string;
  weekStartDate: string;
};

function PrevWeekRateDisplay({
  currentTotalAmountYen,
  isLoading,
  prevWeekTotalAmountYen,
  valueVariant = "h5",
}: {
  currentTotalAmountYen: number;
  isLoading: boolean;
  prevWeekTotalAmountYen: number | null;
  valueVariant?: "h4" | "h5";
}) {
  const rate = calcPrevWeekRate(currentTotalAmountYen, prevWeekTotalAmountYen);
  const isIncrease = rate !== null && rate > 0;
  const isDecrease = rate !== null && rate < 0;
  const valueColor = isIncrease ? "error.main" : isDecrease ? "success.main" : "text.secondary";

  return (
    <Stack aria-label="前週比" className="dashboard-summary-metric" spacing={0.75}>
      <Typography color="text.secondary" variant="body2">
        前週比
      </Typography>
      {isLoading ? (
        <Skeleton height={36} variant="text" width={80} />
      ) : (
        <Typography sx={{ color: valueColor, fontWeight: 700 }} variant={valueVariant}>
          {formatPrevWeekRateWithArrow(rate)}
        </Typography>
      )}
    </Stack>
  );
}

function MetricBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Stack className="dashboard-summary-metric" spacing={0.75}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function SummaryFooter({
  weekEndDate,
  weekStartDate,
}: {
  weekEndDate: string;
  weekStartDate: string;
}) {
  return (
    <>
      <Divider sx={{ borderColor: "var(--color-border-subtle)" }} />
      <Stack
        className="dashboard-summary-footer"
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <CalendarTodayOutlinedIcon color="action" sx={{ fontSize: 18 }} />
          <Typography color="text.secondary" variant="body2">
            {formatAggregationPeriod(weekStartDate, weekEndDate)}
          </Typography>
        </Stack>
        <Typography
          component={Link}
          sx={{
            color: "primary.main",
            fontWeight: 700,
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
          to={`/weeks/${weekStartDate}`}
          variant="body2"
        >
          今週のサマリーを見る ›
        </Typography>
      </Stack>
    </>
  );
}

export function DashboardSummaryRow({
  count,
  currentTotalAmountYen,
  isLoading = false,
  prevWeekTotalAmountYen,
  weekEndDate,
  weekStartDate,
}: DashboardSummaryRowProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  if (isCompact) {
    return (
      <Paper className="paper-panel dashboard-summary-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <MetricBlock label="今週の支出">
              {isLoading ? (
                <Skeleton height={44} variant="text" />
              ) : (
                <Typography sx={{ color: "primary.main", fontWeight: 700 }} variant="h4">
                  <AnimatedCounter value={currentTotalAmountYen} suffix="円" />
                </Typography>
              )}
            </MetricBlock>

            <Divider sx={{ borderColor: "var(--color-border-subtle)" }} />

            <Stack
              className="dashboard-summary-submetrics"
              direction="row"
              divider={
                <Divider
                  flexItem
                  orientation="vertical"
                  sx={{ borderColor: "var(--color-border-subtle)" }}
                />
              }
              spacing={2}
            >
              <MetricBlock label="入力済み">
                {isLoading ? (
                  <Skeleton height={32} variant="text" />
                ) : (
                  <Typography sx={{ fontWeight: 700 }} variant="h5">
                    <AnimatedCounter value={count} suffix="件" />
                  </Typography>
                )}
              </MetricBlock>
              <PrevWeekRateDisplay
                currentTotalAmountYen={currentTotalAmountYen}
                isLoading={isLoading}
                prevWeekTotalAmountYen={prevWeekTotalAmountYen}
              />
            </Stack>
          </Stack>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper className="paper-panel dashboard-summary-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack
            className="dashboard-summary-metrics"
            direction="row"
            divider={
              <Divider
                flexItem
                orientation="vertical"
                sx={{ borderColor: "var(--color-border-subtle)" }}
              />
            }
            spacing={3}
          >
            <MetricBlock label="今週の支出">
              {isLoading ? (
                <Skeleton height={44} variant="text" />
              ) : (
                <Typography sx={{ fontWeight: 700 }} variant="h4">
                  <AnimatedCounter value={currentTotalAmountYen} suffix="円" />
                </Typography>
              )}
            </MetricBlock>
            <MetricBlock label="入力済み">
              {isLoading ? (
                <Skeleton height={36} variant="text" />
              ) : (
                <Typography sx={{ fontWeight: 700 }} variant="h4">
                  <AnimatedCounter value={count} suffix=" 件" />
                </Typography>
              )}
            </MetricBlock>
            <PrevWeekRateDisplay
              currentTotalAmountYen={currentTotalAmountYen}
              isLoading={isLoading}
              prevWeekTotalAmountYen={prevWeekTotalAmountYen}
              valueVariant="h4"
            />
          </Stack>

          <SummaryFooter weekEndDate={weekEndDate} weekStartDate={weekStartDate} />
        </Stack>
      </Box>
    </Paper>
  );
}
