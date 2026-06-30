import { useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { isDraftWithItems } from "../../utils/mappers";
import type {
  AiExpenseDraft,
  AiExpenseDraftItem,
  AiExpenseDraftWithItems,
} from "../../types/types";

export function useReviewDraftSelection({
  initialReviewDrafts,
  initialReviewDraftItems,
}: {
  initialReviewDrafts: Record<string, AiExpenseDraft>;
  initialReviewDraftItems: Record<string, AiExpenseDraftItem[]>;
}) {
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);

  const localReviewDraft = selectedReviewDraftId
    ? initialReviewDrafts[selectedReviewDraftId]
    : undefined;
  const localReviewItems = selectedReviewDraftId
    ? initialReviewDraftItems[selectedReviewDraftId]
    : undefined;
  const selectedReviewDraftDetails = useQuery(
    api.aiExpenseDrafts.queries.getWithItems,
    selectedReviewDraftId && !localReviewDraft
      ? { draftId: selectedReviewDraftId as Id<"aiExpenseDrafts"> }
      : "skip",
  ) as AiExpenseDraftWithItems | null | undefined;

  const selectedReviewDraft = localReviewDraft
    ? localReviewDraft
    : isDraftWithItems(selectedReviewDraftDetails)
      ? selectedReviewDraftDetails.draft
      : null;
  const isReviewDraftNotFound =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === null;
  const isReviewDraftLoading =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === undefined;

  const clearSelection = () => {
    setSelectedReviewDraftId(null);
  };

  return {
    selectedReviewDraftId,
    setSelectedReviewDraftId,
    localReviewItems,
    selectedReviewDraftDetails,
    selectedReviewDraft,
    isReviewDraftNotFound,
    isReviewDraftLoading,
    clearSelection,
  };
}
