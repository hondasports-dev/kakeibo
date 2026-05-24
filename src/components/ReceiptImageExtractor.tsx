import { useRef, useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type ExtractedReceiptFields = {
  shopName: string;
  date: string;
  amountYen: number;
};

interface ReceiptImageExtractorProps {
  /** 抽出成功時に呼ばれるコールバック */
  onExtracted: (fields: ExtractedReceiptFields) => void;
}

// ---------------------------------------------------------------------------
// 画像リサイズユーティリティ
// ---------------------------------------------------------------------------

const MAX_IMAGE_DATA_URL_LENGTH = 900_000;
const RESIZE_CANDIDATES = [
  { longSide: 1600, quality: 0.8 },
  { longSide: 1400, quality: 0.75 },
  { longSide: 1200, quality: 0.7 },
  { longSide: 1000, quality: 0.65 },
  { longSide: 800, quality: 0.6 },
];

/**
 * 画像ファイルをブラウザ Canvas でリサイズして JPEG Data URL を返す。
 * まず長辺1600px・JPEG quality 0.8を試し、Convexの引数制限に収まるまで段階的に縮小する。
 */
async function resizeImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  try {
    for (const candidate of RESIZE_CANDIDATES) {
      const dataUrl = renderBitmapToDataUrl(bitmap, width, height, candidate);
      if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error("画像サイズが大きすぎます。別の画像を選択するか、手入力してください。");
}

function renderBitmapToDataUrl(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  candidate: { longSide: number; quality: number },
): string {
  const longSide = Math.max(width, height);
  const scale = longSide > candidate.longSide ? candidate.longSide / longSide : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context を取得できませんでした");
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", candidate.quality);
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

  const extractReceiptFields = useAction(api.receiptImageExtraction.extractReceiptFields);

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

  const clearSelectedImage = () => {
    setSelectedFile(null);
    setParseStatus("idle");
    setErrorMessage("");
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
  };

  const handleExtract = async () => {
    if (!selectedFile || parseStatus === "parsing") {
      return;
    }
    setParseStatus("parsing");
    setErrorMessage("");

    try {
      const imageDataUrl = await resizeImageToDataUrl(selectedFile);
      const result = await extractReceiptFields({ imageDataUrl });
      onExtracted({
        shopName: result.shopName,
        date: result.date,
        amountYen: result.amountYen,
      });
      // 抽出成功後は選択状態をリセット
      clearSelectedImage();
    } catch (err) {
      setParseStatus("error");
      const message =
        err instanceof Error
          ? err.message
          : "画像の読み取りに失敗しました。手入力をお試しください。";
      setErrorMessage(message);
    }
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
          <Typography color="text.secondary" variant="body2">
            画像は保存されません。確認用の一時プレビューです。
          </Typography>
        </Box>

        {errorMessage && (
          <Alert
            severity="error"
            variant="outlined"
            action={
              <Button color="error" onClick={clearSelectedImage} size="small" type="button">
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
                onClick={clearSelectedImage}
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
            disabled={!selectedFile || parseStatus === "parsing"}
            onClick={() => void handleExtract()}
            startIcon={parseStatus === "parsing" ? <CircularProgress size={16} /> : undefined}
            type="button"
            variant="outlined"
          >
            {parseStatus === "parsing" ? "解析中..." : "読み取る"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
