import { Button, Stack, Typography } from "@mui/material";

type WeekNavigatorProps = {
  weekStartDate: string;
  weekEndDate: string;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};

function formatWeekPeriod(weekStartDate: string, weekEndDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00`);
  const end = new Date(`${weekEndDate}T00:00:00`);

  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${
    end.getMonth() + 1
  }月${end.getDate()}日`;
}

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
