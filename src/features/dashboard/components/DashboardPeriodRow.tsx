import { Link } from "react-router-dom";
import { Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { formatAggregationPeriod } from "../utils/formatAggregationPeriod";

type DashboardPeriodRowProps = {
  showSummaryLink?: boolean;
  weekEndDate: string;
  weekStartDate: string;
};

export function DashboardPeriodRow({
  showSummaryLink = true,
  weekEndDate,
  weekStartDate,
}: DashboardPeriodRowProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Stack
      direction={isCompact ? "column" : "row"}
      spacing={1}
      sx={{ alignItems: isCompact ? "flex-start" : "center", justifyContent: "space-between" }}
    >
      <Typography color="text.secondary" variant="body2">
        {formatAggregationPeriod(weekStartDate, weekEndDate)}
      </Typography>
      {showSummaryLink && (
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
      )}
    </Stack>
  );
}
