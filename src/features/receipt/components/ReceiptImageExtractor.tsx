import { useRef, useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import {
  normalizeReceiptExtraction,
  type NormalizedReceiptExtraction,
  type NormalizedReceiptFields,
} from "../validation/receiptExtraction";
import { resizeImageFileToDataUrl } from "../../../utils/imageDataUrl";
import { CollapsibleHelp } from "../../ui";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type ExtractedReceiptFields = NormalizedReceiptFields;
export type ExtractedReceiptResult = Pick<NormalizedReceiptExtraction, "fields" | "fieldStatuses">;

interface ReceiptImageExtractorProps {
  /** 抽出成功時に呼ばれるコールバック */
  onExtracted: (result: ExtractedReceiptResult) => void;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function ReceiptImageExtractor({ onExtracted }: ReceiptImageExtractorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState<"idle" | "ready" | "parsing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessages, setNoticeMessages] = useState<string[]>([]);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentStatus, setConsentStatus] = useState<"idle" | "saving">("idle");

  const extractReceiptFields = useAction(
    api.receiptImageExtraction.extraction.extractReceiptFields,
  );
  const acceptReceiptImageExternalApiConsent = useMutation(
    api.users.mutations.acceptReceiptImageExternalApiConsent,
  );
  const receiptImageConsent = useQuery(api.users.queries.getReceiptImageConsent);

  const consentIsLoading = receiptImageConsent === undefined;
  const hasAcceptedExternalApiConsent = receiptImageConsent?.hasAcceptedExternalApiConsent === true;

  // 画像プレビュー描画
  useEffect(() => {
    if (!selectedFile || !previewCanvasRef.current) {
      return;
    }

    let isCancelled = false;
    const canvas = previewCanvasRef.current;
    if (typeof createImageBitmap !== "function") {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const drawPreview = async () => {
      try {
        const bitmap = await createImageBitmap(selectedFile);
        if (isCancelled) {
          bitmap.close();
          return;
        }
        const maxWidth = 640;
        const maxHeight = 360;
        const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        canvas.width = w;
        canvas.height = h;
        context.clearRect(0, 0, w, h);
        context.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
      } catch {
        if (!isCancelled) {
          setParseStatus("error");
          setErrorMessage("画像プレビューを表示できませんでした。別の画像を選択してください。");
        }
      }
    };

    void drawPreview();

    return () => {
      isCancelled = true;
    };
  }, [selectedFile]);

  const clearSelectedImage = (options: { keepNotice?: boolean } = {}) => {
    setSelectedFile(null);
    setParseStatus("idle");
    setErrorMessage("");
    if (!options.keepNotice) {
      setNoticeMessages([]);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setParseStatus("error");
      setErrorMessage("画像ファイルを選択してください。");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setParseStatus("ready");
    setErrorMessage("");
    setNoticeMessages([]);
  };

  const runExtraction = async () => {
    if (!selectedFile || parseStatus === "parsing") {
      return;
    }
    setParseStatus("parsing");
    setErrorMessage("");

    try {
      const imageDataUrl = await resizeImageFileToDataUrl(selectedFile);
      const result = normalizeReceiptExtraction(await extractReceiptFields({ imageDataUrl }));
      onExtracted({ fields: result.fields, fieldStatuses: result.fieldStatuses });
      setNoticeMessages([...new Set(result.issueMessages)]);
      // 抽出成功後は選択状態をリセット
      clearSelectedImage({ keepNotice: result.issueMessages.length > 0 });
    } catch (err) {
      setParseStatus("error");
      const message =
        err instanceof Error
          ? err.message
          : "画像の読み取りに失敗しました。手入力をお試しください。";
      setErrorMessage(message);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile || parseStatus === "parsing" || consentIsLoading) {
      return;
    }

    if (!hasAcceptedExternalApiConsent) {
      setConsentDialogOpen(true);
      return;
    }

    await runExtraction();
  };

  const handleAcceptAndExtract = async () => {
    if (!selectedFile || consentStatus === "saving") {
      return;
    }

    setConsentStatus("saving");
    setErrorMessage("");
    try {
      await acceptReceiptImageExternalApiConsent();
      setConsentDialogOpen(false);
      await runExtraction();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "同意状態を保存できませんでした。手入力をお試しください。";
      setErrorMessage(message);
    } finally {
      setConsentStatus("idle");
    }
  };

  const handleDeclineConsent = () => {
    setConsentDialogOpen(false);
    clearSelectedImage();
  };

  return (
    <Box
      aria-labelledby="receipt-image-upload-heading"
      className="receipt-image-upload"
      component="section"
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography
            component="h3"
            id="receipt-image-upload-heading"
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            画像から入力
          </Typography>
          <CollapsibleHelp summary="画像読み取りについて">
            <Typography color="text.secondary" variant="body2">
              画像は保存されません。確認用の一時プレビューです。
            </Typography>
            <Typography color="text.secondary" variant="body2">
              読み取り時はレシート画像を外部APIへ送信します。抽出結果は自動保存されません。
            </Typography>
          </CollapsibleHelp>
        </Box>

        {errorMessage && (
          <Alert
            severity="error"
            variant="outlined"
            action={
              <Button color="error" onClick={() => clearSelectedImage()} size="small" type="button">
                クリア
              </Button>
            }
          >
            {errorMessage}
            {parseStatus === "error" && (
              <Typography component="span" variant="body2" sx={{ display: "block", mt: 0.5 }}>
                手入力でも保存できます。
              </Typography>
            )}
          </Alert>
        )}

        {noticeMessages.length > 0 && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button
                color="warning"
                onClick={() => setNoticeMessages([])}
                size="small"
                type="button"
              >
                閉じる
              </Button>
            }
          >
            <Stack spacing={0.5}>
              {noticeMessages.map((message) => (
                <Typography component="span" key={message} variant="body2">
                  {message}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}

        {selectedFile ? (
          <Stack spacing={1.5}>
            <Box className="receipt-image-preview">
              <canvas
                aria-label="選択したレシート画像のプレビュー"
                height={360}
                ref={previewCanvasRef}
                role="img"
                width={640}
              />
            </Box>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography className="receipt-image-file-name" variant="body2">
                {selectedFile.name}
              </Typography>
              <Button
                color="error"
                disabled={parseStatus === "parsing"}
                onClick={() => clearSelectedImage()}
                type="button"
                variant="text"
                sx={{ alignSelf: "flex-start" }}
              >
                選択画像を削除
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography color="text.secondary" variant="body2">
            レシート画像を選ぶと、ここにプレビューを表示します。
          </Typography>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button onClick={() => imageInputRef.current?.click()} type="button" variant="outlined">
            画像を選択
            <input
              accept="image/*"
              aria-label="レシート画像を選択"
              className="visually-hidden-file-input"
              onChange={handleImageChange}
              ref={imageInputRef}
              tabIndex={-1}
              type="file"
            />
          </Button>
          <Button
            disabled={!selectedFile || parseStatus === "parsing" || consentIsLoading}
            onClick={() => void handleExtract()}
            startIcon={parseStatus === "parsing" ? <CircularProgress size={16} /> : undefined}
            type="button"
            variant="outlined"
          >
            {parseStatus === "parsing" ? "解析中..." : "読み取る"}
          </Button>
        </Stack>
      </Stack>

      <Dialog
        aria-labelledby="receipt-image-consent-dialog-title"
        onClose={() => setConsentDialogOpen(false)}
        open={consentDialogOpen}
      >
        <DialogTitle id="receipt-image-consent-dialog-title">
          画像の外部API送信に同意しますか
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              レシート画像を解析するため、外部APIへ送信します。画像は長期保存しません。
            </Typography>
            <Typography variant="body2">
              読み取った店名・日付・金額はフォーム候補として反映されますが、自動保存はされません。不同意の場合は手入力できます。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeclineConsent} type="button">
            手入力する
          </Button>
          <Button
            disabled={consentStatus === "saving"}
            onClick={() => void handleAcceptAndExtract()}
            startIcon={consentStatus === "saving" ? <CircularProgress size={16} /> : undefined}
            type="button"
            variant="contained"
          >
            {consentStatus === "saving" ? "保存中..." : "同意して読み取る"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
