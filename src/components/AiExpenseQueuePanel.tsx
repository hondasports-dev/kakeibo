import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
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
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HelpIcon from "@mui/icons-material/Help";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ReplayIcon from "@mui/icons-material/Replay";

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
): AiExpenseQueueItem {
  return {
    id: draft._id,
    fileName: "AI支出下書き",
    status: statusOverrides[draft._id] ?? draft.status,
    documentType: draft.documentType,
    title: resolveDraftTitle(draft),
    amountYen: draft.amountYen,
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
}: {
  item: AiExpenseQueueItem;
  isSelected: boolean;
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
}) {
  const secondaryLabel = item.fileName ?? "AI支出下書き";

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
          <Button
            onClick={() => onOpenReview(item.id)}
            size="small"
            type="button"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          >
            下書きを確認
          </Button>
        )}

        {item.status === "failed" && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<ReplayIcon fontSize="small" />}
              type="button"
              variant="outlined"
            >
              再試行
            </Button>
            <Button size="small" type="button" variant="text">
              手入力へ戻る
            </Button>
          </Stack>
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
}: {
  label: string;
  items: AiExpenseQueueItem[];
  selectedReadyIds: string[];
  onToggleReadySelection: (itemId: string, checked: boolean) => void;
  onOpenReview: (itemId: string) => void;
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
              key={item.id}
              onOpenReview={onOpenReview}
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
  const previousReadyItemIdsRef = useRef<string[]>([]);
  const [localItems, setLocalItems] = useState<AiExpenseQueueItem[]>([]);
  const [selectedReadyIds, setSelectedReadyIds] = useState<string[]>([]);
  const [registeringIds, setRegisteringIds] = useState<string[]>([]);
  const [registrationError, setRegistrationError] = useState("");
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);
  const [initializedReviewDraftId, setInitializedReviewDraftId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormValues>(emptyReviewForm);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
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
  const registerReadyDrafts = useMutation(api.aiExpenseDrafts.registerReadyDrafts);
  const updateForReview = useMutation(api.aiExpenseDrafts.updateForReview);
  const selectedReviewDraft = localReviewDraft
    ? localReviewDraft
    : isDraftWithItems(selectedReviewDraftDetails)
      ? selectedReviewDraftDetails.draft
      : null;
  const isReviewDraftLoading = selectedReviewDraftId !== null && selectedReviewDraft === null;

  const statusOverrides = useMemo<Partial<Record<string, AiExpenseQueueStatus>>>(
    () =>
      Object.fromEntries(
        registeringIds.map((draftId) => [draftId, "registering" as const]),
      ) as Partial<Record<string, AiExpenseQueueStatus>>,
    [registeringIds],
  );

  const liveItems = useMemo(() => {
    return [
      ...(readyDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, statusOverrides)),
      ...(needsReviewDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, statusOverrides)),
      ...(failedDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, statusOverrides)),
      ...(registeredDrafts ?? []).map((draft) => mapDraftToQueueItem(draft, statusOverrides)),
    ];
  }, [failedDrafts, needsReviewDrafts, readyDrafts, registeredDrafts, statusOverrides]);

  const items = useMemo(
    () => [...localItems, ...(initialItems ?? liveItems)],
    [initialItems, liveItems, localItems],
  );
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

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const nextItems = files.map((file, index): AiExpenseQueueItem => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${index}-${file.name}`;
      return {
        id,
        fileName: file.name,
        status: "queued",
        documentType: "unknown",
      };
    });
    setLocalItems((current) => [...nextItems, ...current]);
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

  const handleReviewFieldChange = (field: keyof ReviewFormValues, value: string) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitReview = async (registerAfterUpdate: boolean) => {
    if (!selectedReviewDraftId) {
      return;
    }
    const amountYen = Number(reviewForm.amountYen);
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
          </Box>
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
        </Stack>

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
              onToggleReadySelection={handleToggleReadySelection}
            />
            <QueueSection
              label="登録準備OK"
              items={groupedItems.ready}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onToggleReadySelection={handleToggleReadySelection}
            />
            <QueueSection
              label="確認が必要"
              items={groupedItems.needs_review}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onToggleReadySelection={handleToggleReadySelection}
            />
            <QueueSection
              label="失敗"
              items={groupedItems.failed}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onToggleReadySelection={handleToggleReadySelection}
            />
            <QueueSection
              label="登録済み"
              items={groupedItems.registered}
              selectedReadyIds={selectedReadyIds}
              onOpenReview={handleOpenReview}
              onToggleReadySelection={handleToggleReadySelection}
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

            {!isReviewDraftLoading && (
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
                  value={reviewForm.documentType}
                >
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
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
            disabled={reviewSubmitting || isReviewDraftLoading || categories.length === 0}
            onClick={() => void handleSubmitReview(false)}
            type="button"
            variant="outlined"
          >
            登録準備OKに戻す
          </Button>
          <Button
            disabled={reviewSubmitting || isReviewDraftLoading || categories.length === 0}
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
