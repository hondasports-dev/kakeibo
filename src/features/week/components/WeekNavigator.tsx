import { Button, Stack, Typography } from "@mui/material";
import { formatWeekPeriod } from "../lib/weekNavigation";

type WeekNavigatorProps = {
  weekStartDate: string;
  weekEndDate: string;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};

export function WeekNavigator({
  weekStartDate,
  weekEndDate,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
}: WeekNavigatorProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
      }}
    >
      <Button onClick={onPreviousWeek} variant="outlined">
        前の週へ
      </Button>
      <Typography component="p" sx={{ fontWeight: 700, textAlign: "center" }}>
        {formatWeekPeriod(weekStartDate, weekEndDate)}
      </Typography>
      <Button disabled={isCurrentWeek} onClick={onNextWeek} variant="outlined">
        次の週へ
      </Button>
    </Stack>
  );
}
