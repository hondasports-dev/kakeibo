/**
 * LINE Messaging API channel の default Rich Menu 仕様。
 * タップは既存の読み取り専用テキストコマンドを送り、Webhook dispatch は変えない。
 */

export const LINE_RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;
export const LINE_RICH_MENU_NAME = "suzumemo-readonly-summary-v1";
export const LINE_RICH_MENU_CHAT_BAR_TEXT = "家計簿";

export type LineRichMenuBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LineRichMenuCell = {
  id: "week_summary" | "week_expense" | "week_income" | "week_categories" | "week_trend" | "help";
  label: string;
  messageText: string;
  bounds: LineRichMenuBounds;
};

const COLUMN_WIDTHS = [833, 834, 833] as const;
const ROW_HEIGHTS = [843, 843] as const;

function cellBounds(column: 0 | 1 | 2, row: 0 | 1): LineRichMenuBounds {
  return {
    x: COLUMN_WIDTHS.slice(0, column).reduce((sum, width) => sum + width, 0),
    y: ROW_HEIGHTS.slice(0, row).reduce((sum, height) => sum + height, 0),
    width: COLUMN_WIDTHS[column],
    height: ROW_HEIGHTS[row],
  };
}

export const lineRichMenuCells: readonly LineRichMenuCell[] = [
  { id: "week_summary", label: "今週", messageText: "今週", bounds: cellBounds(0, 0) },
  { id: "week_expense", label: "支出", messageText: "今週の支出", bounds: cellBounds(1, 0) },
  { id: "week_income", label: "収入", messageText: "今週の収入", bounds: cellBounds(2, 0) },
  { id: "week_categories", label: "内訳", messageText: "カテゴリ別", bounds: cellBounds(0, 1) },
  { id: "week_trend", label: "推移", messageText: "週別推移", bounds: cellBounds(1, 1) },
  { id: "help", label: "使い方", messageText: "使い方", bounds: cellBounds(2, 1) },
];

export type LineRichMenuObject = {
  size: typeof LINE_RICH_MENU_SIZE;
  selected: true;
  name: typeof LINE_RICH_MENU_NAME;
  chatBarText: typeof LINE_RICH_MENU_CHAT_BAR_TEXT;
  areas: Array<{
    bounds: LineRichMenuBounds;
    action: { type: "message"; label: string; text: string };
  }>;
};

export function buildLineRichMenuObject(): LineRichMenuObject {
  return {
    size: LINE_RICH_MENU_SIZE,
    selected: true,
    name: LINE_RICH_MENU_NAME,
    chatBarText: LINE_RICH_MENU_CHAT_BAR_TEXT,
    areas: lineRichMenuCells.map((cell) => ({
      bounds: cell.bounds,
      action: {
        type: "message",
        label: cell.label,
        text: cell.messageText,
      },
    })),
  };
}
