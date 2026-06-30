import { Box, Chip, Stack, Typography } from "@mui/material";
import { queueSectionDescriptions, queueSectionLabels } from "../labels";
import type { AiExpenseQueueItem, QueueSectionKey } from "../../types/types";
import { QueueItemCard } from "./QueueItemCard";

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
