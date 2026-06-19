import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../convex/_generated/api";
import { WeekNavigator } from "../components/WeekNavigator";
import { WeeklySummaryPanel } from "../features/weekly-summary/components/WeeklySummaryPanel";
import { ReviewMemoPanel } from "../components/ReviewMemoPanel";
import {
  addWeeks,
  getCurrentWeekStartDate,
  getWeekEndDate,
  isFutureWeek,
  normalizeWeekStartDate,
} from "../lib/weekNavigation";

export function SummaryPage() {
  const { weekStartDate: rawWeekStartDate } = useParams<{ weekStartDate: string }>();
  const navigate = useNavigate();

  const currentWeekStartDate = getCurrentWeekStartDate();

  // 正規化: 不正値・未来週は今週にフォールバック
  const normalized = rawWeekStartDate ? normalizeWeekStartDate(rawWeekStartDate) : null;
  const weekStartDate =
    normalized !== null && !isFutureWeek(normalized, currentWeekStartDate)
      ? normalized
      : currentWeekStartDate;

  const weekEndDate = getWeekEndDate(weekStartDate);
  const isCurrentWeek = weekStartDate === currentWeekStartDate;

  // 未来週・不正値 URL は今週の URL に正規化してリダイレクト
  useEffect(() => {
    if (rawWeekStartDate && weekStartDate !== rawWeekStartDate) {
      navigate(`/weeks/${weekStartDate}`, { replace: true });
    }
  }, [rawWeekStartDate, weekStartDate, navigate]);

  const summaryWeekSession = useQuery(api.weekSessions.getWeekSession, { weekStartDate });
  const weeklySummary = useQuery(api.receipts.getWeekSummaryWithCategories, { weekStartDate });
  const dailySpendingTrend = useQuery(api.receipts.getDailySpendingTrend, { weekStartDate });
  const prevWeekStartDate = addWeeks(weekStartDate, -1);
  const prevWeekSummary = useQuery(api.receipts.getWeekSummaryWithCategories, {
    weekStartDate: prevWeekStartDate,
  });

  // 今週のサマリーページでセッションが未作成の場合は自動作成する
  // （InputPage を経由せず SummaryPage に直接アクセスした場合に ReviewMemoPanel が機能するように）
  const getOrCreateSession = useMutation(api.weekSessions.getOrCreateWeekSession);
  useEffect(() => {
    if (isCurrentWeek && summaryWeekSession === null) {
      getOrCreateSession({ weekStartDate }).catch(console.error);
    }
  }, [isCurrentWeek, summaryWeekSession, weekStartDate, getOrCreateSession]);

  const navigateToWeek = (newWeekStartDate: string) => {
    const norm = normalizeWeekStartDate(newWeekStartDate) ?? currentWeekStartDate;
    const target = isFutureWeek(norm, currentWeekStartDate) ? currentWeekStartDate : norm;
    navigate(`/weeks/${target}`);
  };

  if (weeklySummary === undefined) {
    return (
      <Box className="app-main">
        <Stack spacing={3} sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress aria-label="データを読み込み中" />
          <Typography color="text.secondary">週次サマリーを読み込んでいます...</Typography>
        </Stack>
      </Box>
    );
  }

  if (weeklySummary === null) {
    return (
      <Box className="app-main">
        <Alert severity="error" variant="outlined">
          週次サマリーの読み込みに失敗しました。
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Typography component="h1" variant="h4">
          週次サマリー
        </Typography>

        <WeekNavigator
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          isCurrentWeek={isCurrentWeek}
          onPreviousWeek={() => navigateToWeek(addWeeks(weekStartDate, -1))}
          onNextWeek={() => navigateToWeek(addWeeks(weekStartDate, 1))}
        />

        <WeeklySummaryPanel
          count={weeklySummary.count}
          totalAmountYen={weeklySummary.totalAmountYen}
          byCategory={weeklySummary.byCategory}
          prevWeekTotalAmountYen={weeklySummary.prevWeekTotalAmountYen ?? null}
          receipts={weeklySummary.receipts}
          prevWeekReceipts={prevWeekSummary?.receipts ?? []}
          isLoading={false}
          weekStartDate={weekStartDate}
          dailySpendingTrend={dailySpendingTrend ?? null}
        />

        {summaryWeekSession !== undefined &&
          (summaryWeekSession === null && !isCurrentWeek ? (
            // 過去週でセッションが未作成の場合はプレースホルダーを表示
            <Paper className="paper-panel" elevation={0}>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={1}>
                  <Typography component="h2" variant="h5">
                    週次振り返り
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    この週の振り返りメモはまだありません
                  </Typography>
                </Stack>
              </Box>
            </Paper>
          ) : (
            <ReviewMemoPanel
              weekStartDate={weekStartDate}
              weekStatus={summaryWeekSession?.status ?? "draft"}
              reviewMemo={summaryWeekSession?.reviewMemo ?? null}
              totalAmountYen={weeklySummary.totalAmountYen}
              prevWeekTotalAmountYen={weeklySummary.prevWeekTotalAmountYen ?? null}
            />
          ))}
      </Stack>
    </Box>
  );
}
