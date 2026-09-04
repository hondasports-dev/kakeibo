import { MAX_IMAGE_DATA_URL_LENGTH } from "../../lib/domain/common/imageDataUrl";

const RESIZE_CANDIDATES = [
  { longSide: 1600, minShortSide: 1000, quality: 0.8 },
  { longSide: 1600, minShortSide: 900, quality: 0.75 },
  { longSide: 1400, minShortSide: 800, quality: 0.7 },
  { longSide: 1200, minShortSide: 700, quality: 0.65 },
  { longSide: 1000, minShortSide: 600, quality: 0.6 },
];

export function calculateResizeDimensions(
  width: number,
  height: number,
  candidate: { longSide: number; minShortSide?: number },
) {
  const originalLongSide = Math.max(width, height);
  const originalShortSide = Math.min(width, height);
  const longSideScale = Math.min(1, candidate.longSide / originalLongSide);
  const readableScale = candidate.minShortSide
    ? Math.min(1, candidate.minShortSide / originalShortSide)
    : 0;
  const scale = Math.max(longSideScale, readableScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getImageFileErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `画像の読み込みに失敗しました: ${error.message}`;
  }
  return "画像の読み込みに失敗しました";
}

export async function resizeImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください");
  }

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
  candidate: { longSide: number; minShortSide?: number; quality: number },
): string {
  const target = calculateResizeDimensions(width, height, candidate);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context を取得できませんでした");
  }
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  return canvas.toDataURL("image/jpeg", candidate.quality);
}
