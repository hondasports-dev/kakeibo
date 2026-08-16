import { buildEmailUrl } from "../../email/url";

export const LINE_IMAGE_REVIEW_PATH = "/weeks/current/input";

export const LINE_IMAGE_FETCH_FAILED_MESSAGE =
  "画像を取得できませんでした。時間をおいて送り直してください。";

export const LINE_IMAGE_INVALID_MESSAGE =
  "対応していない画像形式です。JPEG / PNG / WebP / GIF を送るか、Webから登録してください。";

export const LINE_IMAGE_TOO_LARGE_MESSAGE =
  "画像サイズが大きすぎます。別の画像を送るか、Webから登録してください。";

export const LINE_IMAGE_CONSENT_REQUIRED_MESSAGE =
  "レシート画像の外部送信に同意が必要です。kakeiboのWeb設定で同意したあと、もう一度送ってください。";

export function buildLineImageReviewUrl(): string {
  return buildEmailUrl(LINE_IMAGE_REVIEW_PATH);
}

export function formatLineImageDraftCreatedReply(reviewUrl: string): string {
  return [
    "レシートの下書きを作成しました。内容の確認が必要なので、Webの入力画面で確認・登録してください。",
    reviewUrl,
  ].join("\n");
}

export function formatLineImageAnalysisFailedReply(reviewUrl: string): string {
  return [
    "画像の解析に失敗しました。Webの入力画面で下書きを確認するか、手入力してください。",
    reviewUrl,
  ].join("\n");
}
