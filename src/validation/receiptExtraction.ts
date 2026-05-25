export type ReceiptExtractionField = "shopName" | "date" | "amountYen";
export type ReceiptExtractionStatus = "applied" | "needs_confirmation" | "rejected";

export type RawReceiptExtraction = {
  shopName?: unknown;
  date?: unknown;
  amountYen?: unknown;
  confidence?: unknown;
  warnings?: unknown;
};

export type NormalizedReceiptFields = Partial<{
  shopName: string;
  date: string;
  amountYen: number;
}>;

export type FieldStatus<T> = {
  status: ReceiptExtractionStatus;
  value?: T;
  reason?: string;
};

export type NormalizedReceiptExtraction = {
  fields: NormalizedReceiptFields;
  fieldStatuses: {
    shopName: FieldStatus<string>;
    date: FieldStatus<string>;
    amountYen: FieldStatus<number>;
  };
  warnings: string[];
  issueMessages: string[];
};

const CONFIDENCE_THRESHOLD = 0.8;
const MAX_RECEIPT_AMOUNT_YEN = 9_999_999;

const fieldLabels: Record<ReceiptExtractionField, string> = {
  shopName: "店舗名",
  date: "日付",
  amountYen: "金額",
};

export function normalizeReceiptExtraction(
  extraction: RawReceiptExtraction,
): NormalizedReceiptExtraction {
  const warnings = parseWarnings(extraction.warnings);
  const hasGlobalWarning = warnings.length > 0;

  const shopName = normalizeShopName(extraction.shopName);
  const date = normalizeExtractedDate(extraction.date);
  const amountYen = normalizeExtractedAmount(extraction.amountYen);

  const fieldStatuses = {
    shopName: decideFieldStatus("shopName", shopName, extraction.confidence, hasGlobalWarning),
    date: decideFieldStatus("date", date, extraction.confidence, hasGlobalWarning),
    amountYen: decideFieldStatus("amountYen", amountYen, extraction.confidence, hasGlobalWarning),
  };

  const fields: NormalizedReceiptFields = {};
  if (fieldStatuses.shopName.status === "applied") {
    fields.shopName = fieldStatuses.shopName.value;
  }
  if (fieldStatuses.date.status === "applied") {
    fields.date = fieldStatuses.date.value;
  }
  if (fieldStatuses.amountYen.status === "applied") {
    fields.amountYen = fieldStatuses.amountYen.value;
  }

  return {
    fields,
    fieldStatuses,
    warnings,
    issueMessages: buildIssueMessages(fieldStatuses, warnings),
  };
}

function decideFieldStatus<T>(
  field: ReceiptExtractionField,
  normalized: { success: true; value: T } | { success: false; reason: string },
  confidence: unknown,
  hasGlobalWarning: boolean,
): FieldStatus<T> {
  if (!normalized.success) {
    return { status: "rejected", reason: normalized.reason };
  }

  const score = parseConfidenceScore(confidence, field);
  if (hasGlobalWarning || score === null || score < CONFIDENCE_THRESHOLD) {
    return {
      status: "needs_confirmation",
      value: normalized.value,
      reason: `${fieldLabels[field]}は要確認です`,
    };
  }

  return { status: "applied", value: normalized.value };
}

function parseConfidenceScore(confidence: unknown, field: ReceiptExtractionField): number | null {
  if (typeof confidence !== "object" || confidence === null) {
    return null;
  }
  const value = (confidence as Partial<Record<ReceiptExtractionField, unknown>>)[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return null;
  }
  return value;
}

function normalizeShopName(
  value: unknown,
): { success: true; value: string } | { success: false; reason: string } {
  if (typeof value !== "string") {
    return { success: false, reason: "店舗名を読み取れませんでした" };
  }
  const trimmed = value.normalize("NFKC").trim();
  if (trimmed === "") {
    return { success: false, reason: "店舗名を読み取れませんでした" };
  }
  if (trimmed.length > 100) {
    return { success: false, reason: "店舗名が長すぎます" };
  }
  return { success: true, value: trimmed };
}

function normalizeExtractedAmount(
  value: unknown,
): { success: true; value: number } | { success: false; reason: string } {
  if (typeof value === "number") {
    return validateAmount(value);
  }
  if (typeof value !== "string") {
    return { success: false, reason: "金額を読み取れませんでした" };
  }

  const normalized = value.normalize("NFKC").trim();
  if (normalized === "") {
    return { success: false, reason: "金額を読み取れませんでした" };
  }
  if (/[-−ー]|[.．]/.test(normalized)) {
    return { success: false, reason: "金額が正の整数ではありません" };
  }

  const amountMatches = normalized.match(/(?:[¥￥]\s*)?\d{1,3}(?:,\d{3})+|(?:[¥￥]\s*)?\d+/g) ?? [];
  if (amountMatches.length !== 1) {
    return { success: false, reason: "金額候補が曖昧です" };
  }

  const digits = amountMatches[0].replace(/[^\d]/g, "");
  if (digits === "") {
    return { success: false, reason: "金額を読み取れませんでした" };
  }

  return validateAmount(Number(digits));
}

function validateAmount(
  value: number,
): { success: true; value: number } | { success: false; reason: string } {
  if (!Number.isInteger(value)) {
    return { success: false, reason: "金額が整数ではありません" };
  }
  if (value < 1) {
    return { success: false, reason: "金額は 1 円以上である必要があります" };
  }
  if (value > MAX_RECEIPT_AMOUNT_YEN) {
    return { success: false, reason: "金額が上限を超えています" };
  }
  return { success: true, value };
}

function normalizeExtractedDate(
  value: unknown,
): { success: true; value: string } | { success: false; reason: string } {
  if (typeof value !== "string") {
    return { success: false, reason: "日付を読み取れませんでした" };
  }

  const normalized = value.normalize("NFKC").trim();
  if (normalized === "") {
    return { success: false, reason: "日付を読み取れませんでした" };
  }
  if (/[~〜～]|から|まで/.test(normalized)) {
    return { success: false, reason: "日付候補が範囲表現です" };
  }

  const candidates = findDateCandidates(normalized);
  if (candidates.length !== 1) {
    return { success: false, reason: "日付候補が曖昧です" };
  }

  const { year, month, day } = candidates[0];
  if (!isValidCalendarDate(year, month, day)) {
    return { success: false, reason: "存在しない日付です" };
  }

  return {
    success: true,
    value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function findDateCandidates(value: string): Array<{ year: number; month: number; day: number }> {
  const candidates: Array<{ year: number; month: number; day: number }> = [];
  const patterns = [
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/g,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/g,
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      candidates.push({
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      });
    }
  }

  return candidates;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (warning): warning is string => typeof warning === "string" && warning.trim() !== "",
  );
}

function buildIssueMessages(
  fieldStatuses: NormalizedReceiptExtraction["fieldStatuses"],
  warnings: string[],
): string[] {
  const messages: string[] = [];
  const statuses = Object.values(fieldStatuses);
  if (statuses.some((status) => status.status === "needs_confirmation")) {
    messages.push("要確認の項目があります");
  }
  for (const [field, status] of Object.entries(fieldStatuses) as Array<
    [ReceiptExtractionField, FieldStatus<unknown>]
  >) {
    if (status.status === "needs_confirmation") {
      messages.push(`${fieldLabels[field]}は要確認です`);
    }
    if (status.status === "rejected" && status.reason) {
      messages.push(`${fieldLabels[field]}は自動反映できません: ${status.reason}`);
    }
  }
  if (statuses.some((status) => status.status === "rejected")) {
    messages.push("読み取れない項目は手入力してください");
  }
  return [...messages, ...warnings];
}
