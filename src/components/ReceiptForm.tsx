import type { Id } from "../../convex/_generated/dataModel";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { AiExpenseQueuePanel } from "./AiExpenseQueuePanel";
import { useReceiptForm } from "../hooks/useReceiptForm";
import { AnimatedButton } from "./AnimatedButton";
import { ReceiptCategorySelector } from "./receiptForm/ReceiptCategorySelector";
import { ReceiptNameField } from "./receiptForm/ReceiptNameField";
import { ReceiptWeekDaySelector } from "./receiptForm/ReceiptWeekDaySelector";

interface ReceiptFormProps {
  weekStartDate: string;
  weekEndDate: string;
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
}

export function ReceiptForm({ weekStartDate, weekEndDate, categories }: ReceiptFormProps) {
  const {
    shopNameRef,
    bankNameRef,
    formValues,
    errors,
    aiFieldStatuses,
    status,
    apiError,
    snackbar,
    selectedCategoryId,
    handleTypeChange,
    handleFieldChange,
    handleSubmit,
    handleRetry,
    handleSnackbarClose,
  } = useReceiptForm({ weekStartDate, weekEndDate, categories });
  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <form noValidate onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Box>
              <Typography component="h2" variant="h5">
                入力
              </Typography>
              <Typography color="text.secondary" variant="body2">
                保存後は名前と金額だけ空にして、次の入力へ進みます。
              </Typography>
            </Box>

            <Tabs
              aria-label="支出・収入切り替え"
              value={formValues.type}
              onChange={(_e, newValue: "expense" | "income") => handleTypeChange(newValue)}
            >
              <Tab label="支出" value="expense" />
              <Tab label="収入" value="income" />
            </Tabs>

            {apiError && (
              <Alert
                severity="error"
                variant="outlined"
                action={
                  <Button
                    color="error"
                    disabled={status === "submitting"}
                    onClick={handleRetry}
                    size="small"
                  >
                    再試行
                  </Button>
                }
              >
                {apiError}
              </Alert>
            )}

            {formValues.type === "expense" && (
              <>
                <AiExpenseQueuePanel categories={categories} />
              </>
            )}

            <ReceiptWeekDaySelector
              selectedDate={formValues.date}
              weekEndDate={weekEndDate}
              weekStartDate={weekStartDate}
              onSelectDate={(date) => handleFieldChange("date", date)}
            />

            <TextField
              error={!!errors.date}
              fullWidth
              helperText={
                errors.date || (aiFieldStatuses?.date.status === "applied" ? "AI候補" : undefined)
              }
              id="receipt-date"
              label="日付"
              name="date"
              onChange={(e) => handleFieldChange("date", e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  max: weekEndDate,
                  min: weekStartDate,
                },
              }}
              type="date"
              value={formValues.date}
            />

            <ReceiptNameField
              bankName={formValues.type === "income" ? formValues.bankName : ""}
              bankNameError={errors.bankName}
              bankNameRef={bankNameRef}
              shopName={formValues.type === "expense" ? formValues.shopName : ""}
              shopNameError={
                errors.shopName ||
                (aiFieldStatuses?.shopName.status === "applied" ? "AI候補" : undefined)
              }
              shopNameRef={shopNameRef}
              type={formValues.type}
              onFieldChange={handleFieldChange}
            />

            <TextField
              error={!!errors.amountYen}
              fullWidth
              helperText={
                errors.amountYen ||
                (aiFieldStatuses?.amountYen.status === "applied" ? "AI候補" : undefined)
              }
              id="receipt-amount-yen"
              label="合計金額"
              name="amountYen"
              onChange={(e) => {
                // 数字以外を除去してから保持（カンマも除去して内部値は常に数字のみ）
                const digits = e.target.value.replace(/[^\d]/g, "");
                handleFieldChange("amountYen", digits);
              }}
              placeholder="例: 4,280"
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                },
              }}
              value={
                formValues.amountYen ? Number(formValues.amountYen).toLocaleString("ja-JP") : ""
              }
            />

            <ReceiptCategorySelector
              categories={categories}
              error={errors.categoryId}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(categoryId) => handleFieldChange("categoryId", categoryId)}
            />

            <TextField
              error={!!errors.memo}
              fullWidth
              helperText={errors.memo}
              id="receipt-memo"
              label="メモ"
              minRows={3}
              multiline
              name="memo"
              onChange={(e) => handleFieldChange("memo", e.target.value)}
              placeholder="任意"
              value={formValues.memo}
            />

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <AnimatedButton
                className="primary-action"
                fullWidth
                loading={status === "submitting"}
                type="submit"
                variant="contained"
              >
                {status === "submitting" ? "保存中..." : "保存して次へ"}
              </AnimatedButton>
            </Stack>
          </Stack>
        </form>
      </Box>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        open={snackbar.open}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
