/** 文字列を trim し、空文字の場合は undefined を返す */
export function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
