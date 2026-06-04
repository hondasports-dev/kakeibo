import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * Issue #144: 支出AI登録のAI処理キューUI
 *
 * カバーするシナリオ:
 * - 複数画像を連続追加すると、各画像が解析待ちとしてキューに表示される。
 * - SP幅でも追加ボタン、キュー状態、既存の画像入力・手入力フォームが破綻しない。
 */

const INPUT_PATH = "/weeks/current/input";
const queueFiles = [
  {
    name: "ai-queue-receipt-1.png",
    mimeType: "image/png",
    buffer: Buffer.from("receipt 1", "utf8"),
  },
  {
    name: "ai-queue-payment-2.png",
    mimeType: "image/png",
    buffer: Buffer.from("payment 2", "utf8"),
  },
];

test.describe("Issue #144 AI処理キューUI", () => {
  test("@smoke 複数画像をAI処理キューに解析待ちとして追加できる", async ({ page }) => {
    await gotoAuthenticated(page, INPUT_PATH);

    const queue = page.getByRole("region", { name: "AI処理キュー" });
    await expect(queue).toBeVisible();
    await expect(queue.getByRole("button", { name: "画像を追加", exact: true })).toBeEnabled();

    await page.getByLabel("AI処理キューへ画像を追加").setInputFiles(queueFiles);

    await expect(queue.getByText("ai-queue-receipt-1.png")).toBeVisible();
    await expect(queue.getByText("ai-queue-payment-2.png")).toBeVisible();
    await expect(queue.getByText("解析待ち")).toHaveCount(2);
    await expect(queue.getByText("キュー 2件")).toBeVisible();
    await expect(queue.getByRole("region", { name: "AI処理中" })).toBeVisible();

    await expect(page.getByRole("region", { name: "画像から入力" })).toBeVisible();
    await expect(page.locator('input[name="shopName"]')).toBeVisible();
    await expect(page.locator('input[name="amountYen"]')).toBeVisible();
  });

  test("@smoke SP幅でも複数画像追加後のキューと入力導線を操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthenticated(page, INPUT_PATH);

    const queue = page.getByRole("region", { name: "AI処理キュー" });
    await expect(queue).toBeVisible();
    await page.getByLabel("AI処理キューへ画像を追加").setInputFiles(queueFiles);

    await expect(queue.getByText("ai-queue-receipt-1.png")).toBeVisible();
    await expect(queue.getByText("ai-queue-payment-2.png")).toBeVisible();
    await expect(queue.getByText("解析待ち")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "保存して次へ" })).toBeVisible();
  });
});

test.describe("Issue #146 AI支出下書きの確認要否分類", () => {
  test("確認が必要な下書きの reviewReasons を日本語で表示する", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue");

    const queue = page.getByRole("region", { name: "AI処理キュー" });
    await expect(queue).toBeVisible();
    await expect(queue.getByText("登録準備OK 1件")).toBeVisible();
    await expect(queue.getByText("確認が必要 1件")).toBeVisible();
    await expect(queue.getByText("失敗 1件")).toBeVisible();

    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();
    await expect(reviewSection.getByText("信頼度が低い項目があります")).toBeVisible();
    await expect(reviewSection.getByText("必須項目を確認してください")).toBeVisible();
    await expect(reviewSection.getByRole("button", { name: "下書きを確認" })).toBeEnabled();

    const failedSection = queue.getByRole("region", { name: "失敗" });
    await expect(failedSection.getByText("failed-receipt.png")).toBeVisible();
    await expect(failedSection.getByText("画像解析に失敗しました")).toBeVisible();
  });
});
