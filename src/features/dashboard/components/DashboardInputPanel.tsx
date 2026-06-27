import { Link } from "react-router-dom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Box, Button, Chip, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { AnimatedCounter } from "../../ui";

type DashboardInputPanelProps = {
  count: number;
  status: "draft" | "completed";
  weekStartDate: string;
};

export function DashboardInputPanel({ count, status, weekStartDate }: DashboardInputPanelProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const isCompleted = status === "completed";
  const primaryLabel = isCompleted
    ? "今週のサマリーを見る"
    : count === 0
      ? "今週の入力を開始"
      : "入力を再開";
  const primaryHref = isCompleted ? `/weeks/${weekStartDate}` : "/weeks/current/input";

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography component="h2" variant="h6">
              今週の入力
            </Typography>
            <Chip
              color={isCompleted ? "success" : "primary"}
              label={isCompleted ? "完了済み" : "入力中"}
              size="small"
              variant={isCompleted ? "filled" : "outlined"}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography color="text.secondary" variant="body2">
              入力状況
            </Typography>
            <Typography sx={{ fontWeight: 700 }} variant="h5">
              <AnimatedCounter value={count} suffix=" 件入力済み" />
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            <Button
              component={Link}
              size="large"
              sx={{ minHeight: 44 }}
              to={primaryHref}
              variant="contained"
            >
              {primaryLabel}
            </Button>
            {!isCompact && !isCompleted && (
              <Button
                component={Link}
                size="large"
                startIcon={<EditOutlinedIcon />}
                sx={{ minHeight: 44 }}
                to="/weeks/current/input"
                variant="outlined"
              >
                新しく入力する
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}
