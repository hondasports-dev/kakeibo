/**
 * 週次支出の前週比較に関する純粋ドメインルール。
 */

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
