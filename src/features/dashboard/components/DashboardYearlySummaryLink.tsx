import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Button } from "@mui/material";
import { Link } from "react-router-dom";

export function DashboardYearlySummaryLink({ year }: { year: string }) {
  return (
    <Button
      component={Link}
      endIcon={<ChevronRightIcon />}
      fullWidth
      sx={{ minHeight: 44 }}
      to={`/years/${year}`}
      variant="outlined"
    >
      今年の年次サマリーを見る
    </Button>
  );
}
