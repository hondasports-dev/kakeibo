import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useExpenseEntryForm } from "../hooks/useExpenseEntryForm";
import { AnimatedButton, CollapsibleHelp } from "../../ui";
import { AiExpenseQueuePanel } from "../../ai-expense-queue";
import { CategoryGrid } from "./CategoryGrid";
import { ConfirmDifferenceDialog } from "./ConfirmDifferenceDialog";
import { DifferenceDisplay } from "./DifferenceDisplay";
import { ExpenseItemRow } from "./ExpenseItemRow";
import { SourceSummary } from "./SourceSummary";
import { WeekDaySelector } from "./WeekDaySelector";
import type { ExpenseEntryCategory } from "../types/types";

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
    <Paper className="paper-panel" elevation={0} sx={{ minWidth: 0 }}>
      <Box sx={{ minWidth: 0, p: 2.5 }}>
        <form noValidate onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <FormHeading isMultiMode={isMultiMode} />

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

            <FormActions
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

function FormHeading({ isMultiMode }: { isMultiMode: boolean }) {
  return (
    <Box>
      <Typography component="h2" variant="h5">
        入力
      </Typography>
      {!isMultiMode && (
        <CollapsibleHelp summary="入力のコツ">
          保存後は店舗名と金額だけ空にして、次の入力へ進みます。
        </CollapsibleHelp>
      )}
    </Box>
  );
}

function SingleEntryFields({
  categories,
  itemCategoryId,
  memo,
  shopName,
  shopNameError,
  sourceAmount,
  sourceAmountError,
  categoryError,
  onShopNameChange,
  onSourceAmountChange,
  onItemChange,
}: {
  categories: ExpenseEntryCategory[];
  itemCategoryId?: string;
  memo: string;
  shopName: string;
  shopNameError: string;
  sourceAmount: string;
  sourceAmountError: string;
  categoryError?: string;
  onShopNameChange: (value: string) => void;
  onSourceAmountChange: (value: string) => void;
  onItemChange: (field: "categoryId" | "memo", value: string) => void;
}) {
  return (
    <>
      <TextField
        error={!!shopNameError}
        fullWidth
        helperText={shopNameError}
        id="expense-shop-name"
        label="店舗名 / 支払先"
        slotProps={{ htmlInput: { "aria-label": "店舗名 / 支払先" } }}
        onChange={(event) => onShopNameChange(event.target.value)}
        placeholder="例: スーパー北浜"
        value={shopName}
      />

      <TextField
        error={!!sourceAmountError}
        fullWidth
        helperText={sourceAmountError}
        id="expense-source-amount"
        label="合計金額"
        slotProps={{ htmlInput: { "aria-label": "合計金額", inputMode: "numeric" } }}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^\d]/g, "");
          onSourceAmountChange(digits);
        }}
        placeholder="例: 4,280"
        value={sourceAmount ? parseInt(sourceAmount, 10).toLocaleString("ja-JP") : ""}
      />

      <Stack spacing={1}>
        <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
          カテゴリ
        </Typography>
        {categoryError && (
          <Typography color="error" variant="caption">
            {categoryError}
          </Typography>
        )}
        <CategoryGrid
          ariaLabel="カテゴリ候補"
          categories={categories}
          selectedCategoryId={itemCategoryId}
          onSelect={(categoryId) => onItemChange("categoryId", categoryId)}
        />
      </Stack>

      <TextField
        fullWidth
        id="expense-memo"
        label="メモ（任意）"
        onChange={(event) => onItemChange("memo", event.target.value)}
        value={memo}
        slotProps={{ htmlInput: { "aria-label": "メモ" } }}
      />
    </>
  );
}

function MultiEntryFields({
  categories,
  difference,
  itemErrors,
  items,
  sourceAmount,
  onAddItem,
  onItemChange,
  onRemoveItem,
}: {
  categories: ExpenseEntryCategory[];
  difference: number | null;
  itemErrors: Array<{
    categoryId?: string;
    amountYen?: string;
    title?: string;
    memo?: string;
  }>;
  items: Array<{ categoryId: string; amountYen: string; title: string; memo: string }>;
  sourceAmount: number;
  onAddItem: () => void;
  onItemChange: (
    index: number,
    field: "categoryId" | "amountYen" | "title" | "memo",
    value: string,
  ) => void;
  onRemoveItem: (index: number) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        支出項目
      </Typography>
      {items.map((item, index) => (
        <ExpenseItemRow
          key={index}
          index={index}
          item={item}
          itemErrors={itemErrors[index] ?? {}}
          categories={categories}
          onItemChange={(field, value) => onItemChange(index, field, value)}
          onRemove={() => onRemoveItem(index)}
          canRemove={items.length > 1}
        />
      ))}

      <Button variant="outlined" size="small" onClick={onAddItem} aria-label="項目を追加">
        + 項目を追加
      </Button>

      <Divider />

      <DifferenceDisplay difference={difference} sourceAmount={sourceAmount} />
    </Stack>
  );
}

function FormActions({
  isMultiMode,
  isOverExceeded,
  isSubmitting,
  onEnterMultiMode,
}: {
  isMultiMode: boolean;
  isOverExceeded: boolean;
  isSubmitting: boolean;
  onEnterMultiMode: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}
    >
      {!isMultiMode && (
        <Button variant="text" size="small" onClick={onEnterMultiMode} aria-label="支出項目を追加">
          支出項目を追加
        </Button>
      )}
      <AnimatedButton
        type="submit"
        variant="contained"
        disabled={isSubmitting || isOverExceeded}
        loading={isSubmitting}
      >
        保存して次へ
      </AnimatedButton>
    </Stack>
  );
}
