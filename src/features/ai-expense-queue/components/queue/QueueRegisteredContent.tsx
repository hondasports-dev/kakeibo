import { Stack } from "@mui/material";
import type { QueueRegisteredContentProps } from "./queueContentTypes";
import { QueueSection } from "./QueueSection";

export function QueueRegisteredContent({
  deletingIds,
  groupedItems,
  registeringIds,
  selectedReadyIds,
  onOpenReview,
  onRegisterReady,
  onToggleReadySelection,
}: QueueRegisteredContentProps) {
  return (
    <Stack className="queue-content queue-content-registered" spacing={2}>
      <QueueSection
        sectionKey="registered"
        items={groupedItems.registered}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onRegisterItem={(itemId) => void onRegisterReady([itemId])}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
        registeringIds={registeringIds}
      />
    </Stack>
  );
}
