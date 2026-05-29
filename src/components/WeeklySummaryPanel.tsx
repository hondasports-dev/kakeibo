import { Box, Divider, LinearProgress, Paper, Skeleton, Stack, Typography } from "@mui/material";
import type { FourWeeksSummaryData } from "../../convex/receipts";
import { PreviousWeekComparison } from "./PreviousWeekComparison";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { formatDateForDisplay } from "../lib/dateFormat";

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

type WeeklySummaryPanelProps = {
  count: number;
  totalAmountYen: number;
  byCategory: CategorySummary[];
  prevWeekTotalAmountYen: number | null;
  receipts: ReceiptItem[];
  budgetAmountYen?: number;
  isLoading?: boolean;
  /**
   * 直近4週の支出推移データ。
   * - `FourWeeksSummaryData`: データ取得済み（グラフまたはプレースホルダー表示）
   * - `undefined`: ロード中（Skeleton 表示）
   * - prop 自体を渡さない: 非表示（Convex クエリが skip 状態のとき）
   */
  weeklyTrendData?: FourWeeksSummaryData | null;
};

export function WeeklySummaryPanel({
  count,
  totalAmountYen,
  byCategory,
  prevWeekTotalAmountYen,
  receipts,
  budgetAmountYen,
  isLoading = false,
  weeklyTrendData,
}: WeeklySummaryPanelProps) {
  const budgetUsageRate =
    budgetAmountYen !== undefined && budgetAmountYen > 0
      ? Math.round((totalAmountYen / budgetAmountYen) * 100)
      : undefined;

  const budgetRemaining =
    budgetAmountYen !== undefined ? budgetAmountYen - totalAmountYen : undefined;

  return (
    <Stack spacing={2.5}>
      {/* 合計・予算サマリー */}
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
                  <Typography variant="h5">{totalAmountYen.toLocaleString()}円</Typography>
                </Stack>

                {budgetAmountYen !== undefined && (
                  <>
                    <LinearProgress
                      aria-label="予算消化率"
                      value={Math.min(budgetUsageRate ?? 0, 100)}
                      variant="determinate"
                      color={
                        (budgetUsageRate ?? 0) >= 100
                          ? "error"
                          : (budgetUsageRate ?? 0) >= 80
                            ? "warning"
                            : "primary"
                      }
                    />
                    <Box className="budget-strip">
                      <span>予算</span>
                      <strong>
                        {budgetAmountYen.toLocaleString()}円 中 {budgetUsageRate}% 消化
                        {budgetRemaining !== undefined && (
                          <> （残り {budgetRemaining.toLocaleString()}円）</>
                        )}
                      </strong>
                    </Box>
                  </>
                )}

                {budgetAmountYen === undefined && (
                  <Box className="budget-strip">
                    <span>予算</span>
                    <strong>未設定</strong>
                  </Box>
                )}

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
      {weeklyTrendData !== null && (
        <WeeklyTrendChart
          weeks={weeklyTrendData?.weeks}
          isLoading={weeklyTrendData === undefined}
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
                          {cat.count}件
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 700 }} variant="body2">
                        {cat.totalAmountYen.toLocaleString()}円
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
                          backgroundColor: "rgba(0,0,0,0.06)",
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
                {count}件
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
                receipts.map((receipt) => (
                  <Box className="receipt-row" key={receipt._id}>
                    <Box>
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
                        <Typography sx={{ fontWeight: 700 }}>
                          {receipt.type === "income" ? (receipt.bankName ?? "") : (receipt.shopName ?? "")}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Typography color="text.secondary" variant="body2">
                          {formatDateForDisplay(receipt.date)}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {receipt.categoryName}
                        </Typography>
                      </Stack>
                    </Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {receipt.amountYen.toLocaleString()}円
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
            <Divider />
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
