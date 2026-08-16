import { describe, expect, it } from "vitest";
import {
  parseLineSummaryCommand,
  resolveCategoryLookup,
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
    ["今週の家計", { type: "week_summary" }],
    ["ヘルプ", { type: "help" }],
    ["使い方", { type: "help" }],
    ["?", { type: "help" }],
    ["", { type: "help" }],
    ["   ", { type: "help" }],
    ["レシートを送る", { type: "receipt_guide" }],
    ["レシート", { type: "receipt_guide" }],
  ])("%s を解釈する", (text, expected) => {
    expect(parseLineSummaryCommand(text)).toEqual(expected);
  });

  it("前後空白と全角空白を正規化する", () => {
    expect(parseLineSummaryCommand(" 　今週の支出  ")).toEqual({ type: "week_expense" });
  });

  it("代表的な自然文を既存intentへ解決する", () => {
    expect(parseLineSummaryCommand("今週いくら使った？")).toEqual({ type: "week_expense" });
    expect(parseLineSummaryCommand("今月じゃなくて今週の支出教えて")).toEqual({
      type: "week_expense",
    });
    expect(parseLineSummaryCommand("収入はいくら？")).toEqual({ type: "week_income" });
    expect(parseLineSummaryCommand("最近の推移見せて")).toEqual({ type: "week_trend" });
    expect(parseLineSummaryCommand("食費どれくらい？")).toEqual({
      type: "category_lookup",
      name: "食費",
    });
    expect(parseLineSummaryCommand("こんにちは")).toEqual({ type: "help" });
    expect(parseLineSummaryCommand("何ができる？")).toEqual({ type: "help" });
  });

  it("記号・空白・語尾の違いで判定が壊れない", () => {
    expect(parseLineSummaryCommand("今週の支出！！")).toEqual({ type: "week_expense" });
    expect(parseLineSummaryCommand("収入　は　いくら")).toEqual({ type: "week_income" });
    expect(parseLineSummaryCommand("週別推移。")).toEqual({ type: "week_trend" });
  });

  it("食費などカテゴリとして解釈できる語句だけを候補にする", () => {
    expect(parseLineSummaryCommand("食費")).toEqual({ type: "category_lookup", name: "食費" });
    expect(parseLineSummaryCommand(" 日用品 ")).toEqual({
      type: "category_lookup",
      name: "日用品",
    });
    expect(parseLineSummaryCommand("今週の食費")).toEqual({
      type: "category_lookup",
      name: "食費",
    });
  });

  it("登録・削除などの書き込み依頼と未知入力はヘルプにする", () => {
    expect(parseLineSummaryCommand("支出を登録")).toEqual({ type: "help" });
    expect(parseLineSummaryCommand("削除して")).toEqual({ type: "help" });
    expect(parseLineSummaryCommand("おはよう")).toEqual({ type: "help" });
    expect(parseLineSummaryCommand("abcxyz")).toEqual({ type: "help" });
  });

  it("推移などより具体的なintentはカテゴリ抽出より優先する", () => {
    expect(parseLineSummaryCommand("食費の推移見せて")).toEqual({ type: "week_trend" });
  });
});

describe("resolveCategoryLookup", () => {
  const categories = [{ name: "食費" }, { name: "日用品" }, { name: "交通費" }];

  it("完全一致を優先し、文中に一意な最長名が含まれるときだけ解決する", () => {
    expect(resolveCategoryLookup("食費", categories)?.name).toBe("食費");
    expect(resolveCategoryLookup("食費どれくらい", categories)?.name).toBe("食費");
    expect(resolveCategoryLookup("旅行", categories)).toBeUndefined();
    expect(resolveCategoryLookup("食費と日用品", categories)).toBeUndefined();
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
    expect(resolveLineEventCommandText({ eventType: "text", messageText: "今週" })).toBe("今週");
    expect(
      resolveLineEventCommandText({ eventType: "postback", postbackData: "week_summary" }),
    ).toBe("今週");
    expect(resolveLineEventCommandText({ eventType: "follow" })).toBeUndefined();
    expect(resolveLineEventCommandText({ eventType: "image" })).toBeUndefined();
  });
});
