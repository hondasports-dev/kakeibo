import { Alert, Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { QueueSection } from "./aiExpenseQueue/QueueSection";
import { ReviewDialog } from "./aiExpenseQueue/ReviewDialog";
import { useAiExpenseQueuePanel } from "./aiExpenseQueue/useAiExpenseQueuePanel";
import type { AiExpenseQueuePanelProps } from "./aiExpenseQueue/types";

export type { AiExpenseQueueItem } from "./aiExpenseQueue/types";

export function AiExpenseQueuePanel({
  initialItems,
  categories = [],
  initialReviewDrafts = {},
  onReviewSubmit,
}: AiExpenseQueuePanelProps) {
  const queue = useAiExpenseQueuePanel({
    initialItems,
    categories,
    initialReviewDrafts,
    onReviewSubmit,
  });

  return (
    <Box
      aria-labelledby="ai-expense-queue-heading"
      className="ai-expense-queue"
      component="section"
    >
      <Stack spacing={2}>
        <QueueHeader
          inputRef={queue.inputRef}
          cameraInputRef={queue.cameraInputRef}
          retryInputRef={queue.retryInputRef}
          onFilesSelected={queue.handleFilesSelected}
          onRetryFileSelected={queue.handleRetryFileSelected}
        />

        {queue.retryError && (
          <Alert severity="error" variant="outlined" onClose={() => queue.setRetryError("")}>
            {queue.retryError}
          </Alert>
        )}

        {queue.queueDeleteError && (
          <Alert severity="error" variant="outlined" onClose={() => queue.setQueueDeleteError("")}>
            {queue.queueDeleteError}
          </Alert>
        )}

        {queue.items.length === 0 ? (
          <Alert severity="info" variant="outlined">
            追加した画像はここに状態別で表示されます。
          </Alert>
        ) : (
          <QueueContent
            clearableCount={queue.clearableItems.length}
            deletingIds={queue.deletingIds}
            groupedItems={queue.groupedItems}
            itemCount={queue.items.length}
            readyItems={queue.readyItems}
            registeringIds={queue.registeringIds}
            registrationError={queue.registrationError}
            selectedReadyIds={queue.selectedReadyIds}
            onClearOpenQueue={queue.handleClearOpenQueue}
            onDeleteQueueItem={queue.deleteQueueItem}
            onOpenReview={queue.handleOpenReview}
            onRegisterReady={queue.handleRegisterReady}
            onRetry={queue.handleRetry}
            onToggleReadySelection={queue.handleToggleReadySelection}
          />
        )}
      </Stack>

      <ReviewDialog
        open={queue.selectedReviewDraftId !== null}
        categories={categories}
        isReviewDraftLoading={queue.isReviewDraftLoading}
        isReviewDraftNotFound={queue.isReviewDraftNotFound}
        selectedReviewDraft={queue.selectedReviewDraft}
        reviewError={queue.reviewError}
        reviewForm={queue.reviewForm}
        reviewSubmitting={queue.reviewSubmitting}
        onClose={queue.handleCloseReview}
        onFieldChange={queue.handleReviewFieldChange}
        onSubmit={(registerAfterUpdate) => void queue.handleSubmitReview(registerAfterUpdate)}
      />
    </Box>
  );
}

function QueueHeader({
  inputRef,
  cameraInputRef,
  retryInputRef,
  onFilesSelected,
  onRetryFileSelected,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  retryInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
  onRetryFileSelected: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
    >
      <Box>
        <Typography component="h2" id="ai-expense-queue-heading" variant="h5">
          AI処理キュー
        </Typography>
        <Typography color="text.secondary" variant="body2">
          レシート・払込票をまとめて追加できます。
        </Typography>
        <Typography color="text.secondary" variant="body2">
          スマートフォンでは撮影、PCでは画像選択から追加できます。
        </Typography>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <ImageInputButton
          buttonLabel="撮影する"
          inputLabel="AI処理キューへカメラで追加"
          inputRef={cameraInputRef}
          onFilesSelected={onFilesSelected}
          variant="contained"
          capture
        />
        <ImageInputButton
          buttonLabel="画像を追加"
          inputLabel="AI処理キューへ画像を追加"
          inputRef={inputRef}
          onFilesSelected={onFilesSelected}
          variant="outlined"
        />
      </Stack>
      <input
        accept="image/*"
        aria-label="再試行する画像を選択"
        className="visually-hidden-file-input"
        onChange={onRetryFileSelected}
        ref={retryInputRef}
        tabIndex={-1}
        type="file"
      />
    </Stack>
  );
}

function ImageInputButton({
  buttonLabel,
  inputLabel,
  inputRef,
  onFilesSelected,
  variant,
  capture = false,
}: {
  buttonLabel: string;
  inputLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
  variant: "contained" | "outlined";
  capture?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Button
        onClick={() => inputRef.current?.click()}
        startIcon={<AddPhotoAlternateIcon />}
        type="button"
        variant={variant}
      >
        {buttonLabel}
      </Button>
      <input
        accept="image/*"
        aria-label={inputLabel}
        capture={capture ? "environment" : undefined}
        className="visually-hidden-file-input"
        multiple
        onChange={onFilesSelected}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </Box>
  );
}

function QueueContent({
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
  onRegisterReady: () => Promise<void>;
  onRetry: (draftId: string) => Promise<void>;
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
}) {
  return (
    <Stack spacing={2}>
      {registrationError && (
        <Alert severity="error" variant="outlined">
          {registrationError}
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Chip label={`キュー ${itemCount}件`} size="small" variant="outlined" />
        <Chip label={`登録準備OK ${readyItems.length}件`} size="small" color="success" />
        <Chip
          label={`確認が必要 ${groupedItems.needs_review.length}件`}
          size="small"
          color="warning"
        />
        <Chip label={`失敗 ${groupedItems.failed.length}件`} size="small" color="error" />
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
          未登録のキューをクリア（{clearableCount}件）
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
        label="AI処理中"
        items={groupedItems.processing}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
      />
      <QueueSection
        label="登録準備OK"
        items={groupedItems.ready}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
      />
      <QueueSection
        label="確認が必要"
        items={groupedItems.needs_review}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
      />
      <QueueSection
        label="失敗"
        items={groupedItems.failed}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onDelete={(item) => void onDeleteQueueItem(item)}
        onRetry={onRetry}
        onReturnToManualInput={(item) => void onDeleteQueueItem(item)}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
      />
      <QueueSection
        label="登録済み"
        items={groupedItems.registered}
        selectedReadyIds={selectedReadyIds}
        onOpenReview={onOpenReview}
        onToggleReadySelection={onToggleReadySelection}
        deletingIds={deletingIds}
      />
    </Stack>
  );
}
