import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";

type DashboardSummaryLinkProps = {
  weekStartDate: string;
};

export function DashboardSummaryLink({ weekStartDate }: DashboardSummaryLinkProps) {
  return (
    <Button
      component={Link}
      endIcon={<ChevronRightIcon />}
      fullWidth
      sx={{ minHeight: 44 }}
      to={`/weeks/${weekStartDate}`}
      variant="outlined"
    >
      今週のサマリーを見る
    </Button>
  );
}
