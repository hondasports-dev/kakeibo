import { Link } from "react-router-dom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
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

  if (isCompact) {
    return (
      <Paper
        className="paper-panel dashboard-input-panel dashboard-input-panel--compact"
        elevation={0}
      >
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <TaskAltIcon color="success" sx={{ fontSize: 28 }} />
              <Typography sx={{ fontWeight: 700 }} variant="h5">
                <AnimatedCounter value={count} suffix=" 件入力済み" />
              </Typography>
            </Stack>
            <Button
              component={Link}
              fullWidth
              size="large"
              sx={{ minHeight: 44 }}
              to={primaryHref}
              variant="contained"
            >
              {primaryLabel}
            </Button>
          </Stack>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper className="paper-panel dashboard-input-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            今週の入力
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography color="text.secondary" variant="body2">
              入力状況
            </Typography>
            <Chip
              color={isCompleted ? "success" : "warning"}
              label={isCompleted ? "完了済み" : "● 入力中"}
              size="small"
              variant={isCompleted ? "filled" : "outlined"}
            />
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <TaskAltIcon color="success" sx={{ fontSize: 28 }} />
            <Typography sx={{ fontWeight: 700 }} variant="h4">
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
            {!isCompleted && (
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
