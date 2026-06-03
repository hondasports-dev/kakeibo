import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
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
  fileName: string;
  status: AiExpenseQueueStatus;
  documentType: AiExpenseQueueDocumentType;
  title?: string;
  amountYen?: number;
  reviewReasons?: string[];
};

type QueueSectionKey = "processing" | "ready" | "needs_review" | "failed" | "registered";

type AiExpenseQueuePanelProps = {
  initialItems?: AiExpenseQueueItem[];
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

function QueueItemCard({ item }: { item: AiExpenseQueueItem }) {
  return (
    <Box className={`ai-expense-queue-item ai-expense-queue-item-${getSectionKey(item.status)}`}>
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {item.title || item.fileName}
            </Typography>
            {item.title && (
              <Typography color="text.secondary" variant="body2" noWrap>
                {item.fileName}
              </Typography>
            )}
          </Box>
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
            aria-label={`${item.fileName}の${statusLabels[item.status]}`}
            sx={{ height: 4, borderRadius: 2 }}
          />
        )}

        {item.reviewReasons && item.reviewReasons.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
            {item.reviewReasons.map((reason) => (
              <Chip key={reason} label={reason} size="small" variant="outlined" />
            ))}
          </Stack>
        )}

        {item.status === "needs_review" && (
          <Button size="small" type="button" variant="outlined" sx={{ alignSelf: "flex-start" }}>
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

function QueueSection({ label, items }: { label: string; items: AiExpenseQueueItem[] }) {
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
            <QueueItemCard item={item} key={item.id} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

export function AiExpenseQueuePanel({ initialItems = [] }: AiExpenseQueuePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AiExpenseQueueItem[]>(initialItems);
  const readyItems = items.filter((item) => getSectionKey(item.status) === "ready");
  const groupedItems = {
    processing: items.filter((item) => getSectionKey(item.status) === "processing"),
    ready: readyItems,
    needs_review: items.filter((item) => getSectionKey(item.status) === "needs_review"),
    failed: items.filter((item) => getSectionKey(item.status) === "failed"),
    registered: items.filter((item) => getSectionKey(item.status) === "registered"),
  };

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
    setItems((current) => [...nextItems, ...current]);
    event.target.value = "";
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
                type="button"
                variant="contained"
                sx={{ alignSelf: "flex-start" }}
              >
                登録準備OKをまとめて登録
              </Button>
            )}

            <Divider />

            <QueueSection label="AI処理中" items={groupedItems.processing} />
            <QueueSection label="登録準備OK" items={groupedItems.ready} />
            <QueueSection label="確認が必要" items={groupedItems.needs_review} />
            <QueueSection label="失敗" items={groupedItems.failed} />
            <QueueSection label="登録済み" items={groupedItems.registered} />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
