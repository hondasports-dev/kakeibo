const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTimeForDisplay(timestamp: number): string {
  return DATE_TIME_FORMATTER.format(new Date(timestamp));
}
