import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Alert, Box, Chip, Snackbar, Stack, Typography } from "@mui/material";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { WeekNavigator } from "../../week";
import { WeeklySummaryPanel } from "../components/WeeklySummaryPanel";
import { ExpenseEntryDeleteDialog } from "../components/ExpenseEntryDeleteDialog";
import { ExpenseEntryEditDialog } from "../components/ExpenseEntryEditDialog";
import { SuzumemoLoadingState } from "../../ui";
import type { ReceiptItem } from "../types/types";
import { buildWeeklyExpenseChartData } from "../utils/weeklyExpenseChartData";
import {
  addWeeks,
  getCurrentWeekStartDate,
  getWeekEndDate,
  isFutureWeek,
  normalizeWeekStartDate,
} from "../../week";

export function SummaryPage() {
  const { weekStartDate: rawWeekStartDate } = useParams<{ weekStartDate: string }>();
  const navigate = useNavigate();
  const [editingReceipt, setEditingReceipt] = useState<ReceiptItem | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<ReceiptItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const deleteExpenseEntry = useMutation(api.expenseEntries.mutations.deleteExpenseEntry);
  const deleteReceipt = useMutation(api.receipts.crud.deleteReceipt);
  const categoriesQuery = useQuery(api.categories.queries.listActive);
  const categories = Array.isArray(categoriesQuery) ? categoriesQuery : [];

  const currentWeekStartDate = getCurrentWeekStartDate();

  const normalized = rawWeekStartDate ? normalizeWeekStartDate(rawWeekStartDate) : null;
  const weekStartDate =
    normalized !== null && !isFutureWeek(normalized, currentWeekStartDate)
      ? normalized
      : currentWeekStartDate;

  const weekEndDate = getWeekEndDate(weekStartDate);
  const isCurrentWeek = weekStartDate === currentWeekStartDate;

  useEffect(() => {
    if (rawWeekStartDate && weekStartDate !== rawWeekStartDate) {
      navigate(`/weeks/${weekStartDate}`, { replace: true });
    }
  }, [rawWeekStartDate, weekStartDate, navigate]);

  const weeklySummary = useQuery(api.receipts.summaries.getWeekSummaryWithCategories, {
    weekStartDate,
  });
  const weekSession = useQuery(api.weekSessions.queries.getWeekSession, { weekStartDate });
  const fourWeeksSummary = useQuery(api.receipts.summaries.getFourWeeksSummary, { weekStartDate });
  const weeklyExpenseTrend =
    fourWeeksSummary !== undefined && Array.isArray(fourWeeksSummary.weeks)
      ? buildWeeklyExpenseChartData({
          weeks: fourWeeksSummary.weeks,
          targetWeekStartDate: weekStartDate,
          currentWeekStartDate,
        })
      : undefined;

  const navigateToWeek = (newWeekStartDate: string) => {
    const norm = normalizeWeekStartDate(newWeekStartDate) ?? currentWeekStartDate;
    const target = isFutureWeek(norm, currentWeekStartDate) ? currentWeekStartDate : norm;
    navigate(`/weeks/${target}`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingReceipt) {
      return;
    }
    setDeleteSaving(true);
    setDeleteError("");
    try {
      if (deletingReceipt.recordType === "expenseEntry") {
        await deleteExpenseEntry({
          expenseEntryId: deletingReceipt._id as Id<"expenseEntries">,
        });
      } else {
        await deleteReceipt({
          receiptId: deletingReceipt._id as Id<"receipts">,
        });
      }
      setDeletingReceipt(null);
      setSaveMessage("記録を削除しました。");
    } catch {
      setDeleteError("削除に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setDeleteSaving(false);
    }
  };

  if (weeklySummary === undefined) {
    return (
      <SuzumemoLoadingState
        label="データを読み込み中"
        message="週次サマリーを読み込んでいます…"
        variant="page"
      />
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
        <Stack className="weekly-summary-header" direction="row">
          <Box
            alt=""
            className="weekly-summary-header-icon"
            component="img"
            height={32}
            src="/suzumemo-app-icon.png"
            width={32}
          />
          <Typography component="h1" variant="h4">
            週次サマリー
          </Typography>
          {weekSession && (
            <Chip
              className="weekly-summary-status"
              color={weekSession.status === "completed" ? "success" : "warning"}
              label={weekSession.status === "completed" ? "完了済み" : "● 入力中"}
              size="small"
              variant={weekSession.status === "completed" ? "filled" : "outlined"}
            />
          )}
        </Stack>

        <WeekNavigator
          compactOnMobile
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          isCurrentWeek={isCurrentWeek}
          onPreviousWeek={() => navigateToWeek(addWeeks(weekStartDate, -1))}
          onNextWeek={() => navigateToWeek(addWeeks(weekStartDate, 1))}
        />

        {deleteError && (
          <Alert severity="error" variant="outlined" onClose={() => setDeleteError("")}>
            {deleteError}
          </Alert>
        )}

        <WeeklySummaryPanel
          count={weeklySummary.count}
          totalAmountYen={weeklySummary.totalAmountYen}
          byCategory={weeklySummary.byCategory}
          prevWeekTotalAmountYen={weeklySummary.prevWeekTotalAmountYen ?? null}
          receipts={weeklySummary.receipts}
          isLoading={false}
          weekStartDate={weekStartDate}
          weeklyExpenseTrend={weeklyExpenseTrend}
          onDeleteReceipt={setDeletingReceipt}
          onEditReceipt={setEditingReceipt}
        />
      </Stack>

      <ExpenseEntryEditDialog
        categories={categories}
        open={editingReceipt !== null}
        receipt={editingReceipt}
        onClose={() => setEditingReceipt(null)}
        onSaved={() => setSaveMessage("変更を保存しました。")}
      />

      <ExpenseEntryDeleteDialog
        open={deletingReceipt !== null}
        saving={deleteSaving}
        onCancel={() => setDeletingReceipt(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={3000}
        message={saveMessage}
        onClose={() => setSaveMessage("")}
        open={saveMessage.length > 0}
      />
    </Box>
  );
}
