import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "../../convex/_generated/api";
import { WeekNavigator } from "../components/WeekNavigator";
import { WeeklySummaryPanel } from "../components/WeeklySummaryPanel";
import {
  addWeeks,
  getWeekEndDate,
  isFutureWeek,
  normalizeWeekStartDate,
} from "../lib/weekNavigation";

function getCurrentWeekStartDate(): string {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return normalizeWeekStartDate(iso) ?? iso;
}

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

  const summaryWeekSession = useQuery(api.weekSessions.getWeekSession, { weekStartDate });
  const weeklySummary = useQuery(api.receipts.getWeekSummaryWithCategories, { weekStartDate });
  const weeklyTrendData = useQuery(api.receipts.getFourWeeksSummary, { weekStartDate });

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
          budgetAmountYen={summaryWeekSession?.budgetAmountYen ?? undefined}
          reviewMemo={summaryWeekSession?.reviewMemo ?? null}
          isLoading={false}
          weeklyTrendData={weeklyTrendData ?? null}
        />
      </Stack>
    </Box>
  );
}
