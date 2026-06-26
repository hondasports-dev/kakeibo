import DeleteIcon from "@mui/icons-material/Delete";
import ReplayIcon from "@mui/icons-material/Replay";
import { Box, Button, Checkbox, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import {
  documentTypeLabels,
  getSectionKey,
  queueSectionDescriptions,
  queueSectionLabels,
} from "./labels";
import { ReviewReasonChips } from "./ReviewReasonChips";
import { StatusChip } from "./StatusChip";
import type { AiExpenseQueueItem, QueueSectionKey } from "../types/types";

const queueDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const queueAmountFormatter = new Intl.NumberFormat("ja-JP");

function formatQueueDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }
  return queueDateFormatter.format(parsedDate);
}

function QueueItemCard({
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
  const canDelete = item.status !== "registered" && item.status !== "registering";
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
      <Stack spacing={1}>
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
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {item.title || secondaryLabel}
            </Typography>
            {item.title && (
              <Typography color="text.secondary" variant="body2" noWrap>
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

        {item.status === "needs_review" && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              onClick={() => onOpenReview(item.id)}
              size="small"
              type="button"
              variant="outlined"
            >
              確認する
            </Button>
            <DeleteQueueButton isDeleting={isDeleting} item={item} onDelete={onDelete} />
          </Stack>
        )}

        {item.status === "failed" && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<ReplayIcon fontSize="small" />}
              onClick={() => onRetry?.(item.id)}
              type="button"
              variant="outlined"
            >
              再試行
            </Button>
            <Button
              disabled={isDeleting}
              onClick={() => onReturnToManualInput?.(item)}
              size="small"
              type="button"
              variant="text"
            >
              手入力へ戻る
            </Button>
            <DeleteQueueButton isDeleting={isDeleting} item={item} onDelete={onDelete} />
          </Stack>
        )}

        {item.status === "ready" && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              disabled={isRegistering}
              onClick={() => onRegisterItem(item.id)}
              size="small"
              type="button"
              variant="contained"
            >
              登録する
            </Button>
            <DeleteQueueButton isDeleting={isDeleting} item={item} onDelete={onDelete} />
          </Stack>
        )}

        {(item.status === "queued" || item.status === "analyzing") && canDelete && (
          <DeleteQueueButton
            isDeleting={isDeleting}
            item={item}
            onDelete={onDelete}
            sx={{ alignSelf: "flex-start" }}
          />
        )}
      </Stack>
    </Box>
  );
}

function DeleteQueueButton({
  item,
  onDelete,
  isDeleting,
  sx,
}: {
  item: AiExpenseQueueItem;
  onDelete?: (item: AiExpenseQueueItem) => void;
  isDeleting: boolean;
  sx?: object;
}) {
  return (
    <Button
      color="error"
      disabled={isDeleting}
      onClick={() => onDelete?.(item)}
      size="small"
      startIcon={<DeleteIcon fontSize="small" />}
      type="button"
      variant="text"
      sx={sx}
    >
      一覧から削除
    </Button>
  );
}

export function QueueSection({
  sectionKey,
  items,
  selectedReadyIds,
  onToggleReadySelection,
  onOpenReview,
  onRegisterItem,
  onRetry,
  onDelete,
  onReturnToManualInput,
  deletingIds,
  registeringIds,
}: {
  sectionKey: QueueSectionKey;
  items: AiExpenseQueueItem[];
  selectedReadyIds: string[];
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
  onRegisterItem: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
  onDelete?: (item: AiExpenseQueueItem) => void;
  onReturnToManualInput?: (item: AiExpenseQueueItem) => void;
  deletingIds: string[];
  registeringIds: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  const label = queueSectionLabels[sectionKey];
  const description = queueSectionDescriptions[sectionKey];

  return (
    <Box aria-label={label} role="region">
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {label}
          </Typography>
          <Chip label={`${items.length}件`} size="small" variant="outlined" />
        </Stack>
        {description && (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        )}
        <Stack spacing={1}>
          {items.map((item) => (
            <QueueItemCard
              isSelected={selectedReadyIds.includes(item.id)}
              item={item}
              isDeleting={deletingIds.includes(item.id)}
              isRegistering={registeringIds.includes(item.id)}
              key={item.id}
              onDelete={onDelete}
              onOpenReview={onOpenReview}
              onRegisterItem={onRegisterItem}
              onRetry={onRetry}
              onReturnToManualInput={onReturnToManualInput}
              onToggleReadySelection={onToggleReadySelection}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
