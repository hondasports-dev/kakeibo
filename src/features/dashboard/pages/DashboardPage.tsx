import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import { useWeekSession } from "../hooks/useWeekSession";
import { AnimatedCounter, SuzumemoLoadingState } from "../../ui";

export function DashboardPage() {
  const { weekSession, sessionError } = useWeekSession();
  const navigate = useNavigate();

  const currentWeekSummary = useQuery(
    api.receipts.getWeekSummary,
    weekSession ? { weekStartDate: weekSession.weekStartDate } : "skip",
  );

  if (!weekSession && !sessionError) {
    return (
      <SuzumemoLoadingState
        label="データを読み込み中"
        message="今週のセッションを準備しています…"
        variant="page"
      />
    );
  }

  if (sessionError || !weekSession) {
    return (
      <Box className="app-main">
        <Alert severity="error" variant="outlined">
          {sessionError || "週次セッションの読み込みに失敗しました。"}
        </Alert>
      </Box>
    );
  }

  const { weekStartDate } = weekSession;
  const totalAmountYen = currentWeekSummary?.totalAmountYen ?? 0;

  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography component="h1" variant="h4">
              今週のダッシュボード
            </Typography>
            <Chip
              color={weekSession.status === "completed" ? "success" : "primary"}
              label={weekSession.status === "completed" ? "完了済み" : "入力中"}
              size="small"
              variant={weekSession.status === "completed" ? "filled" : "outlined"}
            />
          </Stack>
        </Box>

        <Box className="summary-grid">
          <Paper className="paper-panel" elevation={0}>
            <Box sx={{ p: 2.5 }}>
              <Stack spacing={1}>
                <Chip color="secondary" label="今週の支出" size="small" />
                <Typography variant="h4">
                  <AnimatedCounter value={totalAmountYen} suffix="円" />
                </Typography>
              </Stack>
            </Box>
          </Paper>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {weekSession.status === "completed" ? (
            <Button
              component={Link}
              to={`/weeks/${weekStartDate}`}
              variant="contained"
              size="large"
            >
              今週のサマリーを見る
            </Button>
          ) : (
            <Button component={Link} to="/weeks/current/input" variant="contained" size="large">
              入力を再開
            </Button>
          )}
          <Button onClick={() => navigate("/weeks/current/input")} variant="outlined" size="large">
            入力画面へ
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
