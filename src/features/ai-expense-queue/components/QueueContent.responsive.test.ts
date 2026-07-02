import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ai-expense-queue responsive styles", () => {
  const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");

  it("キューコンテナが横方向に内容を切り落とさない", () => {
    expect(css).not.toMatch(/\.ai-expense-queue\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.ai-expense-queue[\s\S]*max-width:\s*100%/);
  });

  it("ステータスサマリーが折り返せる", () => {
    expect(css).toContain(".ai-expense-queue-status-summary");
    expect(css).toMatch(/\.ai-expense-queue-status-summary[\s\S]*flex-wrap:\s*wrap/);
  });

  it("長いファイル名が折り返せる", () => {
    expect(css).toContain(".ai-expense-queue-item-secondary");
    expect(css).toMatch(/\.ai-expense-queue-item-secondary[\s\S]*overflow-wrap:\s*anywhere/);
  });

  it("SPでは登録済み一覧を手入力フォームの後へ並べる", () => {
    expect(css).toMatch(/\.input-workbench-form\s*\{[^}]*order:\s*3/);
    expect(css).toMatch(/\.queue-section-registered\s*\{[^}]*order:\s*4/);
  });
});
