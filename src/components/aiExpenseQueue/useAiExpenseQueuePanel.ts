import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { getImageFileErrorMessage, resizeImageFileToDataUrl } from "../../utils/imageDataUrl";
import { emptyReviewForm, mapDraftToReviewForm } from "./mappers";
import type { AiExpenseQueueItem, AiExpenseQueuePanelProps, ReviewFormValues } from "./types";
import { useAiExpenseQueueData } from "./useAiExpenseQueueData";

export function useAiExpenseQueuePanel({
  initialItems,
  categories,
  initialReviewDrafts,
  onReviewSubmit,
}: Required<Pick<AiExpenseQueuePanelProps, "categories" | "initialReviewDrafts">> &
  Pick<AiExpenseQueuePanelProps, "initialItems" | "onReviewSubmit">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const retryInputRef = useRef<HTMLInputElement>(null);
  const previousReadyItemIdsRef = useRef<string[]>([]);
  const [selectedReadyIds, setSelectedReadyIds] = useState<string[]>([]);
  const [registeringIds, setRegisteringIds] = useState<string[]>([]);
  const [registrationError, setRegistrationError] = useState("");
  const [retryError, setRetryError] = useState("");
  const [queueDeleteError, setQueueDeleteError] = useState("");
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);
  const [initializedReviewDraftId, setInitializedReviewDraftId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormValues>(emptyReviewForm);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [pendingImageDataUrls, setPendingImageDataUrls] = useState<Map<string, string>>(new Map());
  const [pendingRetryJob, setPendingRetryJob] = useState<Doc<"receiptAnalysisImageJobs"> | null>(
    null,
  );
  const createBatch = useMutation(api.receiptAnalysisJobs.createBatch);
  const analyzeImageJob = useAction(api.receiptAnalysisJobs.analyzeImageJob);
  const retryImageJob = useMutation(api.receiptAnalysisJobs.retryImageJob);
  const cancelImageJob = useMutation(api.receiptAnalysisJobs.cancelImageJob);
  const registerReadyDrafts = useMutation(api.aiExpenseDrafts.registerReadyDrafts);
  const updateForReview = useMutation(api.aiExpenseDrafts.updateForReview);
  const deleteDraft = useMutation(api.aiExpenseDrafts.deleteDraft);
  const {
    clearableItems,
    groupedItems,
    isReviewDraftLoading,
    isReviewDraftNotFound,
    items,
    jobs,
    readyItemIds,
    readyItems,
    selectedReviewDraft,
  } = useAiExpenseQueueData({
    categories,
    hiddenItemIds,
    initialItems,
    initialReviewDrafts,
    registeringIds,
    selectedReviewDraftId,
  });

  useEffect(() => {
    const previousReadyItemIds = previousReadyItemIdsRef.current;
    setSelectedReadyIds((current) => {
      const retained = current.filter((id) => readyItemIds.includes(id));
      const additions = readyItemIds.filter(
        (id) => !previousReadyItemIds.includes(id) && !retained.includes(id),
      );
      const next = [...retained, ...additions];
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
    previousReadyItemIdsRef.current = readyItemIds;
  }, [readyItemIds]);

  useEffect(() => {
    if (
      selectedReviewDraft &&
      selectedReviewDraft._id === selectedReviewDraftId &&
      initializedReviewDraftId !== selectedReviewDraft._id
    ) {
      setReviewForm(mapDraftToReviewForm(selectedReviewDraft));
      setInitializedReviewDraftId(selectedReviewDraft._id);
    }
  }, [initializedReviewDraftId, selectedReviewDraft, selectedReviewDraftId]);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    let fileDataUrls: string[];
    try {
      fileDataUrls = await Promise.all(files.map(resizeImageFileToDataUrl));
    } catch (err) {
      setRetryError(getImageFileErrorMessage(err));
      event.target.value = "";
      return;
    }

    const result = await createBatch({ fileNames: files.map((f) => f.name) });
    if (!result) {
      event.target.value = "";
      return;
    }

    const nextPending = new Map(pendingImageDataUrls);
    for (let i = 0; i < result.jobs.length; i++) {
      nextPending.set(result.jobs[i]._id, fileDataUrls[i]);
    }
    setPendingImageDataUrls(nextPending);

    for (let i = 0; i < result.jobs.length; i++) {
      analyzeImageJob({ jobId: result.jobs[i]._id, imageDataUrl: fileDataUrls[i] }).catch(() => {
        // fire-and-forget: job failures update status via listJobs subscription and show in UI
      });
    }

    event.target.value = "";
  };

  const handleToggleReadySelection = (itemId: string, checked: boolean) => {
    setSelectedReadyIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const handleOpenReview = (itemId: string) => {
    setSelectedReviewDraftId(itemId);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewError("");
  };

  const handleCloseReview = () => {
    if (reviewSubmitting) {
      return;
    }
    setSelectedReviewDraftId(null);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewError("");
  };

  const runRetry = async (job: Doc<"receiptAnalysisImageJobs">, imageDataUrl: string) => {
    setRetryError("");
    setPendingImageDataUrls((current) => {
      const next = new Map(current);
      next.set(job._id, imageDataUrl);
      return next;
    });
    try {
      await retryImageJob({ jobId: job._id });
      await analyzeImageJob({ jobId: job._id, imageDataUrl });
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "再試行に失敗しました");
    }
  };

  const handleRetry = async (draftId: string) => {
    setRetryError("");
    const job = jobs?.find((j) => j.draftId === draftId);
    if (!job) {
      setRetryError("再試行対象の画像ジョブが見つかりません");
      return;
    }
    const imageDataUrl = pendingImageDataUrls.get(job._id);
    if (!imageDataUrl) {
      setPendingRetryJob(job);
      retryInputRef.current?.click();
      return;
    }
    await runRetry(job, imageDataUrl);
  };

  const handleRetryFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const job = pendingRetryJob;
    event.target.value = "";
    setPendingRetryJob(null);
    if (!file || !job) {
      return;
    }
    try {
      const imageDataUrl = await resizeImageFileToDataUrl(file);
      await runRetry(job, imageDataUrl);
    } catch (err) {
      setRetryError(getImageFileErrorMessage(err));
    }
  };

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
      setSelectedReadyIds((current) => current.filter((id) => id !== item.id));
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

  const handleClearOpenQueue = async () => {
    for (const item of clearableItems) {
      await deleteQueueItem(item);
    }
  };

  const handleReviewFieldChange = (field: keyof ReviewFormValues, value: string) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitReview = async (registerAfterUpdate: boolean) => {
    if (!selectedReviewDraftId) {
      return;
    }
    const amountYen = Number(reviewForm.amountYen);
    if (reviewForm.documentType === "unknown") {
      setReviewError("書類種別を選択してください。");
      return;
    }
    if (
      !reviewForm.date ||
      !Number.isInteger(amountYen) ||
      amountYen <= 0 ||
      !reviewForm.categoryId
    ) {
      setReviewError("日付、金額、カテゴリを確認してください。");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    try {
      if (onReviewSubmit) {
        await onReviewSubmit(
          selectedReviewDraftId,
          {
            documentType: reviewForm.documentType,
            shopName: reviewForm.shopName,
            paymentPlace: reviewForm.paymentPlace,
            payeeName: reviewForm.payeeName,
            paymentPurpose: reviewForm.paymentPurpose,
            date: reviewForm.date,
            amountYen,
            categoryId: reviewForm.categoryId,
          },
          registerAfterUpdate,
        );
      } else {
        await updateForReview({
          draftId: selectedReviewDraftId as Id<"aiExpenseDrafts">,
          documentType: reviewForm.documentType,
          shopName: reviewForm.shopName,
          paymentPlace: reviewForm.paymentPlace,
          payeeName: reviewForm.payeeName,
          paymentPurpose: reviewForm.paymentPurpose,
          date: reviewForm.date,
          amountYen,
          categoryId: reviewForm.categoryId as Id<"categories">,
        });

        if (registerAfterUpdate) {
          setRegisteringIds([selectedReviewDraftId]);
          await registerReadyDrafts({
            draftIds: [selectedReviewDraftId as Id<"aiExpenseDrafts">],
          });
        }
      }

      setSelectedReviewDraftId(null);
      setInitializedReviewDraftId(null);
      setReviewForm(emptyReviewForm);
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "下書きの更新に失敗しました。もう一度お試しください。",
      );
    } finally {
      setReviewSubmitting(false);
      if (registerAfterUpdate) {
        setRegisteringIds([]);
      }
    }
  };

  const handleRegisterReady = async () => {
    if (selectedReadyIds.length === 0) {
      return;
    }
    setRegistrationError("");
    setRegisteringIds(selectedReadyIds);
    try {
      await registerReadyDrafts({ draftIds: selectedReadyIds as Id<"aiExpenseDrafts">[] });
      setSelectedReadyIds([]);
    } catch (error) {
      setRegistrationError(
        error instanceof Error
          ? error.message
          : "まとめて登録に失敗しました。もう一度お試しください。",
      );
    } finally {
      setRegisteringIds([]);
    }
  };

  return {
    cameraInputRef,
    clearableItems,
    deletingIds,
    groupedItems,
    inputRef,
    isReviewDraftLoading,
    isReviewDraftNotFound,
    items,
    queueDeleteError,
    readyItems,
    registeringIds,
    registrationError,
    retryError,
    retryInputRef,
    reviewError,
    reviewForm,
    reviewSubmitting,
    selectedReadyIds,
    selectedReviewDraft,
    selectedReviewDraftId,
    setQueueDeleteError,
    setRetryError,
    handleClearOpenQueue,
    handleCloseReview,
    handleFilesSelected,
    handleOpenReview,
    handleRegisterReady,
    handleRetry,
    handleRetryFileSelected,
    handleReviewFieldChange,
    handleSubmitReview,
    handleToggleReadySelection,
    deleteQueueItem,
  };
}
