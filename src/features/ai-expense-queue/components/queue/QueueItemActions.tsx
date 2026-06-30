import ReplayIcon from "@mui/icons-material/Replay";
import { Button, Stack } from "@mui/material";
import type { AiExpenseQueueItem } from "../../types/types";
import { DeleteQueueButton } from "./DeleteQueueButton";

export function QueueItemActions({
  item,
  onOpenReview,
  onRegisterItem,
  onRetry,
  onDelete,
  onReturnToManualInput,
  isDeleting,
  isRegistering,
}: {
  item: AiExpenseQueueItem;
  onOpenReview: (itemId: string) => void;
  onRegisterItem: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
  onDelete?: (item: AiExpenseQueueItem) => void;
  onReturnToManualInput?: (item: AiExpenseQueueItem) => void;
  isDeleting: boolean;
  isRegistering: boolean;
}) {
  const canDelete = item.status !== "registered" && item.status !== "registering";

  if (item.status === "needs_review") {
    return (
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Button onClick={() => onOpenReview(item.id)} size="small" type="button" variant="outlined">
          確認する
        </Button>
        <DeleteQueueButton isDeleting={isDeleting} item={item} onDelete={onDelete} />
      </Stack>
    );
  }

  if (item.status === "failed") {
    return (
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
    );
  }

  if (item.status === "ready") {
    return (
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
    );
  }

  if ((item.status === "queued" || item.status === "analyzing") && canDelete) {
    return (
      <DeleteQueueButton
        isDeleting={isDeleting}
        item={item}
        onDelete={onDelete}
        sx={{ alignSelf: "flex-start" }}
      />
    );
  }

  return null;
}
