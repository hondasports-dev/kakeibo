import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";

type WeekStatusPanelProps = {
  count: number;
};

export function WeekStatusPanel({ count }: WeekStatusPanelProps) {
  const progressValue = Math.min((count / 10) * 100, 100);

  return (
    <Stack spacing={2.5}>
      {/* 今週の進捗 */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography component="h2" variant="h6">
                今週の進捗
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {count} 件
              </Typography>
            </Stack>
            <LinearProgress
              aria-label="今週の入力進捗"
              value={progressValue}
              variant="determinate"
            />
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
