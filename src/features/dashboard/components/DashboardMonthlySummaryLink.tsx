import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Button } from "@mui/material";
import { Link } from "react-router-dom";

export function DashboardMonthlySummaryLink({ month }: { month: string }) {
  return (
    <Button
      component={Link}
      endIcon={<ChevronRightIcon />}
      fullWidth
      sx={{ minHeight: 44 }}
      to={`/months/${month}`}
      variant="outlined"
    >
      今月の月次サマリーを見る
    </Button>
  );
}
