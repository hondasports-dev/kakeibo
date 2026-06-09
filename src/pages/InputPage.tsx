import { useQuery } from "convex/react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "../../convex/_generated/api";
import { ExpenseEntryForm } from "../components/ExpenseEntryForm";
import { WeekNavigator } from "../components/WeekNavigator";
import { WeekStatusPanel } from "../components/WeekStatusPanel";
import { useInputPageWeek } from "../hooks/useInputPageWeek";

export function InputPage() {
  const {
    weekStartDate,
    weekEndDate,
    weekSession,
    sessionError,
    isLoading,
    isCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
  } = useInputPageWeek();

  const categories = useQuery(api.categories.listActive) ?? [];
  const weekSummary = useQuery(api.receipts.getWeekSummaryWithCategories, { weekStartDate });

  if (isLoading && !weekSession) {
    return (
      <Box className="app-main">
        <Stack spacing={3} sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress aria-label="データを読み込み中" />
          <Typography color="text.secondary">週次セッションを準備しています...</Typography>
        </Stack>
      </Box>
    );
  }

  if (sessionError || (!isLoading && !weekSession)) {
    return (
      <Box className="app-main">
        <Alert severity="error" variant="outlined">
          {sessionError || "週次セッションの読み込みに失敗しました。"}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <WeekNavigator
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          isCurrentWeek={isCurrentWeek}
          onPreviousWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
        />

        <WeekStatusPanel
          receipts={weekSummary?.receipts ?? []}
          isLoading={weekSummary === undefined}
        />

        <ExpenseEntryForm
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          categories={categories}
        />
      </Stack>
    </Box>
  );
}
