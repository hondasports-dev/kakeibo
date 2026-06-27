import type { ReactNode } from "react";
import { Box, Paper, Skeleton, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { AnimatedCounter } from "../../ui";
import { calcPrevWeekRate, formatPrevWeekRate } from "../utils/weekComparison";

type DashboardSummaryRowProps = {
  count: number;
  currentTotalAmountYen: number;
  isLoading?: boolean;
  prevWeekTotalAmountYen: number | null;
};

function PrevWeekRateDisplay({
  currentTotalAmountYen,
  isLoading,
  prevWeekTotalAmountYen,
}: {
  currentTotalAmountYen: number;
  isLoading: boolean;
  prevWeekTotalAmountYen: number | null;
}) {
  const rate = calcPrevWeekRate(currentTotalAmountYen, prevWeekTotalAmountYen);
  const isIncrease = rate !== null && rate > 0;
  const isDecrease = rate !== null && rate < 0;
  const valueColor = isIncrease ? "error.main" : isDecrease ? "success.main" : "text.secondary";

  return (
    <Stack aria-label="前週比" spacing={0.5}>
      <Typography color="text.secondary" variant="caption">
        前週比
      </Typography>
      {isLoading ? (
        <Skeleton height={36} variant="text" width={80} />
      ) : (
        <Typography sx={{ color: valueColor, fontWeight: 700 }} variant="h5">
          {formatPrevWeekRate(rate)}
        </Typography>
      )}
    </Stack>
  );
}

function MetricCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={0.5}>
          <Typography color="text.secondary" variant="caption">
            {label}
          </Typography>
          {children}
        </Stack>
      </Box>
    </Paper>
  );
}

export function DashboardSummaryRow({
  count,
  currentTotalAmountYen,
  isLoading = false,
  prevWeekTotalAmountYen,
}: DashboardSummaryRowProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  if (isCompact) {
    return (
      <Stack spacing={1.5}>
        <MetricCard label="今週の支出">
          {isLoading ? (
            <Skeleton height={40} variant="text" />
          ) : (
            <Typography variant="h4">
              <AnimatedCounter value={currentTotalAmountYen} suffix="円" />
            </Typography>
          )}
        </MetricCard>
        <Box className="summary-grid">
          <MetricCard label="入力済み">
            {isLoading ? (
              <Skeleton height={36} variant="text" />
            ) : (
              <Typography sx={{ fontWeight: 700 }} variant="h5">
                <AnimatedCounter value={count} suffix="件" />
              </Typography>
            )}
          </MetricCard>
          <Paper className="paper-panel" elevation={0}>
            <Box sx={{ p: 2.5 }}>
              <PrevWeekRateDisplay
                currentTotalAmountYen={currentTotalAmountYen}
                isLoading={isLoading}
                prevWeekTotalAmountYen={prevWeekTotalAmountYen}
              />
            </Box>
          </Paper>
        </Box>
      </Stack>
    );
  }

  return (
    <Box className="summary-grid">
      <MetricCard label="今週の支出">
        {isLoading ? (
          <Skeleton height={40} variant="text" />
        ) : (
          <Typography variant="h4">
            <AnimatedCounter value={currentTotalAmountYen} suffix="円" />
          </Typography>
        )}
      </MetricCard>
      <MetricCard label="入力済み">
        {isLoading ? (
          <Skeleton height={36} variant="text" />
        ) : (
          <Typography sx={{ fontWeight: 700 }} variant="h5">
            <AnimatedCounter value={count} suffix="件" />
          </Typography>
        )}
      </MetricCard>
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <PrevWeekRateDisplay
            currentTotalAmountYen={currentTotalAmountYen}
            isLoading={isLoading}
            prevWeekTotalAmountYen={prevWeekTotalAmountYen}
          />
        </Box>
      </Paper>
    </Box>
  );
}
