import { describe, expect, it } from "vitest";
import { parseLineSummaryCommand } from "./commands";
import {
  LINE_WEB_APP_PATH,
  buildLineQuickReplyActions,
  toLineQuickReplyPayload,
} from "./quickReply";

const WEB_URL = "https://suzumemo.test/weeks/current/input";

describe("buildLineQuickReplyActions", () => {
  it("未連携と取得失敗では家計操作を出さない", () => {
    expect(buildLineQuickReplyActions("unlinked", WEB_URL)).toEqual([]);
    expect(buildLineQuickReplyActions("unavailable", WEB_URL)).toEqual([]);
  });

  it("支出サマリーのあとにカテゴリ別・推移・Webを付ける", () => {
    expect(buildLineQuickReplyActions("week_expense", WEB_URL)).toEqual([
      { type: "message", label: "カテゴリ別", text: "カテゴリ別" },
      { type: "message", label: "週別推移", text: "週別推移" },
      { type: "uri", label: "Webで見る", uri: WEB_URL },
    ]);
  });

  it("ヘルプでは主要導線を提示し、messageは既存コマンドへ正規化できる", () => {
    const actions = buildLineQuickReplyActions("help", WEB_URL);
    expect(actions.some((action) => action.type === "uri" && action.uri === WEB_URL)).toBe(true);
    expect(
      actions.some((action) => action.type === "message" && action.text === "レシートを送る"),
    ).toBe(true);
    for (const action of actions) {
      if (action.type === "message") {
        expect(parseLineSummaryCommand(action.text).type).not.toBe("category_lookup");
      }
    }
  });

  it("グループ未設定ではWeb導線だけを付ける", () => {
    expect(buildLineQuickReplyActions("no_group", WEB_URL)).toEqual([
      { type: "uri", label: "Webで見る", uri: WEB_URL },
    ]);
  });
});

describe("toLineQuickReplyPayload", () => {
  it("許可したWeb URL以外のURIは落とす", () => {
    const payload = toLineQuickReplyPayload(
      [
        { type: "message", label: "支出", text: "今週の支出" },
        { type: "uri", label: "Webで見る", uri: "https://evil.example/phish" },
      ],
      WEB_URL,
    );
    expect(payload).toEqual({
      items: [{ type: "action", action: { type: "message", label: "支出", text: "今週の支出" } }],
    });
  });

  it("Webパス定数は既存の入力画面である", () => {
    expect(LINE_WEB_APP_PATH).toBe("/weeks/current/input");
  });
});
