import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { AnimatedCounter } from "../../ui";
import { PreviousWeekComparison } from "./PreviousWeekComparison";

export function TotalSummaryCard({
  isLoading,
  prevWeekTotalAmountYen,
  totalAmountYen,
}: {
  isLoading: boolean;
  prevWeekTotalAmountYen: number | null;
  totalAmountYen: number;
}) {
  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            週次サマリー
          </Typography>

          {isLoading ? (
            <>
              <Skeleton variant="text" height={40} />
              <Skeleton variant="text" height={24} />
              <Skeleton variant="text" height={24} />
            </>
          ) : (
            <>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "baseline" }}
              >
                <Typography color="text.secondary" variant="body2">
                  合計支出
                </Typography>
                <Typography variant="h5">
                  <AnimatedCounter value={totalAmountYen} suffix="円" />
                </Typography>
              </Stack>

              <PreviousWeekComparison
                currentTotalAmountYen={totalAmountYen}
                prevWeekTotalAmountYen={prevWeekTotalAmountYen}
              />
            </>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
