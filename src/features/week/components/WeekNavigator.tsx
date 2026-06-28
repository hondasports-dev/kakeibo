import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Button, Stack, Typography } from "@mui/material";
import { formatWeekPeriod } from "../lib/weekNavigation";

type WeekNavigatorProps = {
  weekStartDate: string;
  weekEndDate: string;
  isCurrentWeek: boolean;
  compactOnMobile?: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};

export function WeekNavigator({
  weekStartDate,
  weekEndDate,
  isCurrentWeek,
  compactOnMobile = false,
  onPreviousWeek,
  onNextWeek,
}: WeekNavigatorProps) {
  return (
    <Stack
      className={compactOnMobile ? "week-navigator week-navigator--compact" : "week-navigator"}
      direction={compactOnMobile ? "row" : { xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        alignItems: compactOnMobile ? "center" : { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
      }}
    >
      <Button
        aria-label="前の週へ"
        onClick={onPreviousWeek}
        startIcon={compactOnMobile ? <ChevronLeftIcon /> : undefined}
        sx={compactOnMobile ? { minWidth: { xs: 44, sm: 112 }, px: { xs: 1, sm: 2 } } : undefined}
        variant="outlined"
      >
        <Box component="span" sx={compactOnMobile ? { display: { xs: "none", sm: "inline" } } : {}}>
          前の週へ
        </Box>
      </Button>
      <Typography component="p" sx={{ fontWeight: 700, textAlign: "center" }}>
        {formatWeekPeriod(weekStartDate, weekEndDate)}
      </Typography>
      <Button
        aria-label="次の週へ"
        disabled={isCurrentWeek}
        endIcon={compactOnMobile ? <ChevronRightIcon /> : undefined}
        onClick={onNextWeek}
        sx={compactOnMobile ? { minWidth: { xs: 44, sm: 112 }, px: { xs: 1, sm: 2 } } : undefined}
        variant="outlined"
      >
        <Box component="span" sx={compactOnMobile ? { display: { xs: "none", sm: "inline" } } : {}}>
          次の週へ
        </Box>
      </Button>
    </Stack>
  );
}
