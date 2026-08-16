/**
 * LINE読み取り専用サマリーのコマンド解釈。
 * 家計データへ触れず、テキストだけを意図へ変換する。
 */

import { lineRichMenuCells } from "./richMenu";

export type LineSummaryCommand =
  | { type: "week_summary" }
  | { type: "week_expense" }
  | { type: "week_income" }
  | { type: "week_categories" }
  | { type: "week_trend" }
  | { type: "help" }
  | { type: "category_lookup"; name: string };

const WEEK_SUMMARY_COMMANDS = new Set(["今週", "サマリー", "家計簿", "合計"]);
const WEEK_EXPENSE_COMMANDS = new Set(["今週の支出", "支出合計", "支出"]);
const WEEK_INCOME_COMMANDS = new Set(["今週の収入", "収入合計", "収入"]);
const WEEK_CATEGORY_COMMANDS = new Set(["カテゴリ別", "カテゴリー別", "内訳"]);
const WEEK_TREND_COMMANDS = new Set(["週別推移", "週次推移", "推移"]);
const HELP_COMMANDS = new Set(["ヘルプ", "使い方", "help", "?", "？"]);
const POSTBACK_HELP_COMMAND_TEXT = "使い方";

const RICH_MENU_POSTBACK_COMMAND_TEXT = new Map<string, string>([
  ...lineRichMenuCells.map((cell) => [cell.id, cell.messageText] as const),
  ...lineRichMenuCells.map((cell) => [cell.messageText, cell.messageText] as const),
]);

export function normalizeLineCommandText(messageText: string): string {
  return messageText.replaceAll("\u3000", " ").replace(/\s+/g, " ").trim();
}

export function parseLineSummaryCommand(messageText: string): LineSummaryCommand {
  const normalized = normalizeLineCommandText(messageText);
  if (normalized.length === 0 || HELP_COMMANDS.has(normalized.toLowerCase())) {
    return { type: "help" };
  }
  if (WEEK_TREND_COMMANDS.has(normalized)) {
    return { type: "week_trend" };
  }
  if (WEEK_INCOME_COMMANDS.has(normalized)) {
    return { type: "week_income" };
  }
  if (WEEK_EXPENSE_COMMANDS.has(normalized)) {
    return { type: "week_expense" };
  }
  if (WEEK_CATEGORY_COMMANDS.has(normalized)) {
    return { type: "week_categories" };
  }
  if (WEEK_SUMMARY_COMMANDS.has(normalized)) {
    return { type: "week_summary" };
  }
  return { type: "category_lookup", name: normalized };
}

function isKnownSummaryCommandText(messageText: string): boolean {
  return parseLineSummaryCommand(messageText).type !== "category_lookup";
}

/**
 * inbound postback を既存テキストコマンドへ正規化する。
 * 未知 data は category_lookup に流さず使い方へ落とす。
 */
export function resolveLinePostbackToCommandText(postbackData: string): string {
  const normalized = normalizeLineCommandText(postbackData);
  if (normalized.length === 0) return POSTBACK_HELP_COMMAND_TEXT;
  const fromRichMenu = RICH_MENU_POSTBACK_COMMAND_TEXT.get(normalized);
  if (fromRichMenu !== undefined) return fromRichMenu;
  if (isKnownSummaryCommandText(normalized)) return normalized;
  return POSTBACK_HELP_COMMAND_TEXT;
}

export function resolveLineEventCommandText(event: {
  eventType: string;
  messageText?: string;
  postbackData?: string;
}): string | undefined {
  if (event.eventType === "text") {
    return event.messageText ?? "";
  }
  if (event.eventType === "postback") {
    return resolveLinePostbackToCommandText(event.postbackData ?? "");
  }
  return undefined;
}
