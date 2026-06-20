import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import type { AiExpenseQueueItem } from "../types/types";

export function useQueueDelete() {
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [queueDeleteError, setQueueDeleteError] = useState("");

  const cancelImageJob = useMutation(api.receiptAnalysisJobs.cancelImageJob);
  const deleteDraft = useMutation(api.aiExpenseDrafts.deleteDraft);

  const deleteQueueItem = async (item: AiExpenseQueueItem) => {
    if (deletingIds.includes(item.id)) {
      return;
    }
    setQueueDeleteError("");
    setDeletingIds((current) => [...current, item.id]);
    try {
      if (item.status === "queued" || item.status === "analyzing") {
        await cancelImageJob({ jobId: item.id as Id<"receiptAnalysisImageJobs"> });
      } else {
        await deleteDraft({ draftId: item.id as Id<"aiExpenseDrafts"> });
      }
      setHiddenItemIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
    } catch (error) {
      setQueueDeleteError(
        error instanceof Error
          ? error.message
          : "キューから削除できませんでした。もう一度お試しください。",
      );
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== item.id));
    }
  };

  const handleClearOpenQueue = async (clearableItems: AiExpenseQueueItem[]) => {
    for (const item of clearableItems) {
      await deleteQueueItem(item);
    }
  };

  return {
    deletingIds,
    hiddenItemIds,
    queueDeleteError,
    setDeletingIds,
    setHiddenItemIds,
    setQueueDeleteError,
    deleteQueueItem,
    handleClearOpenQueue,
  };
}
