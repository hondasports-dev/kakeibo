import { useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { ReceiptGroupRow } from "./ReceiptGroupRow";
import { groupReceiptItems, type ReceiptItem } from "../types/types";

export function ReceiptListCard({
  count,
  emptyMessage = "まだレシートがありません",
  heading,
  isLoading,
  listAriaLabel = "週次サマリーの支出一覧",
  maxVisibleGroups = 5,
  receipts,
  onDeleteReceipt,
  onEditReceipt,
}: {
  count: number;
  emptyMessage?: string;
  heading?: string;
  isLoading: boolean;
  listAriaLabel?: string;
  maxVisibleGroups?: number;
  receipts: ReceiptItem[];
  onDeleteReceipt?: (receipt: ReceiptItem) => void;
  onEditReceipt?: (receipt: ReceiptItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const orderedReceiptGroups = groupReceiptItems(receipts)
    .map((group, index) => ({ group, index }))
    .sort((a, b) => b.group.date.localeCompare(a.group.date) || b.index - a.index)
    .map(({ group }) => group);
  const visibleReceiptGroups =
    expanded || maxVisibleGroups === Number.POSITIVE_INFINITY
      ? orderedReceiptGroups
      : orderedReceiptGroups.slice(0, maxVisibleGroups);
  const remainingCount = Math.max(orderedReceiptGroups.length - visibleReceiptGroups.length, 0);

  return (
    <Paper className="paper-panel weekly-receipt-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            {heading ?? `支出一覧（${orderedReceiptGroups.length}件）`}
          </Typography>

          <Box
            aria-label={listAriaLabel}
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
                {emptyMessage}
              </Typography>
            ) : (
              <>
                <Box className="receipt-list-header" role="row">
                  <span role="columnheader">日付</span>
                  <span role="columnheader">店名・内訳</span>
                  <span role="columnheader">金額（円）</span>
                  <span role="columnheader">メモ</span>
                  <span role="columnheader">操作</span>
                </Box>
                {visibleReceiptGroups.map((group) => (
                  <ReceiptGroupRow
                    key={group.id}
                    group={group}
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
