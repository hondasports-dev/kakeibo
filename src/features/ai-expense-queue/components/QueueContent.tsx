import { useState } from "react";
import { Alert, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { BulkRegisterConfirmDialog } from "./BulkRegisterConfirmDialog";
import { displayStatusLabels } from "./labels";
import { QueueSection } from "./QueueSection";
import type { AiExpenseQueueItem } from "../types/types";
import type { useAiExpenseQueuePanel } from "../hooks/useAiExpenseQueuePanel";

const amountFormatter = new Intl.NumberFormat("ja-JP");

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
  readyItems: AiExpenseQueueItem[];
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInFlight, setConfirmInFlight] = useState(false);
  const needsReviewCount = groupedItems.needs_review.length;
  const processingCount = groupedItems.processing.length;
  const failedCount = groupedItems.failed.length;
  const firstReviewItem = groupedItems.needs_review[0];
  const selectedReadyItems = readyItems.filter((item) => selectedReadyIds.includes(item.id));
  const selectedTotalAmountYen = selectedReadyItems.reduce(
    (total, item) => total + (item.amountYen ?? 0),
    0,
  );

  const handleConfirmRegister = async () => {
    if (confirmInFlight) {
      return;
    }
    setConfirmInFlight(true);
    try {
      await onRegisterReady();
      setConfirmOpen(false);
    } finally {
      setConfirmInFlight(false);
    }
  };

  return (
    <Stack spacing={2}>
      {registrationError && (
        <Alert severity="error" variant="outlined">
          {registrationError}
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "stretch" }}>
        <Stack
          className="ai-expense-queue-status-summary"
          direction="row"
          spacing={1}
          sx={{ flex: 1, flexWrap: "wrap", minWidth: 0, width: "100%" }}
        >
          <Chip
            color="default"
            label={`${displayStatusLabels.processing} ${processingCount}件`}
            size="small"
            variant="outlined"
          />
          <Chip
            color="success"
            label={`${displayStatusLabels.ready} ${groupedItems.ready.length}件`}
            size="small"
          />
          <Chip
            color="warning"
            label={`${displayStatusLabels.needs_review} ${needsReviewCount}件`}
            size="small"
          />
          <Chip
            color="error"
            label={`${displayStatusLabels.failed} ${failedCount}件`}
            size="small"
          />
          <Chip
            label={`${displayStatusLabels.registered} ${groupedItems.registered.length}件`}
            size="small"
            variant="outlined"
          />
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
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          未登録の画像をクリア（{clearableCount}件）
        </Button>
      )}

      {readyItems.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="body2">
            登録できる下書きが{readyItems.length}件あります
            {selectedReadyIds.length > 0 &&
              `（選択中 ${selectedReadyIds.length}件 / 合計 ${amountFormatter.format(selectedTotalAmountYen)}円）`}
          </Typography>
          <Button
            color="primary"
            startIcon={<CheckCircleIcon />}
            disabled={selectedReadyIds.length === 0 || registeringIds.length > 0}
            onClick={() => setConfirmOpen(true)}
            type="button"
            variant="contained"
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            まとめて登録（{selectedReadyIds.length}件）
          </Button>
        </Stack>
      )}

      <BulkRegisterConfirmDialog
        confirmDisabled={confirmInFlight || registeringIds.length > 0}
        count={selectedReadyIds.length}
        open={confirmOpen}
        totalAmountYen={selectedTotalAmountYen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmRegister()}
      />

      <Divider />

      <QueueSection
        sectionKey="processing"
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
        sectionKey="ready"
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
        sectionKey="needs_review"
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
        sectionKey="failed"
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
