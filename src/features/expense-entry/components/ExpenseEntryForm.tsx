import type { Id } from "../../../../convex/_generated/dataModel";
import { Alert, Box, Paper, Snackbar, Stack } from "@mui/material";
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

  return (
    <Paper className="paper-panel" elevation={0} sx={{ maxWidth: "100%", minWidth: 0 }}>
      <Box sx={{ maxWidth: "100%", minWidth: 0, p: 2.5 }}>
        <form noValidate onSubmit={handleSubmit}>
          <Stack spacing={2.5} sx={{ maxWidth: "100%", minWidth: 0 }}>
            <ExpenseFormHeading isMultiMode={isMultiMode} />

            {apiError && (
              <Alert severity="error" variant="outlined">
                {apiError}
              </Alert>
            )}

            <AiExpenseQueuePanel categories={categories} />

            <WeekDaySelector
              weekStartDate={weekStartDate}
              weekEndDate={weekEndDate}
              selectedDate={date}
              onSelectDate={setDate}
            />

            {isMultiMode ? (
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

            {isMultiMode && (
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

            <ExpenseFormActions
              isMultiMode={isMultiMode}
              isOverExceeded={isOverExceeded}
              isSubmitting={status === "submitting"}
              onEnterMultiMode={handleEnterMultiMode}
            />
          </Stack>
        </form>
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
    </Paper>
  );
}
