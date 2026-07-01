import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Alert, Box, Button, Paper, Snackbar, Stack, Tab, Tabs, TextField } from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import { useExpenseEntryForm } from "../hooks/useExpenseEntryForm";
import { AiExpenseQueuePanel } from "../../ai-expense-queue";
import { ConfirmDifferenceDialog } from "./ConfirmDifferenceDialog";
import { ExpenseFormActions } from "./ExpenseFormActions";
import { ExpenseFormHeading } from "./ExpenseFormHeading";
import { MultiEntryFields } from "./MultiEntryFields";
import { SingleEntryFields } from "./SingleEntryFields";
import { SourceSummary } from "./SourceSummary";
import { WeekDaySelector } from "./WeekDaySelector";

interface ExpenseEntryFormProps {
  weekStartDate: string;
  weekEndDate: string;
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
}

export function ExpenseEntryForm({
  weekStartDate,
  weekEndDate,
  categories,
}: ExpenseEntryFormProps) {
  const [entryType, setEntryType] = useState<"expense" | "income">("expense");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeTitle, setIncomeTitle] = useState("");
  const [incomeAmountError, setIncomeAmountError] = useState("");
  const [incomeTitleError, setIncomeTitleError] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);
  const createIncomeEntry = useMutation(api.expenseEntries.mutations.createIncomeEntry);
  const {
    shopName,
    sourceAmount,
    date,
    isMultiMode,
    items,
    shopNameError,
    sourceAmountError,
    itemErrors,
    difference,
    status,
    apiError,
    snackbar,
    showConfirmDialog,
    pendingDifference,
    setShopName,
    setSourceAmount,
    setDate,
    handleEnterMultiMode,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleSubmit,
    handleConfirmSave,
    handleCancelConfirm,
    handleSnackbarClose,
  } = useExpenseEntryForm({ weekStartDate, weekEndDate, categories });

  const sourceAmountNum = parseInt(sourceAmount || "0", 10) || 0;
  const isOverExceeded = difference !== null && difference < 0;

  const handleIncomeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedIncomeAmount = incomeAmount.replace(/[^\d]/g, "");
    const amountYen = Number(normalizedIncomeAmount);
    const amountError =
      !Number.isInteger(amountYen) || amountYen <= 0 ? "1円以上の金額を入力してください" : "";
    const titleError = incomeTitle.trim() ? "" : "収入の内容を入力してください";
    setIncomeAmountError(amountError);
    setIncomeTitleError(titleError);
    if (amountError || titleError) {
      return;
    }
    setIncomeSubmitting(true);
    setIncomeError("");
    try {
      await createIncomeEntry({ date, amountYen, title: incomeTitle.trim() });
      setIncomeAmount("");
      setIncomeTitle("");
      setIncomeSaved(true);
    } catch (error) {
      setIncomeError(
        error instanceof Error ? error.message : "保存に失敗しました。もう一度お試しください。",
      );
    } finally {
      setIncomeSubmitting(false);
    }
  };

  return (
    <Paper className="paper-panel" elevation={0} sx={{ maxWidth: "100%", minWidth: 0 }}>
      <Box sx={{ maxWidth: "100%", minWidth: 0, p: 2.5 }}>
        <Stack spacing={2.5}>
          <Tabs
            aria-label="支出・収入切り替え"
            onChange={(_event, value: "expense" | "income") => setEntryType(value)}
            value={entryType}
            variant="fullWidth"
          >
            <Tab label="支出" value="expense" />
            <Tab label="収入" value="income" />
          </Tabs>
          <Box className={`input-workbench input-workbench--${entryType}`}>
            <form
              className="input-workbench-form"
              noValidate
              onSubmit={entryType === "expense" ? handleSubmit : handleIncomeSubmit}
            >
              <Stack spacing={2.5} sx={{ maxWidth: "100%", minWidth: 0 }}>
                <ExpenseFormHeading isMultiMode={isMultiMode} />

                {(entryType === "expense" ? apiError : incomeError) && (
                  <Alert severity="error" variant="outlined">
                    {entryType === "expense" ? apiError : incomeError}
                  </Alert>
                )}

                <WeekDaySelector
                  weekStartDate={weekStartDate}
                  weekEndDate={weekEndDate}
                  selectedDate={date}
                  onSelectDate={setDate}
                />

                {entryType === "income" ? (
                  <Stack spacing={2}>
                    <TextField
                      autoComplete="off"
                      error={Boolean(incomeAmountError)}
                      fullWidth
                      helperText={incomeAmountError}
                      label="金額"
                      name="incomeAmountYen"
                      onChange={(event) => {
                        setIncomeAmount(event.target.value);
                        setIncomeAmountError("");
                      }}
                      placeholder="例: 320,000…"
                      slotProps={{ htmlInput: { inputMode: "numeric" } }}
                      value={incomeAmount}
                    />
                    <TextField
                      autoComplete="off"
                      error={Boolean(incomeTitleError)}
                      fullWidth
                      helperText={incomeTitleError || "給与、賞与、立替精算など"}
                      label="収入の内容・メモ"
                      minRows={2}
                      multiline
                      name="incomeDescription"
                      onChange={(event) => {
                        setIncomeTitle(event.target.value);
                        setIncomeTitleError("");
                      }}
                      placeholder="例: 給与、賞与、立替精算など…"
                      value={incomeTitle}
                    />
                  </Stack>
                ) : isMultiMode ? (
                  <SourceSummary sourceAmount={sourceAmountNum} shopName={shopName} />
                ) : (
                  <SingleEntryFields
                    categories={categories}
                    itemCategoryId={items[0]?.categoryId}
                    memo={items[0]?.memo ?? ""}
                    shopName={shopName}
                    shopNameError={shopNameError}
                    sourceAmount={sourceAmount}
                    sourceAmountError={sourceAmountError}
                    categoryError={itemErrors[0]?.categoryId}
                    onShopNameChange={setShopName}
                    onSourceAmountChange={setSourceAmount}
                    onItemChange={(field, value) => handleItemChange(0, field, value)}
                  />
                )}

                {entryType === "expense" && isMultiMode && (
                  <MultiEntryFields
                    categories={categories}
                    difference={difference}
                    itemErrors={itemErrors}
                    items={items}
                    sourceAmount={sourceAmountNum}
                    onAddItem={handleAddItem}
                    onItemChange={handleItemChange}
                    onRemoveItem={handleRemoveItem}
                  />
                )}

                {entryType === "expense" ? (
                  <ExpenseFormActions
                    isMultiMode={isMultiMode}
                    isOverExceeded={isOverExceeded}
                    isSubmitting={status === "submitting"}
                    onEnterMultiMode={handleEnterMultiMode}
                  />
                ) : (
                  <Button
                    aria-busy={incomeSubmitting}
                    disabled={incomeSubmitting}
                    size="large"
                    sx={{ minHeight: 44 }}
                    type="submit"
                    variant="contained"
                  >
                    {incomeSubmitting ? "保存中…" : "保存して次へ"}
                  </Button>
                )}
              </Stack>
            </form>
            {entryType === "expense" && (
              <Box className="input-workbench-queue">
                <AiExpenseQueuePanel categories={categories} />
              </Box>
            )}
          </Box>
        </Stack>
      </Box>

      <ConfirmDifferenceDialog
        open={showConfirmDialog}
        pendingDifference={pendingDifference}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirmSave}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={3000}
        onClose={() => setIncomeSaved(false)}
        open={incomeSaved}
      >
        <Alert onClose={() => setIncomeSaved(false)} severity="success" variant="filled">
          収入を保存しました
        </Alert>
      </Snackbar>
    </Paper>
  );
}
