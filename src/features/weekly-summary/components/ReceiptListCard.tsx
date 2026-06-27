import { useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { ReceiptRow } from "./ReceiptRow";
import type { ReceiptItem } from "../types/types";

export function ReceiptListCard({
  count,
  isLoading,
  receipts,
  onDeleteReceipt,
  onEditReceipt,
}: {
  count: number;
  isLoading: boolean;
  receipts: ReceiptItem[];
  onDeleteReceipt?: (receipt: ReceiptItem) => void;
  onEditReceipt?: (receipt: ReceiptItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const orderedReceipts = receipts
    .map((receipt, index) => ({ receipt, index }))
    .sort((a, b) => b.receipt.date.localeCompare(a.receipt.date) || b.index - a.index)
    .map(({ receipt }) => receipt);
  const visibleReceipts = expanded ? orderedReceipts : orderedReceipts.slice(0, 5);
  const remainingCount = Math.max(receipts.length - visibleReceipts.length, 0);

  return (
    <Paper className="paper-panel weekly-receipt-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            支出一覧（{count}件）
          </Typography>

          <Box
            aria-label="週次サマリーの支出一覧"
            className="receipt-list"
            role={!isLoading && count > 0 ? "table" : undefined}
          >
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
              <>
                <Box className="receipt-list-header" role="row">
                  <span role="columnheader">日付</span>
                  <span role="columnheader">店名・内容</span>
                  <span role="columnheader">カテゴリ</span>
                  <span role="columnheader">金額（円）</span>
                  <span role="columnheader">メモ</span>
                  <span role="columnheader">操作</span>
                </Box>
                {visibleReceipts.map((receipt) => (
                  <ReceiptRow
                    key={receipt._id}
                    receipt={receipt}
                    onDelete={onDeleteReceipt}
                    onEdit={onEditReceipt}
                  />
                ))}
              </>
            )}
          </Box>
          {!isLoading && remainingCount > 0 && (
            <Button
              endIcon={<ExpandMoreIcon />}
              onClick={() => setExpanded(true)}
              sx={{ alignSelf: "center", minHeight: 44, minWidth: 204 }}
              variant="outlined"
            >
              さらに{remainingCount}件を見る
            </Button>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
