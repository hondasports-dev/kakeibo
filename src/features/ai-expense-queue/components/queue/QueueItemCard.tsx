import { Box, Checkbox, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { documentTypeLabels, getSectionKey } from "../labels";
import { ReviewReasonChips } from "../ReviewReasonChips";
import { StatusChip } from "../StatusChip";
import type { AiExpenseQueueItem } from "../../types/types";
import { formatQueueDate, queueAmountFormatter } from "./queueDisplayFormatters";
import { QueueItemActions } from "./QueueItemActions";

export function QueueItemCard({
  item,
  isSelected,
  onToggleReadySelection,
  onOpenReview,
  onRegisterItem,
  onRetry,
  onDelete,
  onReturnToManualInput,
  isDeleting,
  isRegistering,
}: {
  item: AiExpenseQueueItem;
  isSelected: boolean;
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
  onRegisterItem: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
  onDelete?: (item: AiExpenseQueueItem) => void;
  onReturnToManualInput?: (item: AiExpenseQueueItem) => void;
  isDeleting: boolean;
  isRegistering: boolean;
}) {
  const secondaryLabel = item.fileName ?? "AI支出下書き";
  const metadata = [
    item.date ? formatQueueDate(item.date) : undefined,
    item.amountYen !== undefined ? `${queueAmountFormatter.format(item.amountYen)}円` : undefined,
  ]
    .filter(Boolean)
    .join(" ・ ");
  const reviewReasons = Array.from(
    new Set([
      ...(item.reviewReasons ?? []),
      ...(item.hasUncategorizedItems ? ["ambiguous_category"] : []),
      ...(item.hasLowConfidenceItems ? ["low_confidence"] : []),
    ]),
  );

  return (
    <Box className={`ai-expense-queue-item ai-expense-queue-item-${getSectionKey(item.status)}`}>
      <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
          {item.status === "ready" && (
            <Checkbox
              checked={isSelected}
              onChange={(event) => onToggleReadySelection(item.id, event.target.checked)}
              size="small"
              slotProps={{
                input: { "aria-label": `${item.title || secondaryLabel}を登録対象に含める` },
              }}
              sx={{ mt: -0.5 }}
            />
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              className="ai-expense-queue-item-title"
              sx={{ fontWeight: 700 }}
              title={item.title || secondaryLabel}
            >
              {item.title || secondaryLabel}
            </Typography>
            {item.title && (
              <Typography
                className="ai-expense-queue-item-secondary"
                color="text.secondary"
                title={secondaryLabel}
                variant="body2"
              >
                {secondaryLabel}
              </Typography>
            )}
          </Box>
        </Stack>

        {metadata && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {metadata}
            </Typography>
            <Chip label={documentTypeLabels[item.documentType]} size="small" variant="outlined" />
            {item.categoryName && (
              <Chip label={item.categoryName} size="small" variant="outlined" />
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <StatusChip status={item.status} />
          <ReviewReasonChips reasons={reviewReasons} status={item.status} />
        </Stack>

        {(item.status === "analyzing" || item.status === "registering") && (
          <LinearProgress
            aria-label={`${secondaryLabel}の処理状況`}
            sx={{ height: 4, borderRadius: 2 }}
          />
        )}

        {item.categoryAggregates && item.categoryAggregates.length > 0 && (
          <Stack spacing={0.75}>
            <Typography color="text.secondary" variant="body2">
              カテゴリ別登録候補
              {item.itemTotalYen !== undefined &&
                ` ${queueAmountFormatter.format(item.itemTotalYen)}円`}
              {item.itemDifferenceYen !== undefined &&
                item.itemDifferenceYen !== 0 &&
                ` / 差額 ${queueAmountFormatter.format(item.itemDifferenceYen)}円`}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
              {item.categoryAggregates.map((aggregate) => (
                <Chip
                  key={aggregate.categoryId}
                  label={`${aggregate.categoryName ?? "カテゴリ"} ${queueAmountFormatter.format(aggregate.amountYen)}円`}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Stack>
        )}

        <QueueItemActions
          isDeleting={isDeleting}
          isRegistering={isRegistering}
          item={item}
          onDelete={onDelete}
          onOpenReview={onOpenReview}
          onRegisterItem={onRegisterItem}
          onRetry={onRetry}
          onReturnToManualInput={onReturnToManualInput}
        />
      </Stack>
    </Box>
  );
}
