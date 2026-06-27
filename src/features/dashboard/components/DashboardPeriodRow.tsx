import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import { Stack, Typography } from "@mui/material";
import { formatAggregationPeriod } from "../utils/formatAggregationPeriod";

type DashboardPeriodRowProps = {
  weekEndDate: string;
  weekStartDate: string;
};

export function DashboardPeriodRow({ weekEndDate, weekStartDate }: DashboardPeriodRowProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <CalendarTodayOutlinedIcon color="action" sx={{ fontSize: 18 }} />
      <Typography color="text.secondary" variant="body2">
        {formatAggregationPeriod(weekStartDate, weekEndDate)}
      </Typography>
    </Stack>
  );
}
