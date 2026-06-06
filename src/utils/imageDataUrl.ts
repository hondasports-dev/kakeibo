const MAX_IMAGE_DATA_URL_LENGTH = 900_000;

const RESIZE_CANDIDATES = [
  { longSide: 1600, quality: 0.8 },
  { longSide: 1400, quality: 0.75 },
  { longSide: 1200, quality: 0.7 },
  { longSide: 1000, quality: 0.65 },
  { longSide: 800, quality: 0.6 },
];

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
