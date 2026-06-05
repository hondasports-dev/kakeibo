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
import { ReceiptImageExtractor } from "./ReceiptImageExtractor";
import { AiExpenseQueuePanel } from "./AiExpenseQueuePanel";
import { generateWeekDays } from "../lib/weekNavigation";
import { useReceiptForm } from "../hooks/useReceiptForm";
import { AnimatedButton } from "./AnimatedButton";

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
    handleExtracted,
    handleSubmit,
    handleRetry,
    handleSnackbarClose,
  } = useReceiptForm({ weekStartDate, weekEndDate, categories });

  const weekDays = generateWeekDays(weekStartDate, weekEndDate);

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
                <ReceiptImageExtractor onExtracted={handleExtracted} />
              </>
            )}

            <Box className="week-day-grid" aria-label="週内の日付候補" role="listbox">
              {weekDays.map((day) => {
                const isSelected = formValues.date === day.isoDate;
                return (
                  <Box
                    aria-label={`${day.label}曜日 ${day.date}${isSelected ? " 選択中" : ""}`}
                    aria-selected={isSelected}
                    className="week-day-button"
                    key={day.isoDate}
                    onClick={() => handleFieldChange("date", day.isoDate)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleFieldChange("date", day.isoDate);
                      }
                    }}
                    role="option"
                    tabIndex={0}
                    sx={{
                      border: "1px solid",
                      borderColor: isSelected ? "primary.main" : "divider",
                      borderRadius: 1,
                      bgcolor: isSelected ? "primary.main" : "background.paper",
                      color: isSelected ? "primary.contrastText" : "text.primary",
                      px: 1,
                      py: 1,
                      textAlign: "center",
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.main",
                        outlineOffset: "2px",
                      },
                    }}
                  >
                    <span>{day.label}</span>
                    <small>{day.date}</small>
                  </Box>
                );
              })}
            </Box>

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

            {formValues.type === "expense" ? (
              <TextField
                autoComplete="organization"
                data-testid="shop-name-field"
                error={!!errors.shopName}
                fullWidth
                helperText={
                  errors.shopName ||
                  (aiFieldStatuses?.shopName.status === "applied" ? "AI候補" : undefined)
                }
                id="receipt-shop-name"
                inputRef={shopNameRef}
                label="店舗名"
                name="shopName"
                onChange={(e) => handleFieldChange("shopName", e.target.value)}
                placeholder="例: スーパー北浜"
                value={formValues.shopName}
              />
            ) : (
              <TextField
                error={!!errors.bankName}
                fullWidth
                helperText={errors.bankName}
                id="receipt-bank-name"
                inputRef={bankNameRef}
                label="銀行名"
                name="bankName"
                onChange={(e) => handleFieldChange("bankName", e.target.value)}
                placeholder="例: 三菱UFJ銀行"
                value={formValues.bankName}
              />
            )}

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

            <Stack spacing={1}>
              <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
                カテゴリ
              </Typography>
              {errors.categoryId && (
                <Typography color="error" variant="caption">
                  {errors.categoryId}
                </Typography>
              )}
              <Box className="category-grid" aria-label="カテゴリ候補" role="listbox">
                {categories.map((category) => {
                  const isSelected = selectedCategoryId === category._id;
                  return (
                    <Box
                      aria-label={`${category.name}${isSelected ? " 選択中" : ""}`}
                      aria-selected={isSelected}
                      className="category-button"
                      key={category._id}
                      onClick={() => handleFieldChange("categoryId", category._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleFieldChange("categoryId", category._id);
                        }
                      }}
                      role="option"
                      tabIndex={0}
                      sx={
                        isSelected
                          ? {
                              border: "1px solid",
                              borderColor: "primary.main",
                              borderRadius: 1,
                              bgcolor: "primary.main",
                              color: "primary.contrastText",
                              px: 1,
                              py: 0.75,
                              textAlign: "center",
                              cursor: "pointer",
                              "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: "primary.main",
                                outlineOffset: "2px",
                              },
                            }
                          : {
                              border: "1px solid",
                              borderColor: category.color,
                              borderRadius: 1,
                              color: category.color,
                              px: 1,
                              py: 0.75,
                              textAlign: "center",
                              cursor: "pointer",
                              "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: category.color,
                                outlineOffset: "2px",
                              },
                            }
                      }
                    >
                      {category.name}
                    </Box>
                  );
                })}
              </Box>
            </Stack>

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
