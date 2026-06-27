export function calcPrevWeekDiff(
  currentTotalAmountYen: number,
  prevWeekTotalAmountYen: number | null,
): number | null {
  if (prevWeekTotalAmountYen === null) {
    return null;
  }
  return currentTotalAmountYen - prevWeekTotalAmountYen;
}

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
  return `${sign}${diff.toLocaleString()}円`;
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
