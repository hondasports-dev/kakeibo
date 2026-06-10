import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { DailySpendingTrendData } from "../../convex/receipts";
import { PreviousWeekComparison } from "./PreviousWeekComparison";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { formatDateForDisplay } from "../lib/dateFormat";
import { addDays, addWeeks } from "../lib/weekNavigation";
import { AnimatedCounter } from "./AnimatedCounter";

type CategorySummary = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmountYen: number;
  count: number;
};

type ReceiptItem = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  memo?: string;
};

function ReceiptRow({ receipt }: { receipt: ReceiptItem }) {
  return (
    <Box className="receipt-row" key={receipt._id}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: receipt.categoryColor,
              flexShrink: 0,
            }}
          />
          {receipt.type && (
            <Chip
              label={receipt.type === "income" ? "収入" : "支出"}
              size="small"
              color={receipt.type === "income" ? "warning" : "default"}
              variant="outlined"
            />
          )}
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {receipt.type === "income"
              ? (receipt.bankName ?? "不明")
              : (receipt.shopName ?? "不明")}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
          <Typography color="text.secondary" variant="body2">
            {formatDateForDisplay(receipt.date)}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {receipt.categoryName}
          </Typography>
          {receipt.memo && (
            <Typography color="text.secondary" variant="caption">
              メモあり
            </Typography>
          )}
        </Stack>
      </Box>
      <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>
        {receipt.amountYen.toLocaleString()}円
      </Typography>
    </Box>
  );
}

type WeeklySummaryPanelProps = {
  count: number;
  totalAmountYen: number;
  byCategory: CategorySummary[];
  prevWeekTotalAmountYen: number | null;
  receipts: ReceiptItem[];
  prevWeekReceipts?: ReceiptItem[];
  isLoading?: boolean;
  weekStartDate: string;
  /**
   * 今週と前週の日別支出推移データ。
   * - `DailySpendingTrendData`: データ取得済み（グラフまたはプレースホルダー表示）
   * - `undefined`: ロード中（Skeleton 表示）
   * - prop 自体を渡さない: 非表示（Convex クエリが skip 状態のとき）
   */
  dailySpendingTrend?: DailySpendingTrendData | null;
};

export function WeeklySummaryPanel({
  count,
  totalAmountYen,
  byCategory,
  prevWeekTotalAmountYen,
  receipts,
  prevWeekReceipts = [],
  isLoading = false,
  weekStartDate,
  dailySpendingTrend,
}: WeeklySummaryPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePointClick = (date: string) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedDate(null);
  };

  const previousWeekStart = addWeeks(weekStartDate, -1);
  const dayOffset = selectedDate
    ? Math.round(
        (new Date(selectedDate + "T00:00:00Z").getTime() -
          new Date(weekStartDate + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  const previousDate = selectedDate ? addDays(previousWeekStart, dayOffset) : null;

  const currentDayReceipts = selectedDate ? receipts.filter((r) => r.date === selectedDate) : [];
  const previousDayReceipts = previousDate
    ? prevWeekReceipts.filter((r) => r.date === previousDate)
    : [];

  const currentDayTotal = currentDayReceipts.reduce((sum, r) => sum + r.amountYen, 0);
  const previousDayTotal = previousDayReceipts.reduce((sum, r) => sum + r.amountYen, 0);

  return (
    <Stack spacing={2.5}>
      {/* 合計サマリー */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h6">
              週次サマリー
            </Typography>

            {isLoading ? (
              <>
                <Skeleton variant="text" height={40} />
                <Skeleton variant="text" height={24} />
                <Skeleton variant="text" height={24} />
              </>
            ) : (
              <>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "baseline" }}
                >
                  <Typography color="text.secondary" variant="body2">
                    合計支出
                  </Typography>
                  <Typography variant="h5">
                    <AnimatedCounter value={totalAmountYen} suffix="円" />
                  </Typography>
                </Stack>

                <PreviousWeekComparison
                  currentTotalAmountYen={totalAmountYen}
                  prevWeekTotalAmountYen={prevWeekTotalAmountYen}
                />
              </>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* 週別支出推移グラフ
           - null    : クエリ skip 中（サマリーを閉じている）→ セクション自体を非表示
           - undefined: ロード中 → isLoading で Skeleton を表示
           - データあり: グラフまたはプレースホルダーを表示
      */}
      {dailySpendingTrend !== null && (
        <WeeklyTrendChart
          currentWeek={dailySpendingTrend?.currentWeek}
          previousWeek={dailySpendingTrend?.previousWeek}
          isLoading={dailySpendingTrend === undefined}
          onPointClick={handlePointClick}
        />
      )}

      {/* カテゴリ別支出 */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h6">
              カテゴリ別
            </Typography>

            {isLoading ? (
              <>
                <Skeleton variant="text" height={32} />
                <Skeleton variant="text" height={32} />
                <Skeleton variant="text" height={32} />
              </>
            ) : count === 0 ? (
              <Typography color="text.secondary" variant="body2">
                まだレシートがありません
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {byCategory.map((cat) => (
                  <Stack key={cat.categoryId} spacing={0.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: cat.categoryColor,
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="body2">{cat.categoryName}</Typography>
                        <Typography color="text.secondary" variant="caption">
                          <AnimatedCounter value={cat.count} suffix="件" />
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 700 }} variant="body2">
                        <AnimatedCounter value={cat.totalAmountYen} suffix="円" />
                      </Typography>
                    </Stack>
                    {totalAmountYen > 0 && (
                      <LinearProgress
                        aria-label={`${cat.categoryName}の割合`}
                        value={Math.round((cat.totalAmountYen / totalAmountYen) * 100)}
                        variant="determinate"
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "var(--color-border-track)",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: cat.categoryColor,
                          },
                        }}
                      />
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* 支出一覧 */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography component="h2" variant="h6">
                支出一覧
              </Typography>
              <Typography color="text.secondary" variant="body2">
                <AnimatedCounter value={count} suffix="件" />
              </Typography>
            </Stack>

            <Box aria-label="週次サマリーの支出一覧" className="receipt-list">
              {isLoading ? (
                <>
                  <Skeleton variant="text" height={40} />
                  <Skeleton variant="text" height={40} />
                  <Skeleton variant="text" height={40} />
                </>
              ) : count === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  まだレシートがありません
                </Typography>
              ) : (
                receipts.map((receipt) => <ReceiptRow key={receipt._id} receipt={receipt} />)
              )}
            </Box>
            <Divider />
          </Stack>
        </Box>
      </Paper>

      {/* 日別入出金比較モーダル */}
      <Dialog open={dialogOpen} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle>
          {selectedDate ? `${formatDateForDisplay(selectedDate)} の入出金比較` : "入出金比較"}
        </DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: "column", md: "row" }} divider={<Divider flexItem />} spacing={3}>
            {/* 前週 */}
            <Box sx={{ flex: 1 }}>
              <Typography gutterBottom variant="subtitle1">
                前週（{previousDate ? formatDateForDisplay(previousDate) : ""}）
              </Typography>
              <Typography variant="h6">
                <AnimatedCounter value={previousDayTotal} suffix="円" />
              </Typography>
              <Box className="receipt-list" sx={{ mt: 1 }}>
                {previousDayReceipts.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    レシートがありません
                  </Typography>
                ) : (
                  previousDayReceipts.map((receipt) => (
                    <ReceiptRow key={receipt._id} receipt={receipt} />
                  ))
                )}
              </Box>
            </Box>

            {/* 今週 */}
            <Box sx={{ flex: 1 }}>
              <Typography gutterBottom variant="subtitle1">
                今週（{selectedDate ? formatDateForDisplay(selectedDate) : ""}）
              </Typography>
              <Typography variant="h6">
                <AnimatedCounter value={currentDayTotal} suffix="円" />
              </Typography>
              <Box className="receipt-list" sx={{ mt: 1 }}>
                {currentDayReceipts.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    レシートがありません
                  </Typography>
                ) : (
                  currentDayReceipts.map((receipt) => (
                    <ReceiptRow key={receipt._id} receipt={receipt} />
                  ))
                )}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
