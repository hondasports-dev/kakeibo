import { Alert, Button, Chip, Divider, Stack } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { QueueSection } from "./QueueSection";
import type { useAiExpenseQueuePanel } from "../hooks/useAiExpenseQueuePanel";

export function QueueContent({
  clearableCount,
  deletingIds,
  groupedItems,
  itemCount,
  readyItems,
  registeringIds,
  registrationError,
  selectedReadyIds,
  onClearOpenQueue,
  onDeleteQueueItem,
  onOpenReview,
  onRegisterReady,
  onRetry,
  onToggleReadySelection,
}: {
  clearableCount: number;
  deletingIds: string[];
  groupedItems: ReturnType<typeof useAiExpenseQueuePanel>["groupedItems"];
  itemCount: number;
  readyItems: ReturnType<typeof useAiExpenseQueuePanel>["readyItems"];
  registeringIds: string[];
  registrationError: string;
  selectedReadyIds: string[];
  onClearOpenQueue: () => Promise<void>;
  onDeleteQueueItem: ReturnType<typeof useAiExpenseQueuePanel>["deleteQueueItem"];
  onOpenReview: (itemId: string) => void;
  onRegisterReady: (itemIds?: string[]) => Promise<void>;
  onRetry: (draftId: string) => Promise<void>;
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
}) {
  const needsReviewCount = groupedItems.needs_review.length;
  const processingCount = groupedItems.processing.length;
  const failedCount = groupedItems.failed.length;
  const firstReviewItem = groupedItems.needs_review[0];

  return (
    <Stack spacing={2}>
      {registrationError && (
        <Alert severity="error" variant="outlined">
          {registrationError}
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "stretch" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", flex: 1 }}>
          <Chip label={`読み取り中 ${processingCount}件`} size="small" variant="outlined" />
          <Chip label={`登録準備OK ${readyItems.length}件`} size="small" color="success" />
          <Chip label={`確認が必要 ${needsReviewCount}件`} size="small" color="warning" />
          <Chip label={`失敗 ${failedCount}件`} size="small" color="error" />
          <Chip label={`追加済み ${itemCount}件`} size="small" variant="outlined" />
        </Stack>
        {firstReviewItem && (
          <Button
            aria-label={`下書きを確認（${needsReviewCount}件）`}
            onClick={() => onOpenReview(firstReviewItem.id)}
            type="button"
            variant="outlined"
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            下書きを確認
          </Button>
        )}
      </Stack>

      {clearableCount > 0 && (
        <Button
          color="error"
          disabled={deletingIds.length > 0}
          onClick={() => void onClearOpenQueue()}
          startIcon={<DeleteIcon />}
          type="button"
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
        >
          未登録の画像をクリア（{clearableCount}件）
        </Button>
      )}

      {readyItems.length > 0 && (
        <Button
          color="primary"
          startIcon={<CheckCircleIcon />}
          disabled={selectedReadyIds.length === 0 || registeringIds.length > 0}
          onClick={() => void onRegisterReady()}
          type="button"
          variant="contained"
          sx={{ alignSelf: "flex-start" }}
        >
          選択中の登録準備OKをまとめて登録（{selectedReadyIds.length}件）
        </Button>
      )}

      <Divider />

      <QueueSection
        label="読み取り中"
        items={groupedItems.processing}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onRegisterItem={(itemId) => void onRegisterReady([itemId])}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
        registeringIds={registeringIds}
      />
      <QueueSection
        label="登録準備OK"
        items={groupedItems.ready}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onRegisterItem={(itemId) => void onRegisterReady([itemId])}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
        registeringIds={registeringIds}
      />
      <QueueSection
        label="確認が必要"
        items={groupedItems.needs_review}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onRegisterItem={(itemId) => void onRegisterReady([itemId])}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
        registeringIds={registeringIds}
      />
      <QueueSection
        label="失敗"
        items={groupedItems.failed}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onRegisterItem={(itemId) => void onRegisterReady([itemId])}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onRetry={onRetry}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
        registeringIds={registeringIds}
      />
      <QueueSection
        label="登録済み"
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
