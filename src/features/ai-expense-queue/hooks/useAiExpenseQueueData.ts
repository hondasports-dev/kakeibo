import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { getSectionKey } from "../components/labels";
import { mapDraftToQueueItem } from "../utils/mappers";
import type { AiExpenseDraft, AiExpenseQueueCategory, AiExpenseQueueItem } from "../types/types";

export function useAiExpenseQueueData({
  categories,
  hiddenItemIds,
  initialItems,
}: {
  categories: AiExpenseQueueCategory[];
  hiddenItemIds: string[];
  initialItems?: AiExpenseQueueItem[];
}) {
  const readyDrafts = useQuery(api.aiExpenseDrafts.listByStatus, { status: "ready" }) as
    | AiExpenseDraft[]
    | undefined;
  const needsReviewDrafts = useQuery(api.aiExpenseDrafts.listByStatus, {
    status: "needs_review",
  }) as AiExpenseDraft[] | undefined;
  const failedDrafts = useQuery(api.aiExpenseDrafts.listByStatus, { status: "failed" }) as
    | AiExpenseDraft[]
    | undefined;
  const registeredDrafts = useQuery(api.aiExpenseDrafts.listByStatus, { status: "registered" }) as
    | AiExpenseDraft[]
    | undefined;
  const jobs = useQuery(api.receiptAnalysisJobs.listJobs) as
    | Doc<"receiptAnalysisImageJobs">[]
    | undefined;

  const processingItems = useMemo(() => {
    return (jobs ?? [])
      .filter((job) => job.status === "queued" || job.status === "running")
      .map(
        (job): AiExpenseQueueItem => ({
          id: job._id,
          fileName: job.fileName,
          status: job.status === "queued" ? "queued" : "analyzing",
          documentType: "unknown",
        }),
      );
  }, [jobs]);

  const liveItems = useMemo(() => {
    return [
      ...processingItems,
      ...(readyDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, {}, categories)),
      ...(needsReviewDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, {}, categories)),
      ...(failedDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, {}, categories)),
      ...(registeredDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, {}, categories)),
    ];
  }, [processingItems, failedDrafts, needsReviewDrafts, readyDrafts, registeredDrafts, categories]);

  const items = useMemo(() => {
    if (initialItems && initialItems.length > 0) {
      return [...initialItems, ...processingItems].filter(
        (item) => !hiddenItemIds.includes(item.id),
      );
    }
    return liveItems.filter((item) => !hiddenItemIds.includes(item.id));
  }, [hiddenItemIds, initialItems, processingItems, liveItems]);
  const readyItems = useMemo(
    () => items.filter((item) => getSectionKey(item.status) === "ready"),
    [items],
  );
  const readyItemIds = useMemo(() => readyItems.map((item) => item.id), [readyItems]);
  const groupedItems = {
    processing: items.filter((item) => getSectionKey(item.status) === "processing"),
    ready: readyItems,
    needs_review: items.filter((item) => getSectionKey(item.status) === "needs_review"),
    failed: items.filter((item) => getSectionKey(item.status) === "failed"),
    registered: items.filter((item) => getSectionKey(item.status) === "registered"),
  };
  const clearableItems = items.filter(
    (item) => item.status !== "registered" && item.status !== "registering",
  );

  return {
    clearableItems,
    groupedItems,
    items,
    jobs,
    readyItemIds,
    readyItems,
  };
}
