import { currencyFormatter } from "../utils/currency";

export function calcPrevWeekDiff(
  currentTotalAmountYen: number,
  prevWeekTotalAmountYen: number | null,
): number | null {
  if (prevWeekTotalAmountYen === null) {
    return null;
  }
  return currentTotalAmountYen - prevWeekTotalAmountYen;
}

/** 前週比（指数）: 今週 ÷ 前週 × 100。100% = 前週と同額 */
export function calcPrevWeekRatio(
  currentTotalAmountYen: number,
  prevWeekTotalAmountYen: number | null,
): number | null {
  if (prevWeekTotalAmountYen === null || prevWeekTotalAmountYen === 0) {
    return null;
  }
  return Math.round((currentTotalAmountYen / prevWeekTotalAmountYen) * 100);
}

/** 差額サマリー用の増減率: (今週 − 前週) ÷ 前週 × 100 */
export function calcPrevWeekRate(
  currentTotalAmountYen: number,
  prevWeekTotalAmountYen: number | null,
): number | null {
  if (prevWeekTotalAmountYen === null || prevWeekTotalAmountYen === 0) {
    return null;
  }
  return Math.round(
    ((currentTotalAmountYen - prevWeekTotalAmountYen) / prevWeekTotalAmountYen) * 100,
  );
}

export function formatPrevWeekDiff(diff: number | null): string {
  if (diff === null) {
    return "比較データなし";
  }
  if (diff === 0) {
    return "±0円";
  }
  const sign = diff > 0 ? "+" : "";
  return `${sign}${currencyFormatter.format(diff)}円`;
}

export function formatPrevWeekRate(rate: number | null): string {
  if (rate === null) {
    return "前週データなし";
  }
  if (rate === 0) {
    return "±0%";
  }
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate}%`;
}

export function formatPrevWeekRatioWithArrow(ratio: number | null): string {
  if (ratio === null) {
    return "前週データなし";
  }
  if (ratio === 100) {
    return "100%";
  }
  const arrow = ratio > 100 ? " ↑" : " ↓";
  return `${ratio}%${arrow}`;
}
