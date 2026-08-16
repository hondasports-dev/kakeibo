import { describe, expect, it } from "vitest";
import {
  parseLineSummaryCommand,
  resolveLineEventCommandText,
  resolveLinePostbackToCommandText,
} from "./commands";
import { lineRichMenuCells } from "./richMenu";

describe("parseLineSummaryCommand", () => {
  it.each([
    ["今週の支出", { type: "week_expense" }],
    ["支出", { type: "week_expense" }],
    ["今週の収入", { type: "week_income" }],
    ["収入", { type: "week_income" }],
    ["カテゴリ別", { type: "week_categories" }],
    ["内訳", { type: "week_categories" }],
    ["週別推移", { type: "week_trend" }],
    ["推移", { type: "week_trend" }],
    ["今週", { type: "week_summary" }],
    ["サマリー", { type: "week_summary" }],
    ["家計簿", { type: "week_summary" }],
    ["ヘルプ", { type: "help" }],
    ["使い方", { type: "help" }],
    ["?", { type: "help" }],
    ["", { type: "help" }],
    ["   ", { type: "help" }],
  ])("%s を解釈する", (text, expected) => {
    expect(parseLineSummaryCommand(text)).toEqual(expected);
  });

  it("前後空白と全角空白を正規化する", () => {
    expect(parseLineSummaryCommand(" 　今週の支出  ")).toEqual({ type: "week_expense" });
  });

  it("食費など未知の語句はカテゴリ名候補にする", () => {
    expect(parseLineSummaryCommand("食費")).toEqual({ type: "category_lookup", name: "食費" });
    expect(parseLineSummaryCommand(" 日用品 ")).toEqual({
      type: "category_lookup",
      name: "日用品",
    });
  });

  it("登録・削除などの書き込み依頼はサマリーコマンドにしない", () => {
    expect(parseLineSummaryCommand("支出を登録")).toEqual({
      type: "category_lookup",
      name: "支出を登録",
    });
    expect(parseLineSummaryCommand("削除して")).toEqual({
      type: "category_lookup",
      name: "削除して",
    });
  });
});

describe("resolveLinePostbackToCommandText", () => {
  it("リッチメニューのセルidと送信テキストを既存コマンドへ写像する", () => {
    for (const cell of lineRichMenuCells) {
      expect(resolveLinePostbackToCommandText(cell.id)).toBe(cell.messageText);
      expect(resolveLinePostbackToCommandText(cell.messageText)).toBe(cell.messageText);
      expect(parseLineSummaryCommand(resolveLinePostbackToCommandText(cell.id)).type).not.toBe(
        "category_lookup",
      );
    }
  });

  it("未知のpostbackはカテゴリ検索へ流さず使い方にする", () => {
    expect(resolveLinePostbackToCommandText("week_summary")).toBe("今週");
    expect(resolveLinePostbackToCommandText("action=summary")).toBe("使い方");
    expect(resolveLinePostbackToCommandText("食費")).toBe("使い方");
    expect(resolveLinePostbackToCommandText("")).toBe("使い方");
    expect(parseLineSummaryCommand(resolveLinePostbackToCommandText("unknown"))).toEqual({
      type: "help",
    });
  });
});

describe("resolveLineEventCommandText", () => {
  it("textはそのまま、postbackは正規化し、他イベントは送らない", () => {
    expect(
      resolveLineEventCommandText({ eventType: "text", messageText: "今週" }),
    ).toBe("今週");
    expect(
      resolveLineEventCommandText({ eventType: "postback", postbackData: "week_summary" }),
    ).toBe("今週");
    expect(resolveLineEventCommandText({ eventType: "follow" })).toBeUndefined();
    expect(resolveLineEventCommandText({ eventType: "image" })).toBeUndefined();
  });
});
