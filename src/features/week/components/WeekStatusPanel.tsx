import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { formatDateForDisplay } from "../lib/dateFormat";

type Receipt = {
  _id: string;
  shopName?: string;
  bankName?: string;
  date: string;
  amountYen: number;
  type?: "expense" | "income";
  categoryName?: string;
  categoryColor?: string;
  memo?: string;
};

type WeekStatusPanelProps = {
  receipts: Receipt[];
  isLoading?: boolean;
};

export function WeekStatusPanel({ receipts, isLoading = false }: WeekStatusPanelProps) {
  const count = receipts.length;
  const progressValue = Math.min((count / 10) * 100, 100);

  return (
    <Stack spacing={2.5}>
      {/* 今週の進捗 */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography component="h2" variant="h6">
                今週の進捗
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {count} 件
              </Typography>
            </Stack>
            <LinearProgress
              aria-label="今週の入力進捗"
              value={progressValue}
              variant="determinate"
            />
          </Stack>
        </Box>
      </Paper>

      {/* 直近の入力 */}
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2.5}>
            <Typography component="h2" variant="h6">
              直近の入力
            </Typography>
            <Box className="receipt-list">
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
                receipts.slice(0, 5).map((receipt) => (
                  <Box className="receipt-row" key={receipt._id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", mt: 0.5, flexWrap: "wrap" }}
                      >
                        <Typography color="text.secondary" variant="body2">
                          {formatDateForDisplay(receipt.date)}
                        </Typography>
                        {receipt.categoryName && (
                          <Chip
                            label={receipt.categoryName}
                            size="small"
                            sx={{
                              backgroundColor: receipt.categoryColor,
                              color: "#fff",
                              fontSize: "0.7rem",
                              height: 20,
                            }}
                          />
                        )}
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
                ))
              )}
            </Box>
            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="outlined">直前を複製</Button>
              <Button color="secondary" variant="outlined">
                直前を取り消す
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
