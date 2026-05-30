import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../../convex/_generated/api";
import { useWeekSession } from "../hooks/useWeekSession";
import { AnimatedCounter } from "../components/AnimatedCounter";

export function DashboardPage() {
  const { weekSession, sessionError } = useWeekSession();
  const navigate = useNavigate();

  const currentWeekSummary = useQuery(
    api.receipts.getWeekSummary,
    weekSession ? { weekStartDate: weekSession.weekStartDate } : "skip",
  );

  const now = new Date();
  const currentMonthStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyExpensesSummary = useQuery(
    api.receipts.getMonthlyExpensesSummary,
    weekSession ? { monthStartDate: currentMonthStartDate } : "skip",
  );

  if (!weekSession && !sessionError) {
    return (
      <Box className="app-main">
        <Stack spacing={3} sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress aria-label="データを読み込み中" />
          <Typography color="text.secondary">今週のセッションを準備しています...</Typography>
        </Stack>
      </Box>
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
  const budgetAmountYen = weekSession.budgetAmountYen;
  const budgetRemaining =
    budgetAmountYen !== undefined ? budgetAmountYen - totalAmountYen : undefined;

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
          {[
            {
              label: "今週の支出",
              value: <AnimatedCounter value={totalAmountYen} suffix="円" />,
              helper:
                budgetAmountYen !== undefined
                  ? `予算 ${budgetAmountYen.toLocaleString()}円`
                  : "予算未設定",
              tone: "secondary" as const,
            },
            {
              label: "予算残り",
              value:
                budgetRemaining !== undefined ? (
                  <AnimatedCounter value={budgetRemaining} suffix="円" />
                ) : (
                  "--"
                ),
              helper:
                budgetRemaining !== undefined && budgetAmountYen
                  ? `${Math.round((budgetRemaining / budgetAmountYen) * 100)}% 残り`
                  : "",
              tone: "success" as const,
            },
            {
              label: "今月の残金",
              value:
                monthlyExpensesSummary?.remainingBalanceYen != null ? (
                  <AnimatedCounter value={monthlyExpensesSummary.remainingBalanceYen} suffix="円" />
                ) : (
                  "--"
                ),
              helper:
                monthlyExpensesSummary?.monthlyIncome != null
                  ? `月収入 ${monthlyExpensesSummary.monthlyIncome.toLocaleString()}円`
                  : "",
              tone:
                monthlyExpensesSummary?.remainingBalanceYen != null &&
                monthlyExpensesSummary.remainingBalanceYen < 0
                  ? ("error" as const)
                  : ("default" as const),
            },
          ].map((item) => (
            <Paper className="paper-panel" elevation={0} key={item.label}>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={1}>
                  <Chip color={item.tone} label={item.label} size="small" />
                  <Typography variant="h4">{item.value}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {item.helper}
                  </Typography>
                </Stack>
              </Box>
            </Paper>
          ))}
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
