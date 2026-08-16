import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLineSummaryCommand } from "./commands";
import {
  LINE_RICH_MENU_CHAT_BAR_TEXT,
  LINE_RICH_MENU_NAME,
  LINE_RICH_MENU_SIZE,
  buildLineRichMenuObject,
  lineRichMenuCells,
  validateLineRichMenuImage,
} from "./richMenu";

const EXPECTED_COMMANDS = [
  { id: "week_summary", type: "week_summary" },
  { id: "week_expense", type: "week_expense" },
  { id: "week_income", type: "week_income" },
  { id: "week_categories", type: "week_categories" },
  { id: "week_trend", type: "week_trend" },
  { id: "help", type: "help" },
] as const;

function cellsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

describe("LINE channel rich menu spec", () => {
  it("6つの固定セルが既存の読み取り専用コマンドへ解決する", () => {
    expect(lineRichMenuCells).toHaveLength(EXPECTED_COMMANDS.length);
    for (const expected of EXPECTED_COMMANDS) {
      const cell = lineRichMenuCells.find((item) => item.id === expected.id);
      expect(cell).toBeDefined();
      expect(parseLineSummaryCommand(cell?.messageText ?? "")).toEqual({ type: expected.type });
    }
  });

  it("グループ固有のカテゴリ名や画像・登録操作をセルに置かない", () => {
    const texts = lineRichMenuCells.map((cell) => cell.messageText);
    expect(texts.some((text) => parseLineSummaryCommand(text).type === "category_lookup")).toBe(
      false,
    );
    expect(texts.join("\n")).not.toMatch(/登録|削除|画像|レシート/);
  });

  it("2500x1686を隙間なく覆い、セルは重ならない", () => {
    expect(LINE_RICH_MENU_SIZE).toEqual({ width: 2500, height: 1686 });
    const area = lineRichMenuCells.reduce(
      (sum, cell) => sum + cell.bounds.width * cell.bounds.height,
      0,
    );
    expect(area).toBe(LINE_RICH_MENU_SIZE.width * LINE_RICH_MENU_SIZE.height);

    for (const cell of lineRichMenuCells) {
      expect(cell.bounds.x).toBeGreaterThanOrEqual(0);
      expect(cell.bounds.y).toBeGreaterThanOrEqual(0);
      expect(cell.bounds.x + cell.bounds.width).toBeLessThanOrEqual(LINE_RICH_MENU_SIZE.width);
      expect(cell.bounds.y + cell.bounds.height).toBeLessThanOrEqual(LINE_RICH_MENU_SIZE.height);
    }

    for (let i = 0; i < lineRichMenuCells.length; i += 1) {
      for (let j = i + 1; j < lineRichMenuCells.length; j += 1) {
        expect(cellsOverlap(lineRichMenuCells[i]!.bounds, lineRichMenuCells[j]!.bounds)).toBe(
          false,
        );
      }
    }
  });

  it("LINE Rich Menu objectはmessage actionだけを使い、chat barは14文字以内", () => {
    expect(LINE_RICH_MENU_NAME).toBe("suzumemo-readonly-summary-v1");
    expect(LINE_RICH_MENU_CHAT_BAR_TEXT.length).toBeGreaterThan(0);
    expect(LINE_RICH_MENU_CHAT_BAR_TEXT.length).toBeLessThanOrEqual(14);

    const object = buildLineRichMenuObject();
    expect(object.size).toEqual(LINE_RICH_MENU_SIZE);
    expect(object.areas).toHaveLength(lineRichMenuCells.length);
    for (const [index, area] of object.areas.entries()) {
      expect(area.action).toEqual({
        type: "message",
        label: lineRichMenuCells[index]?.label,
        text: lineRichMenuCells[index]?.messageText,
      });
    }
  });

  it("設置用PNGはfull sizeの2500x1686である", () => {
    const imagePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../docs/line/rich-menu-readonly-summary.png",
    );
    const bytes = readFileSync(imagePath);
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(LINE_RICH_MENU_SIZE.width);
    expect(bytes.readUInt32BE(20)).toBe(LINE_RICH_MENU_SIZE.height);
    expect(() => validateLineRichMenuImage(bytes)).not.toThrow();
  });

  it("不正な画像は拒否する", () => {
    expect(() => validateLineRichMenuImage(new Uint8Array())).toThrow(
      "LINE rich menu image is invalid",
    );
    expect(() => validateLineRichMenuImage(new Uint8Array([0x00, 0x01, 0x02]))).toThrow(
      "LINE rich menu image is invalid",
    );
  });
});
