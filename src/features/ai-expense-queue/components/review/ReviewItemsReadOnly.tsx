import { Alert, Box, Stack, Typography } from "@mui/material";
import type { AiExpenseDraft, AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";
import { buildTaxContextFromReviewItem } from "../../utils/receiptItemTaxViewModel";
import { formatTaxWarnings } from "../../utils/taxWarnings";
import { ReceiptItemRow } from "./ReceiptItemRow";
import { ReceiptItemTaxDetail } from "./ReceiptItemTaxDetail";

export function ReviewItemsReadOnly({
  categories,
  draft,
  reviewItems,
  expandedItemId,
  onToggleItemDetail,
}: {
  categories: AiExpenseQueueCategory[];
  draft: AiExpenseDraft | null;
  reviewItems: ReviewItemValues[];
  expandedItemId?: string | null;
  onToggleItemDetail?: (itemId: string) => void;
}) {
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {reviewItems.map((item) => {
        const categoryName =
          categories.find((category) => category._id === item.categoryId)?.name ?? "未分類";
        const context = buildTaxContextFromReviewItem(item);
        const isDetailOpen = expandedItemId === item.id;

        return (
          <Box
            component="li"
            key={item.id}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              pb: 0.75,
            }}
          >
            <ReceiptItemRow
              item={item}
              onOpenDetail={onToggleItemDetail ? () => onToggleItemDetail(item.id) : undefined}
            />
            <Typography color="text.secondary" sx={{ mt: 0.25 }} variant="caption">
              カテゴリ: {categoryName}
            </Typography>
            {context.status === "unresolved" && (
              <Typography color="warning.main" sx={{ mt: 0.25 }} variant="caption">
                税率を確認してください
              </Typography>
            )}
            {isDetailOpen && (
              <Box sx={{ mt: 1 }}>
                <ReceiptItemTaxDetail draft={draft} item={item} />
              </Box>
            )}
            {item.warnings && item.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 0.5 }} variant="outlined">
                {formatTaxWarnings(item.warnings)}
              </Alert>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
