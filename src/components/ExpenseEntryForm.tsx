import type { Id } from "../../convex/_generated/dataModel";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { generateWeekDays } from "../lib/weekNavigation";
import { useExpenseEntryForm } from "../hooks/useExpenseEntryForm";
import { AnimatedButton } from "./AnimatedButton";
import { AiExpenseQueuePanel } from "./AiExpenseQueuePanel";

interface ExpenseEntryFormProps {
  weekStartDate: string;
  weekEndDate: string;
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
}

function DifferenceDisplay({
  difference,
  sourceAmount,
}: {
  difference: number | null;
  sourceAmount: number;
}) {
  if (difference === null || sourceAmount <= 0) return null;

  const isZero = difference === 0;
  const isNegative = difference < 0;

  const color = isZero ? "success.main" : isNegative ? "error.main" : "warning.main";
  const label = isZero
    ? "配分完了"
    : isNegative
      ? `超過: ${Math.abs(difference).toLocaleString("ja-JP")}円`
      : `未配分: ${difference.toLocaleString("ja-JP")}円`;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="body2" color="text.secondary">
        差額
      </Typography>
      <Typography aria-label="差額" variant="body2" sx={{ color, fontWeight: 700 }}>
        {isZero
          ? "0"
          : isNegative
            ? `-${Math.abs(difference).toLocaleString("ja-JP")}`
            : `+${difference.toLocaleString("ja-JP")}`}
      </Typography>
      <Chip
        label={label}
        size="small"
        color={isZero ? "success" : isNegative ? "error" : "warning"}
        variant="outlined"
      />
    </Stack>
  );
}

function ExpenseItemRow({
  index,
  item,
  itemErrors,
  categories,
  onItemChange,
  onRemove,
  canRemove,
}: {
  index: number;
  item: { categoryId: string; amountYen: string; title: string; memo: string };
  itemErrors: { categoryId?: string; amountYen?: string; title?: string; memo?: string };
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
  onItemChange: (
    field: keyof { categoryId: string; amountYen: string; title: string; memo: string },
    value: string,
  ) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <Box
      data-testid={`expense-item-${index}`}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="caption" color="text.secondary">
            項目 {index + 1}
          </Typography>
          {canRemove && (
            <IconButton aria-label="削除" size="small" color="error" onClick={onRemove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <TextField
          fullWidth
          size="small"
          id={`item-title-${index}`}
          label="内容"
          slotProps={{ htmlInput: { "aria-label": "内容" } }}
          value={item.title}
          onChange={(e) => onItemChange("title", e.target.value)}
          error={!!itemErrors.title}
          helperText={itemErrors.title}
        />

        <TextField
          fullWidth
          size="small"
          id={`item-amount-${index}`}
          label="金額"
          slotProps={{ htmlInput: { "aria-label": "金額", inputMode: "numeric" } }}
          value={item.amountYen ? Number(item.amountYen).toLocaleString("ja-JP") : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            onItemChange("amountYen", digits);
          }}
          error={!!itemErrors.amountYen}
          helperText={itemErrors.amountYen}
          placeholder="例: 2,000"
        />

        {itemErrors.categoryId && (
          <Typography color="error" variant="caption">
            {itemErrors.categoryId}
          </Typography>
        )}
        <Box className="category-grid" aria-label={`項目${index + 1}のカテゴリ候補`} role="listbox">
          {categories.map((category) => {
            const isSelected = item.categoryId === category._id;
            return (
              <Box
                key={category._id}
                aria-label={`${category.name}${isSelected ? " 選択中" : ""}`}
                aria-selected={isSelected}
                className="category-button"
                role="option"
                tabIndex={0}
                onClick={() => onItemChange("categoryId", category._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onItemChange("categoryId", category._id);
                  }
                }}
                sx={{
                  border: "1px solid",
                  borderColor: isSelected ? "primary.main" : "divider",
                  borderRadius: 1,
                  bgcolor: isSelected ? "primary.main" : "background.paper",
                  color: isSelected ? "primary.contrastText" : "text.primary",
                  px: 1,
                  py: 0.75,
                  textAlign: "center",
                  cursor: "pointer",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
              >
                <Typography variant="caption">{category.name}</Typography>
              </Box>
            );
          })}
        </Box>
      </Stack>
    </Box>
  );
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

  const weekDays = generateWeekDays(weekStartDate, weekEndDate);
  const sourceAmountNum = parseInt(sourceAmount || "0", 10) || 0;
  const isOverExceeded = difference !== null && difference < 0;

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <form noValidate onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Box>
              <Typography component="h2" variant="h5">
                入力
              </Typography>
              {!isMultiMode && (
                <Typography color="text.secondary" variant="body2">
                  保存後は店舗名と金額だけ空にして、次の入力へ進みます。
                </Typography>
              )}
            </Box>

            {apiError && (
              <Alert severity="error" variant="outlined">
                {apiError}
              </Alert>
            )}

            {/* AI支出下書きキュー */}
            <AiExpenseQueuePanel categories={categories} />

            {/* 日付選択 */}
            <Box className="week-day-grid" aria-label="週内の日付候補" role="listbox">
              {weekDays.map((day) => {
                const isSelected = date === day.isoDate;
                return (
                  <Box
                    aria-label={`${day.label}曜日 ${day.date}${isSelected ? " 選択中" : ""}`}
                    aria-selected={isSelected}
                    className="week-day-button"
                    key={day.isoDate}
                    onClick={() => setDate(day.isoDate)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDate(day.isoDate);
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

            {/* 入力元情報（複数モード時はヘッダーとして固定表示） */}
            {isMultiMode ? (
              <Box
                sx={{
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Stack spacing={0}>
                    <Typography variant="caption" color="text.secondary">
                      入力元合計
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {sourceAmountNum.toLocaleString("ja-JP")}
                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                        円
                      </Typography>
                    </Typography>
                  </Stack>
                  {shopName && (
                    <Typography variant="body2" color="text.secondary">
                      {shopName}
                    </Typography>
                  )}
                </Stack>
              </Box>
            ) : (
              <>
                {/* 単一モード: 店舗名・金額入力 */}
                <TextField
                  error={!!shopNameError}
                  fullWidth
                  helperText={shopNameError}
                  id="expense-shop-name"
                  label="店舗名 / 支払先"
                  slotProps={{ htmlInput: { "aria-label": "店舗名 / 支払先" } }}
                  onChange={(e) => setShopName(e.target.value)}
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
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "");
                    setSourceAmount(digits);
                  }}
                  placeholder="例: 4,280"
                  value={sourceAmount ? parseInt(sourceAmount, 10).toLocaleString("ja-JP") : ""}
                />

                {/* 単一モード: カテゴリ + メモ */}
                {!isMultiMode && (
                  <>
                    <Stack spacing={1}>
                      <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
                        カテゴリ
                      </Typography>
                      {itemErrors[0]?.categoryId && (
                        <Typography color="error" variant="caption">
                          {itemErrors[0].categoryId}
                        </Typography>
                      )}
                      <Box className="category-grid" aria-label="カテゴリ候補" role="listbox">
                        {categories.map((category) => {
                          const isSelected = items[0]?.categoryId === category._id;
                          return (
                            <Box
                              aria-label={`${category.name}${isSelected ? " 選択中" : ""}`}
                              aria-selected={isSelected}
                              className="category-button"
                              key={category._id}
                              onClick={() => handleItemChange(0, "categoryId", category._id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleItemChange(0, "categoryId", category._id);
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
                              <span>{category.name}</span>
                            </Box>
                          );
                        })}
                      </Box>
                    </Stack>

                    <TextField
                      fullWidth
                      id="expense-memo"
                      label="メモ（任意）"
                      onChange={(e) => handleItemChange(0, "memo", e.target.value)}
                      value={items[0]?.memo ?? ""}
                      slotProps={{ htmlInput: { "aria-label": "メモ" } }}
                    />
                  </>
                )}
              </>
            )}

            {/* 複数項目モード: 項目リスト */}
            {isMultiMode && (
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
                    onItemChange={(field, value) => handleItemChange(index, field, value)}
                    onRemove={() => handleRemoveItem(index)}
                    canRemove={items.length > 1}
                  />
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddItem}
                  aria-label="項目を追加"
                >
                  + 項目を追加
                </Button>

                <Divider />

                <DifferenceDisplay difference={difference} sourceAmount={sourceAmountNum} />
              </Stack>
            )}

            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
              {!isMultiMode && (
                <Button
                  variant="text"
                  size="small"
                  onClick={handleEnterMultiMode}
                  aria-label="支出項目を追加"
                >
                  支出項目を追加
                </Button>
              )}
              <AnimatedButton
                type="submit"
                variant="contained"
                disabled={status === "submitting" || isOverExceeded}
                loading={status === "submitting"}
              >
                保存して次へ
              </AnimatedButton>
            </Stack>
          </Stack>
        </form>
      </Box>

      {/* 差額プラス確認ダイアログ */}
      <Dialog open={showConfirmDialog} onClose={handleCancelConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>未配分の差額があります</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            入力元合計との差額が{" "}
            <Typography component="span" color="warning.main" sx={{ fontWeight: 700 }}>
              {pendingDifference.toLocaleString("ja-JP")}円
            </Typography>{" "}
            未配分のまま保存しますか？
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            ※ 後から支出項目を追加して配分できます
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelConfirm}>戻る</Button>
          <Button onClick={handleConfirmSave} variant="contained" color="warning">
            このまま保存
          </Button>
        </DialogActions>
      </Dialog>

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
