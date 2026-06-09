import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HelpIcon from "@mui/icons-material/Help";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ReplayIcon from "@mui/icons-material/Replay";
import { getImageFileErrorMessage, resizeImageFileToDataUrl } from "../utils/imageDataUrl";
import { formatDateForDisplay } from "../lib/dateFormat";

export type AiExpenseQueueStatus =
  | "adding"
  | "queued"
  | "analyzing"
  | "ready"
  | "needs_review"
  | "failed"
  | "registering"
  | "registered";

export type AiExpenseQueueDocumentType = "receipt" | "convenience_payment" | "unknown";

export type AiExpenseQueueItem = {
  id: string;
  fileName?: string;
  status: AiExpenseQueueStatus;
  documentType: AiExpenseQueueDocumentType;
  title?: string;
  amountYen?: number;
  date?: string;
  categoryName?: string;
  reviewReasons?: string[];
};

type QueueSectionKey = "processing" | "ready" | "needs_review" | "failed" | "registered";

type AiExpenseQueuePanelProps = {
  initialItems?: AiExpenseQueueItem[];
  categories?: Array<{ _id: Id<"categories"> | string; name: string; color: string }>;
  initialReviewDrafts?: Record<string, AiExpenseDraft>;
  onReviewSubmit?: (
    draftId: string,
    values: {
      documentType: AiExpenseQueueDocumentType;
      shopName: string;
      paymentPlace: string;
      payeeName: string;
      paymentPurpose: string;
      date: string;
      amountYen: number;
      categoryId: string;
    },
    registerAfterUpdate: boolean,
  ) => Promise<void> | void;
};

type AiExpenseDraftStatus = "ready" | "needs_review" | "failed" | "registered";

type AiExpenseDraft = {
  _id: string;
  status: AiExpenseDraftStatus;
  documentType: AiExpenseQueueDocumentType;
  imageFileName?: string;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: string;
  reviewReasons: string[];
  warnings?: string[];
};

type AiExpenseDraftWithItems = {
  draft: AiExpenseDraft;
  items: unknown[];
};

type ReviewFormValues = {
  documentType: AiExpenseQueueDocumentType;
  shopName: string;
  paymentPlace: string;
  payeeName: string;
  paymentPurpose: string;
  date: string;
  amountYen: string;
  categoryId: string;
};

const statusLabels: Record<AiExpenseQueueStatus, string> = {
  adding: "追加中",
  queued: "解析待ち",
  analyzing: "解析中",
  ready: "登録準備OK",
  needs_review: "確認が必要",
  failed: "失敗",
  registering: "登録中",
  registered: "登録済み",
};

const documentTypeLabels: Record<AiExpenseQueueDocumentType, string> = {
  receipt: "レシート",
  convenience_payment: "払込票",
  unknown: "種別未判定",
};

const reviewDocumentTypeOptions = Object.entries(documentTypeLabels).filter(
  ([value]) => value !== "unknown",
);

const reviewReasonLabels: Record<string, string> = {
  low_confidence: "信頼度が低い項目があります",
  missing_required_field: "必須項目を確認してください",
  ambiguous_document_type: "書類種別を確認してください",
  ambiguous_category: "カテゴリを確認してください",
  amount_mismatch: "明細合計と合計金額が一致しません",
  parse_failed: "画像解析に失敗しました",
};

const emptyReviewForm: ReviewFormValues = {
  documentType: "receipt",
  shopName: "",
  paymentPlace: "",
  payeeName: "",
  paymentPurpose: "",
  date: "",
  amountYen: "",
  categoryId: "",
};

function getReviewReasonLabel(reason: string) {
  return reviewReasonLabels[reason] ?? reason;
}

function resolveDraftTitle(draft: AiExpenseDraft) {
  if (draft.documentType === "convenience_payment") {
    return (
      [draft.payeeName, draft.paymentPurpose, draft.paymentPlace].find(Boolean) ?? "AI支出下書き"
    );
  }
  return draft.shopName || draft.payeeName || draft.paymentPlace || "AI支出下書き";
}

function mapDraftToQueueItem(
  draft: AiExpenseDraft,
  statusOverrides: Partial<Record<string, AiExpenseQueueStatus>>,
  categories?: Array<{ _id: string; name: string }>,
): AiExpenseQueueItem {
  const categoryName = categories?.find((c) => c._id === draft.categoryId)?.name;
  return {
    id: draft._id,
    fileName: draft.imageFileName ?? "AI支出下書き",
    status: statusOverrides[draft._id] ?? draft.status,
    documentType: draft.documentType,
    title: resolveDraftTitle(draft),
    amountYen: draft.amountYen,
    date: draft.date,
    categoryName,
    reviewReasons: draft.reviewReasons,
  };
}

function mapDraftToReviewForm(draft: AiExpenseDraft): ReviewFormValues {
  return {
    documentType: draft.documentType,
    shopName: draft.shopName ?? "",
    paymentPlace: draft.paymentPlace ?? "",
    payeeName: draft.payeeName ?? "",
    paymentPurpose: draft.paymentPurpose ?? "",
    date: draft.date ?? "",
    amountYen: draft.amountYen?.toString() ?? "",
    categoryId: draft.categoryId ?? "",
  };
}

function isDraftWithItems(value: unknown): value is AiExpenseDraftWithItems {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    typeof (value as { draft?: unknown }).draft === "object"
  );
}

function getSectionKey(status: AiExpenseQueueStatus): QueueSectionKey {
  if (status === "ready") {
    return "ready";
  }
  if (status === "needs_review") {
    return "needs_review";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "registered") {
    return "registered";
  }
  return "processing";
}

function getStatusIcon(status: AiExpenseQueueStatus) {
  if (status === "ready" || status === "registered") {
    return <CheckCircleIcon fontSize="small" />;
  }
  if (status === "needs_review") {
    return <HelpIcon fontSize="small" />;
  }
  if (status === "failed") {
    return <ErrorOutlinedIcon fontSize="small" />;
  }
  return <HourglassEmptyIcon fontSize="small" />;
}

function getStatusColor(status: AiExpenseQueueStatus) {
  if (status === "ready" || status === "registered") {
    return "success" as const;
  }
  if (status === "needs_review") {
    return "warning" as const;
  }
  if (status === "failed") {
    return "error" as const;
  }
  return "default" as const;
}

function QueueItemCard({
  item,
  isSelected,
  onToggleReadySelection,
  onOpenReview,
  onRetry,
  onDelete,
  onReturnToManualInput,
  isDeleting,
}: {
  item: AiExpenseQueueItem;
  isSelected: boolean;
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
  onDelete?: (item: AiExpenseQueueItem) => void;
  onReturnToManualInput?: (item: AiExpenseQueueItem) => void;
  isDeleting: boolean;
}) {
  const secondaryLabel = item.fileName ?? "AI支出下書き";
  const canDelete = item.status !== "registered" && item.status !== "registering";

  return (
    <Box className={`ai-expense-queue-item ai-expense-queue-item-${getSectionKey(item.status)}`}>
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
            {item.status === "ready" && (
              <Checkbox
                checked={isSelected}
                onChange={(event) => onToggleReadySelection(item.id, event.target.checked)}
                size="small"
                slotProps={{
                  input: { "aria-label": `${item.title || secondaryLabel}を登録対象に含める` },
                }}
                sx={{ mt: -0.5 }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {item.title || secondaryLabel}
              </Typography>
              {item.title && (
                <Typography color="text.secondary" variant="body2" noWrap>
                  {secondaryLabel}
                </Typography>
              )}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip label={documentTypeLabels[item.documentType]} size="small" variant="outlined" />
            <Chip
              color={getStatusColor(item.status)}
              icon={getStatusIcon(item.status)}
              label={statusLabels[item.status]}
              size="small"
            />
          </Stack>
        </Stack>

        {item.amountYen !== undefined && (
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {item.amountYen.toLocaleString("ja-JP")}円
          </Typography>
        )}

        {(item.date || item.categoryName) && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {item.date && (
              <Typography color="text.secondary" variant="body2">
                {formatDateForDisplay(item.date)}
              </Typography>
            )}
            {item.categoryName && (
              <Chip label={item.categoryName} size="small" variant="outlined" />
            )}
          </Stack>
        )}

        {(item.status === "analyzing" || item.status === "registering") && (
          <LinearProgress
            aria-label={`${secondaryLabel}の${statusLabels[item.status]}`}
            sx={{ height: 4, borderRadius: 2 }}
          />
        )}

        {item.reviewReasons && item.reviewReasons.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
            {item.reviewReasons.map((reason) => (
              <Chip
                key={reason}
                label={getReviewReasonLabel(reason)}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}

        {item.status === "needs_review" && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              onClick={() => onOpenReview(item.id)}
              size="small"
              type="button"
              variant="outlined"
            >
              下書きを確認
            </Button>
            <Button
              color="error"
              disabled={isDeleting}
              onClick={() => onDelete?.(item)}
              size="small"
              startIcon={<DeleteIcon fontSize="small" />}
              type="button"
              variant="text"
            >
              キューから削除
            </Button>
          </Stack>
        )}

        {item.status === "failed" && (
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
            <Button
              color="error"
              disabled={isDeleting}
              onClick={() => onDelete?.(item)}
              size="small"
              startIcon={<DeleteIcon fontSize="small" />}
              type="button"
              variant="text"
            >
              キューから削除
            </Button>
          </Stack>
        )}

        {(item.status === "queued" || item.status === "analyzing" || item.status === "ready") &&
          canDelete && (
            <Button
              color="error"
              disabled={isDeleting}
              onClick={() => onDelete?.(item)}
              size="small"
              startIcon={<DeleteIcon fontSize="small" />}
              type="button"
              variant="text"
              sx={{ alignSelf: "flex-start" }}
            >
              キューから削除
            </Button>
          )}
      </Stack>
    </Box>
  );
}

function QueueSection({
  label,
  items,
  selectedReadyIds,
  onToggleReadySelection,
  onOpenReview,
  onRetry,
  onDelete,
  onReturnToManualInput,
  deletingIds,
}: {
  label: string;
  items: AiExpenseQueueItem[];
  selectedReadyIds: string[];
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
  onDelete?: (item: AiExpenseQueueItem) => void;
  onReturnToManualInput?: (item: AiExpenseQueueItem) => void;
  deletingIds: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box aria-label={label} role="region">
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {label}
          </Typography>
          <Chip label={`${items.length}件`} size="small" variant="outlined" />
        </Stack>
        <Stack spacing={1}>
          {items.map((item) => (
            <QueueItemCard
              isSelected={selectedReadyIds.includes(item.id)}
              item={item}
              isDeleting={deletingIds.includes(item.id)}
              key={item.id}
              onDelete={onDelete}
              onOpenReview={onOpenReview}
              onRetry={onRetry}
              onReturnToManualInput={onReturnToManualInput}
              onToggleReadySelection={onToggleReadySelection}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

export function AiExpenseQueuePanel({
  initialItems,
  categories = [],
  initialReviewDrafts = {},
  onReviewSubmit,
}: AiExpenseQueuePanelProps) {
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
  const localReviewDraft = selectedReviewDraftId
    ? initialReviewDrafts[selectedReviewDraftId]
    : undefined;
  const selectedReviewDraftDetails = useQuery(
    api.aiExpenseDrafts.getWithItems,
    selectedReviewDraftId && !localReviewDraft
      ? { draftId: selectedReviewDraftId as Id<"aiExpenseDrafts"> }
      : "skip",
  ) as AiExpenseDraftWithItems | null | undefined;
  const jobs = useQuery(api.receiptAnalysisJobs.listJobs) as
    | Doc<"receiptAnalysisImageJobs">[]
    | undefined;
  const createBatch = useMutation(api.receiptAnalysisJobs.createBatch);
  const analyzeImageJob = useAction(api.receiptAnalysisJobs.analyzeImageJob);
  const retryImageJob = useMutation(api.receiptAnalysisJobs.retryImageJob);
  const cancelImageJob = useMutation(api.receiptAnalysisJobs.cancelImageJob);
  const registerReadyDrafts = useMutation(api.aiExpenseDrafts.registerReadyDrafts);
  const updateForReview = useMutation(api.aiExpenseDrafts.updateForReview);
  const deleteDraft = useMutation(api.aiExpenseDrafts.deleteDraft);
  const selectedReviewDraft = localReviewDraft
    ? localReviewDraft
    : isDraftWithItems(selectedReviewDraftDetails)
      ? selectedReviewDraftDetails.draft
      : null;
  const isReviewDraftNotFound =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === null;
  const isReviewDraftLoading =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === undefined;

  const statusOverrides = useMemo<Partial<Record<string, AiExpenseQueueStatus>>>(
    () =>
      Object.fromEntries(
        registeringIds.map((draftId) => [draftId, "registering" as const]),
      ) as Partial<Record<string, AiExpenseQueueStatus>>,
    [registeringIds],
  );

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
      ...(readyDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(draft, statusOverrides, categories),
      ),
      ...(needsReviewDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(draft, statusOverrides, categories),
      ),
      ...(failedDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(draft, statusOverrides, categories),
      ),
      ...(registeredDrafts ?? []).map((draft) =>
        mapDraftToQueueItem(draft, statusOverrides, categories),
      ),
    ];
  }, [
    processingItems,
    failedDrafts,
    needsReviewDrafts,
    readyDrafts,
    registeredDrafts,
    statusOverrides,
    categories,
  ]);

  const items = useMemo(() => {
    // initialItems が渡されている場合は、元のテストデータやローカル状態を優先し、
    // draft 由来の liveItems は置き換える（dev DB のゴミデータによる重複を防ぐ）
    if (initialItems && initialItems.length > 0) {
      return [...initialItems, ...processingItems].filter(
        (item) => !hiddenItemIds.includes(item.id),
      );
    }
    // liveItems は既に processingItems を含むため、ここでは liveItems のみを使う
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

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleRetryFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <Box
      aria-labelledby="ai-expense-queue-heading"
      className="ai-expense-queue"
      component="section"
    >
      <Stack spacing={2}>
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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                startIcon={<AddPhotoAlternateIcon />}
                type="button"
                variant="contained"
              >
                撮影する
              </Button>
              <input
                accept="image/*"
                aria-label="AI処理キューへカメラで追加"
                capture="environment"
                className="visually-hidden-file-input"
                multiple
                onChange={handleFilesSelected}
                ref={cameraInputRef}
                tabIndex={-1}
                type="file"
              />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                onClick={() => inputRef.current?.click()}
                startIcon={<AddPhotoAlternateIcon />}
                type="button"
                variant="outlined"
              >
                画像を追加
              </Button>
              <input
                accept="image/*"
                aria-label="AI処理キューへ画像を追加"
                className="visually-hidden-file-input"
                multiple
                onChange={handleFilesSelected}
                ref={inputRef}
                tabIndex={-1}
                type="file"
              />
            </Box>
          </Stack>
          <input
            accept="image/*"
            aria-label="再試行する画像を選択"
            className="visually-hidden-file-input"
            onChange={handleRetryFileSelected}
            ref={retryInputRef}
            tabIndex={-1}
            type="file"
          />
        </Stack>

        {retryError && (
          <Alert severity="error" variant="outlined" onClose={() => setRetryError("")}>
            {retryError}
          </Alert>
        )}

        {queueDeleteError && (
          <Alert severity="error" variant="outlined" onClose={() => setQueueDeleteError("")}>
            {queueDeleteError}
          </Alert>
        )}

        {items.length === 0 ? (
          <Alert severity="info" variant="outlined">
            追加した画像はここに状態別で表示されます。
          </Alert>
        ) : (
          <Stack spacing={2}>
            {registrationError && (
              <Alert severity="error" variant="outlined">
                {registrationError}
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Chip label={`キュー ${items.length}件`} size="small" variant="outlined" />
              <Chip label={`登録準備OK ${readyItems.length}件`} size="small" color="success" />
              <Chip
                label={`確認が必要 ${groupedItems.needs_review.length}件`}
                size="small"
                color="warning"
              />
              <Chip label={`失敗 ${groupedItems.failed.length}件`} size="small" color="error" />
            </Stack>

            {clearableItems.length > 0 && (
              <Button
                color="error"
                disabled={deletingIds.length > 0}
                onClick={() => void handleClearOpenQueue()}
                startIcon={<DeleteIcon />}
                type="button"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              >
                未登録のキューをクリア（{clearableItems.length}件）
              </Button>
            )}

            {readyItems.length > 0 && (
              <Button
                color="primary"
                startIcon={<CheckCircleIcon />}
                disabled={selectedReadyIds.length === 0 || registeringIds.length > 0}
                onClick={handleRegisterReady}
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
              onOpenReview={handleOpenReview}
              onDelete={(item) => void deleteQueueItem(item)}
              onReturnToManualInput={(item) => void deleteQueueItem(item)}
              onToggleReadySelection={handleToggleReadySelection}
              deletingIds={deletingIds}
            />
            <QueueSection
              label="登録準備OK"
              items={groupedItems.ready}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onDelete={(item) => void deleteQueueItem(item)}
              onReturnToManualInput={(item) => void deleteQueueItem(item)}
              onToggleReadySelection={handleToggleReadySelection}
              deletingIds={deletingIds}
            />
            <QueueSection
              label="確認が必要"
              items={groupedItems.needs_review}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onDelete={(item) => void deleteQueueItem(item)}
              onReturnToManualInput={(item) => void deleteQueueItem(item)}
              onToggleReadySelection={handleToggleReadySelection}
              deletingIds={deletingIds}
            />
            <QueueSection
              label="失敗"
              items={groupedItems.failed}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onDelete={(item) => void deleteQueueItem(item)}
              onRetry={handleRetry}
              onReturnToManualInput={(item) => void deleteQueueItem(item)}
              onToggleReadySelection={handleToggleReadySelection}
              deletingIds={deletingIds}
            />
            <QueueSection
              label="登録済み"
              items={groupedItems.registered}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onToggleReadySelection={handleToggleReadySelection}
              deletingIds={deletingIds}
            />
          </Stack>
        )}
      </Stack>

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={handleCloseReview}
        open={selectedReviewDraftId !== null}
      >
        <DialogTitle>下書き確認</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {isReviewDraftLoading && (
              <Typography color="text.secondary">下書きを読み込んでいます。</Typography>
            )}

            {isReviewDraftNotFound && (
              <Alert severity="error" variant="outlined">
                下書きが見つかりません。キューを更新してもう一度確認してください。
              </Alert>
            )}

            {!isReviewDraftLoading && !isReviewDraftNotFound && (
              <>
                {selectedReviewDraft?.reviewReasons &&
                  selectedReviewDraft.reviewReasons.length > 0 && (
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                      {selectedReviewDraft.reviewReasons.map((reason) => (
                        <Chip
                          key={reason}
                          label={getReviewReasonLabel(reason)}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  )}

                {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
                  <Alert severity="warning" variant="outlined">
                    {selectedReviewDraft.warnings.join(" / ")}
                  </Alert>
                )}

                {reviewError && (
                  <Alert severity="error" variant="outlined">
                    {reviewError}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  label="書類種別"
                  onChange={(event) =>
                    handleReviewFieldChange(
                      "documentType",
                      event.target.value as AiExpenseQueueDocumentType,
                    )
                  }
                  select
                  slotProps={{
                    select: {
                      displayEmpty: true,
                      renderValue: (value) =>
                        value === ""
                          ? "書類種別を選択"
                          : documentTypeLabels[value as AiExpenseQueueDocumentType],
                    },
                  }}
                  value={reviewForm.documentType === "unknown" ? "" : reviewForm.documentType}
                >
                  <MenuItem disabled value="">
                    書類種別を選択
                  </MenuItem>
                  {reviewDocumentTypeOptions.map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  label="日付"
                  onChange={(event) => handleReviewFieldChange("date", event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  type="date"
                  value={reviewForm.date}
                />

                <TextField
                  fullWidth
                  label="合計金額"
                  onChange={(event) =>
                    handleReviewFieldChange("amountYen", event.target.value.replace(/[^\d]/g, ""))
                  }
                  slotProps={{
                    htmlInput: {
                      inputMode: "numeric",
                    },
                  }}
                  value={reviewForm.amountYen}
                />

                <TextField
                  fullWidth
                  label="店名"
                  onChange={(event) => handleReviewFieldChange("shopName", event.target.value)}
                  value={reviewForm.shopName}
                />

                <TextField
                  fullWidth
                  label="支払場所"
                  onChange={(event) => handleReviewFieldChange("paymentPlace", event.target.value)}
                  value={reviewForm.paymentPlace}
                />

                <TextField
                  fullWidth
                  label="支払先"
                  onChange={(event) => handleReviewFieldChange("payeeName", event.target.value)}
                  value={reviewForm.payeeName}
                />

                <TextField
                  fullWidth
                  label="支払内容"
                  onChange={(event) =>
                    handleReviewFieldChange("paymentPurpose", event.target.value)
                  }
                  value={reviewForm.paymentPurpose}
                />

                <TextField
                  fullWidth
                  label="カテゴリ"
                  onChange={(event) => handleReviewFieldChange("categoryId", event.target.value)}
                  select
                  value={reviewForm.categoryId}
                >
                  {categories.map((category) => (
                    <MenuItem key={category._id} value={category._id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button disabled={reviewSubmitting} onClick={handleCloseReview} type="button">
            キャンセル
          </Button>
          <Button
            disabled={
              reviewSubmitting ||
              isReviewDraftLoading ||
              isReviewDraftNotFound ||
              categories.length === 0
            }
            onClick={() => void handleSubmitReview(false)}
            type="button"
            variant="outlined"
          >
            登録準備OKに戻す
          </Button>
          <Button
            disabled={
              reviewSubmitting ||
              isReviewDraftLoading ||
              isReviewDraftNotFound ||
              categories.length === 0
            }
            onClick={() => void handleSubmitReview(true)}
            type="button"
            variant="contained"
          >
            修正して登録
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
