import { validateExpenseAmount, type ExpenseAmountError } from "../expenseEntries/expenseEntryItem";
import { isValidIsoDateString } from "../week/weekDates";
import { isPlausibleReceiptYear, normalizeReceiptDate, type ReceiptDateError } from "./receiptDate";

export { normalizeReceiptDate } from "./receiptDate";
export type { ReceiptDateError } from "./receiptDate";

export type ReceiptShopNameError = "empty" | "too_long";

export const RECEIPT_SHOP_NAME_MAX_LENGTH = 100;

/** レシートの店舗名・支払先を検証・正規化する。空文字 / 超過を拒否し、trim して返す。 */
export function validateReceiptShopName(
  shopName: string,
): { success: true; shopName: string } | { success: false; error: ReceiptShopNameError } {
  const trimmed = shopName.trim();
  if (trimmed === "") {
    return { success: false, error: "empty" };
  }
  if (trimmed.length > RECEIPT_SHOP_NAME_MAX_LENGTH) {
    return { success: false, error: "too_long" };
  }
  return { success: true, shopName: trimmed };
}

export type ExtractedIsoDateError = "invalid";

/** OCR 抽出された ISO 日付を検証する。空文字を許容する。 */
export function validateExtractedIsoDate(
  date: string,
): { success: true; date: string } | { success: false; error: ExtractedIsoDateError } {
  if (date === "") {
    return { success: true, date };
  }
  if (!isValidIsoDateString(date)) {
    return { success: false, error: "invalid" };
  }
  if (!isPlausibleReceiptYear(Number(date.slice(0, 4)))) {
    return { success: false, error: "invalid" };
  }
  return { success: true, date };
}

/** レシートの合計金額を検証する。 */
export function validateReceiptTotalAmount(
  amount: number,
): { success: true; amount: number } | { success: false; error: ExpenseAmountError } {
  const result = validateExpenseAmount(amount);
  if (!result.success) {
    return result;
  }
  return { success: true, amount };
}

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

export const RECEIPT_EXTRACTION_CONFIDENCE_THRESHOLD = 0.8;

const receiptExtractionFieldLabels: Record<ReceiptExtractionField, string> = {
  shopName: "店舗名",
  date: "日付",
  amountYen: "金額",
};

/** レシート抽出フィールドの表示ラベルを返す。 */
export function getReceiptExtractionFieldLabel(field: ReceiptExtractionField): string {
  return receiptExtractionFieldLabels[field];
}

/** 要確認フィールドの理由メッセージを返す。 */
export function getReceiptExtractionFieldConfirmationMessage(
  field: ReceiptExtractionField,
): string {
  return `${getReceiptExtractionFieldLabel(field)}は要確認です`;
}

/** 自動反映できなかったフィールドの理由メッセージを返す。 */
export function getReceiptExtractionFieldIssueMessage(
  field: ReceiptExtractionField,
  reason: string,
): string {
  return `${getReceiptExtractionFieldLabel(field)}は自動反映できません: ${reason}`;
}

/** 全体向け issue メッセージを返す。 */
export function getReceiptExtractionGlobalIssueMessage(
  status: "needs_confirmation" | "rejected",
): string {
  return status === "needs_confirmation"
    ? "要確認の項目があります"
    : "読み取れない項目は手入力してください";
}

/** 店舗名の前処理・検証エラーをユーザー向けメッセージに変換する。 */
export function getReceiptShopNameParseErrorMessage(
  error: ReceiptShopNameError | "not_string",
): string {
  if (error === "too_long") {
    return "店舗名が長すぎます";
  }
  return "店舗名を読み取れませんでした";
}

/** OCR 抽出日付のエラーをユーザー向けメッセージに変換する。 */
export function getReceiptDateParseErrorMessage(error: ReceiptDateError): string {
  const reasons: Record<ReceiptDateError, string> = {
    no_candidate: "日付を読み取れませんでした",
    ambiguous: "日付候補が曖昧です",
    range_expression: "日付候補が範囲表現です",
    invalid: "存在しない日付です",
  };
  return reasons[error];
}

type ExtractedAmountParseError =
  | "not_string_or_number"
  | "empty"
  | "not_positive_integer"
  | "ambiguous"
  | ExpenseAmountError;

/** OCR 抽出金額の前処理・検証エラーをユーザー向けメッセージに変換する。 */
export function getExtractedAmountParseErrorMessage(error: ExtractedAmountParseError): string {
  switch (error) {
    case "not_string_or_number":
    case "empty":
      return "金額を読み取れませんでした";
    case "not_positive_integer":
      return "金額が正の整数ではありません";
    case "ambiguous":
      return "金額候補が曖昧です";
    case "too_large":
      return "金額が上限を超えています";
    default:
      return "金額は 1 円以上の整数である必要があります";
  }
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

function parseWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (warning): warning is string => typeof warning === "string" && warning.trim() !== "",
  );
}

function normalizeRawShopName(
  value: unknown,
): { success: true; value: string } | { success: false; reason: string } {
  if (typeof value !== "string") {
    return { success: false, reason: getReceiptShopNameParseErrorMessage("not_string") };
  }
  const normalized = value.normalize("NFKC").trim();
  const result = validateReceiptShopName(normalized);
  if (!result.success) {
    return { success: false, reason: getReceiptShopNameParseErrorMessage(result.error) };
  }
  return { success: true, value: result.shopName };
}

function validateExtractedAmountValue(
  value: number,
): { success: true; value: number } | { success: false; reason: string } {
  const result = validateReceiptTotalAmount(value);
  if (!result.success) {
    return { success: false, reason: getExtractedAmountParseErrorMessage(result.error) };
  }
  return { success: true, value: result.amount };
}

function normalizeRawExtractedAmount(
  value: unknown,
): { success: true; value: number } | { success: false; reason: string } {
  if (typeof value === "number") {
    return validateExtractedAmountValue(value);
  }
  if (typeof value !== "string") {
    return { success: false, reason: getExtractedAmountParseErrorMessage("not_string_or_number") };
  }

  const normalized = value.normalize("NFKC").trim();
  if (normalized === "") {
    return { success: false, reason: getExtractedAmountParseErrorMessage("empty") };
  }
  if (/[-−ー]|[.．]/.test(normalized)) {
    return { success: false, reason: getExtractedAmountParseErrorMessage("not_positive_integer") };
  }

  const amountMatches = normalized.match(/(?:[¥￥]\s*)?\d{1,3}(?:,\d{3})+|(?:[¥￥]\s*)?\d+/g) ?? [];
  if (amountMatches.length !== 1) {
    return { success: false, reason: getExtractedAmountParseErrorMessage("ambiguous") };
  }

  const digits = amountMatches[0].replace(/[^\d]/g, "");
  if (digits === "") {
    return { success: false, reason: getExtractedAmountParseErrorMessage("empty") };
  }

  return validateExtractedAmountValue(Number(digits));
}

function normalizeRawExtractedDate(
  value: unknown,
): { success: true; value: string } | { success: false; reason: string } {
  if (typeof value !== "string") {
    return { success: false, reason: getReceiptDateParseErrorMessage("no_candidate") };
  }

  const result = normalizeReceiptDate(value);
  if (!result.success) {
    return { success: false, reason: getReceiptDateParseErrorMessage(result.error) };
  }

  return { success: true, value: result.date };
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
  if (hasGlobalWarning || score === null || score < RECEIPT_EXTRACTION_CONFIDENCE_THRESHOLD) {
    return {
      status: "needs_confirmation",
      value: normalized.value,
      reason: getReceiptExtractionFieldConfirmationMessage(field),
    };
  }

  return { status: "applied", value: normalized.value };
}

function buildIssueMessages(
  fieldStatuses: NormalizedReceiptExtraction["fieldStatuses"],
  warnings: string[],
): string[] {
  const messages: string[] = [];
  const statuses = Object.values(fieldStatuses);
  if (statuses.some((status) => status.status === "needs_confirmation")) {
    messages.push(getReceiptExtractionGlobalIssueMessage("needs_confirmation"));
  }
  for (const [field, status] of Object.entries(fieldStatuses) as Array<
    [ReceiptExtractionField, FieldStatus<unknown>]
  >) {
    if (status.status === "needs_confirmation") {
      messages.push(getReceiptExtractionFieldConfirmationMessage(field));
    }
    if (status.status === "rejected" && status.reason) {
      messages.push(getReceiptExtractionFieldIssueMessage(field, status.reason));
    }
  }
  if (statuses.some((status) => status.status === "rejected")) {
    messages.push(getReceiptExtractionGlobalIssueMessage("rejected"));
  }
  return [...messages, ...warnings];
}

/**
 * OCR 抽出された生データを正規化し、UI 表示用のフィールド状態と issue メッセージを生成する。
 */
export function normalizeReceiptExtraction(
  extraction: RawReceiptExtraction,
): NormalizedReceiptExtraction {
  const warnings = parseWarnings(extraction.warnings);
  const hasGlobalWarning = warnings.length > 0;

  const shopName = normalizeRawShopName(extraction.shopName);
  const date = normalizeRawExtractedDate(extraction.date);
  const amountYen = normalizeRawExtractedAmount(extraction.amountYen);

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
