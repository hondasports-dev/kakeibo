import type { AiExpenseDraftStatus } from "./constants";

/**
 * 画像読み取り失敗時にユーザーに表示するヒントメッセージを返す。
 * failed ステータス以外では undefined を返す。
 */
export function getImageCaptureFailureHint(status: AiExpenseDraftStatus): string | undefined {
  if (status === "failed") {
    return "明るい場所で、影や反射を避け、レシート全体を正面から撮影してください。";
  }
  return undefined;
}
