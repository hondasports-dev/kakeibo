import { useMemo } from "react";
import { useQuery } from "convex/react";
import { listByStatusApi } from "../../../lib/repositories/aiExpenseDrafts";
import { listJobsApi } from "../../../lib/repositories/receiptAnalysisJobs";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { getSectionKey } from "../components/labels";
import { FAILED_IMAGE_CAPTURE_HINT, mapDraftToQueueItem } from "../utils/mappers";
import type { AiExpenseDraft, AiExpenseQueueCategory, AiExpenseQueueItem } from "../types/types";

export function useAiExpenseQueueData({
  categories,
  hiddenItemIds,
  pendingImageDataUrls,
  initialItems,
}: {
  categories: AiExpenseQueueCategory[];
  hiddenItemIds: string[];
  pendingImageDataUrls: Map<string, string>;
  initialItems?: AiExpenseQueueItem[];
}) {
  const readyDrafts = useQuery(listByStatusApi(), { status: "ready" }) as
    | AiExpenseDraft[]
    | undefined;
  const needsReviewDrafts = useQuery(listByStatusApi(), {
    status: "needs_review",
  }) as AiExpenseDraft[] | undefined;
  const failedDrafts = useQuery(listByStatusApi(), { status: "failed" }) as
    | AiExpenseDraft[]
    | undefined;
  const registeredDrafts = useQuery(listByStatusApi(), {
    status: "registered",
  }) as AiExpenseDraft[] | undefined;
  const jobs = useQuery(listJobsApi()) as Doc<"receiptAnalysisImageJobs">[] | undefined;
  const jobByDraftId = useMemo(() => {
    const result = new Map<string, Doc<"receiptAnalysisImageJobs">>();
    for (const job of jobs ?? []) {
      if (job.draftId) {
        result.set(job.draftId, job);
      }
    }
    return result;
  }, [jobs]);

  const processingItems = useMemo(() => {
    return (jobs ?? [])
      .filter((job) => job.status === "queued" || job.status === "running")
      .map(
        (job): AiExpenseQueueItem => ({
          id: job._id,
          fileName: job.fileName,
          previewImageDataUrl: pendingImageDataUrls.get(job._id),
          status: job.status === "queued" ? "queued" : "analyzing",
          documentType: "unknown",
        }),
      );
  }, [jobs, pendingImageDataUrls]);

  const initialItemsWithSessionData = useMemo(
    () =>
      initialItems?.map((item) => {
        const job = jobByDraftId.get(item.id);
        return {
          ...item,
          previewImageDataUrl:
            item.previewImageDataUrl ?? (job ? pendingImageDataUrls.get(job._id) : undefined),
          failureHint:
            item.failureHint ?? (item.status === "failed" ? FAILED_IMAGE_CAPTURE_HINT : undefined),
        };
      }),
    [initialItems, jobByDraftId, pendingImageDataUrls],
  );

  const liveItems = useMemo(() => {
    return [
      ...processingItems,
      ...(readyDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(
          draft,
          {},
          categories,
          pendingImageDataUrls.get(jobByDraftId.get(draft._id)?._id ?? ""),
        ),
      ),
      ...(needsReviewDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(
          draft,
          {},
          categories,
          pendingImageDataUrls.get(jobByDraftId.get(draft._id)?._id ?? ""),
        ),
      ),
      ...(failedDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(
          draft,
          {},
          categories,
          pendingImageDataUrls.get(jobByDraftId.get(draft._id)?._id ?? ""),
        ),
      ),
      ...(registeredDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(
          draft,
          {},
          categories,
          pendingImageDataUrls.get(jobByDraftId.get(draft._id)?._id ?? ""),
        ),
      ),
    ];
  }, [
    processingItems,
    failedDrafts,
    needsReviewDrafts,
    readyDrafts,
    registeredDrafts,
    categories,
    jobByDraftId,
    pendingImageDataUrls,
  ]);

  const items = useMemo(() => {
    if (initialItemsWithSessionData && initialItemsWithSessionData.length > 0) {
      return [...initialItemsWithSessionData, ...processingItems].filter(
        (item) => !hiddenItemIds.includes(item.id),
      );
    }
    return liveItems.filter((item) => !hiddenItemIds.includes(item.id));
  }, [hiddenItemIds, initialItemsWithSessionData, processingItems, liveItems]);
  const readySectionItems = useMemo(
    () => items.filter((item) => getSectionKey(item.status) === "ready"),
    [items],
  );
  const readyItems = useMemo(() => items.filter((item) => item.status === "ready"), [items]);
  const readyItemIds = useMemo(() => readyItems.map((item) => item.id), [readyItems]);
  const groupedItems = {
    processing: items.filter((item) => getSectionKey(item.status) === "processing"),
    ready: readySectionItems,
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
