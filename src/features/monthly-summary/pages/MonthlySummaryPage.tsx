import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Alert, Box, Snackbar, Stack, Typography } from "@mui/material";
import type { Id } from "../../../../convex/_generated/dataModel";
import { listActiveApi } from "../../../lib/repositories/categories";
import { deleteExpenseEntryApi } from "../../../lib/repositories/expenseEntries";
import {
  deleteReceiptApi,
  getMonthSummaryWithCategoriesApi,
} from "../../../lib/repositories/receipts";
import { SuzumemoLoadingState } from "../../ui";
import { ExpenseEntryDeleteDialog } from "../../weekly-summary/components/ExpenseEntryDeleteDialog";
import { ExpenseEntryEditDialog } from "../../weekly-summary/components/ExpenseEntryEditDialog";
import { CategoryBreakdownCard } from "../../weekly-summary/components/CategoryBreakdownCard";
import { IncomeListCard } from "../../weekly-summary/components/IncomeListCard";
import { ReceiptListCard } from "../../weekly-summary/components/ReceiptListCard";
import { incomeItemToReceiptItem, type ReceiptItem } from "../../weekly-summary/types/types";
import { MonthNavigator } from "../components/MonthNavigator";
import { MonthlyMetricsPanel } from "../components/MonthlyMetricsPanel";
import { addMonths, getCurrentMonth, isFutureMonth, normalizeMonth } from "../lib/monthNavigation";

export function MonthlySummaryPage() {
  const { month: rawMonth } = useParams<{ month: string }>();
  const navigate = useNavigate();
  const [editingReceipt, setEditingReceipt] = useState<ReceiptItem | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<ReceiptItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const currentMonth = getCurrentMonth();
  const normalizedMonth = rawMonth ? normalizeMonth(rawMonth) : null;
  const month =
    normalizedMonth !== null && !isFutureMonth(normalizedMonth, currentMonth)
      ? normalizedMonth
      : currentMonth;

  const deleteExpenseEntry = useMutation(deleteExpenseEntryApi());
  const deleteReceipt = useMutation(deleteReceiptApi());
  const categoriesQuery = useQuery(listActiveApi());
  const monthlySummary = useQuery(getMonthSummaryWithCategoriesApi(), { month });
  const categories = Array.isArray(categoriesQuery) ? categoriesQuery : [];

  useEffect(() => {
    if (rawMonth !== month) {
      navigate(`/months/${month}`, { replace: true });
    }
  }, [month, navigate, rawMonth]);

  const navigateToMonth = (targetMonth: string) => {
    const normalizedTarget = normalizeMonth(targetMonth);
    const safeTarget =
      normalizedTarget !== null && !isFutureMonth(normalizedTarget, currentMonth)
        ? normalizedTarget
        : currentMonth;
    navigate(`/months/${safeTarget}`);
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

  if (monthlySummary === undefined) {
    return (
      <SuzumemoLoadingState
        label="データを読み込み中"
        message="月次サマリーを読み込んでいます…"
        variant="page"
      />
    );
  }

  if (monthlySummary === null) {
    return (
      <Box className="app-main">
        <Alert severity="error" variant="outlined">
          月次サマリーの読み込みに失敗しました。
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
            月次サマリー
          </Typography>
        </Stack>

        <MonthNavigator
          currentMonth={currentMonth}
          month={month}
          onCurrentMonth={() => navigateToMonth(currentMonth)}
          onMonthChange={navigateToMonth}
          onNextMonth={() => navigateToMonth(addMonths(month, 1))}
          onPreviousMonth={() => navigateToMonth(addMonths(month, -1))}
        />

        {deleteError && (
          <Alert severity="error" variant="outlined" onClose={() => setDeleteError("")}>
            {deleteError}
          </Alert>
        )}

        <MonthlyMetricsPanel
          isLoading={false}
          netAmountYen={monthlySummary.netAmountYen}
          totalAmountYen={monthlySummary.totalAmountYen}
          totalIncomeYen={monthlySummary.totalIncomeYen}
        />

        <CategoryBreakdownCard
          byCategory={monthlySummary.byCategory}
          count={monthlySummary.count}
          emptyMessage="この月の支出はまだありません"
          isLoading={false}
          showPercentage
          title="支出カテゴリ"
          totalAmountYen={monthlySummary.totalAmountYen}
        />

        <ReceiptListCard
          count={monthlySummary.count}
          emptyMessage="この月の支出はまだありません"
          isLoading={false}
          listAriaLabel="月次サマリーの支出一覧"
          onDeleteReceipt={setDeletingReceipt}
          onEditReceipt={setEditingReceipt}
          receipts={monthlySummary.receipts}
        />

        <IncomeListCard
          count={monthlySummary.incomeCount}
          emptyMessage="この月の収入はまだありません"
          incomes={monthlySummary.incomes}
          isLoading={false}
          listAriaLabel="月次サマリーの収入一覧"
          onDeleteIncome={(income) => setDeletingReceipt(incomeItemToReceiptItem(income))}
          onEditIncome={(income) => setEditingReceipt(incomeItemToReceiptItem(income))}
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
        onClose={() => setSaveMessage("")}
        open={saveMessage.length > 0}
      >
        <Alert
          aria-live="polite"
          onClose={() => setSaveMessage("")}
          role="status"
          severity="success"
        >
          {saveMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
