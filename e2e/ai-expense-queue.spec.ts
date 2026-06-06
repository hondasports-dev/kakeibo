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

    // Issue #152: 非同期ジョブの subscription 反映を待つ。
    // dev DB に同名ファイルの過去ジョブが残っている可能性があるため .first() で限定する。
    await expect(queue.getByText("ai-queue-receipt-1.png").first()).toBeVisible({ timeout: 15000 });
    await expect(queue.getByText("ai-queue-payment-2.png").first()).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () => {
          const statusLabels = ["解析待ち", "解析中", "登録準備OK", "確認が必要", "失敗"];
          let total = 0;
          for (const label of statusLabels) {
            total += await queue.getByText(label).count();
          }
          return total;
        },
        { timeout: 15000 },
      )
      .toBeGreaterThanOrEqual(2);
    const processingSection = queue.getByRole("region", { name: "AI処理中" });
    await expect(processingSection).toBeVisible();
    await expect(processingSection.getByText("2件")).toBeVisible();

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

    // Issue #152: 非同期ジョブの subscription 反映を待つ。
    // dev DB に同名ファイルの過去ジョブが残っている可能性があるため .first() で限定する。
    await expect(queue.getByText("ai-queue-receipt-1.png").first()).toBeVisible({ timeout: 15000 });
    await expect(queue.getByText("ai-queue-payment-2.png").first()).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () => {
          const statusLabels = ["解析待ち", "解析中", "登録準備OK", "確認が必要", "失敗"];
          let total = 0;
          for (const label of statusLabels) {
            total += await queue.getByText(label).count();
          }
          return total;
        },
        { timeout: 15000 },
      )
      .toBeGreaterThanOrEqual(2);
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

test.describe("Issue #148 確認が必要なAI支出下書きの編集導線", () => {
  test("確認が必要な下書きを編集して登録準備OKに戻せる", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue");

    const queue = page.getByRole("region", { name: "AI処理キュー" });
    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();

    await reviewSection.getByRole("button", { name: "下書きを確認" }).click();

    const dialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("支払内容").fill("水道料金");
    await dialog.getByLabel("合計金額").fill("9160");
    await dialog.getByRole("button", { name: "登録準備OKに戻す" }).click();

    await expect(dialog).toBeHidden();
    await expect(queue.getByText("確認が必要 0件")).toBeVisible();
    await expect(queue.getByText("登録準備OK 2件")).toBeVisible();
    const readySection = queue.getByRole("region", { name: "登録準備OK" });
    await expect(readySection.getByText("大阪市水道局")).toBeVisible();
    await expect(readySection.getByText("9,160円")).toBeVisible();
  });

  test("確認が必要な下書きを編集して登録済みにできる", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue");

    const queue = page.getByRole("region", { name: "AI処理キュー" });
    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();

    await reviewSection.getByRole("button", { name: "下書きを確認" }).click();

    const dialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("信頼度が低い項目があります")).toBeVisible();
    await expect(dialog.getByText("必須項目を確認してください")).toBeVisible();
    await expect(dialog.getByLabel("日付")).toHaveValue("2026-06-01");
    await expect(dialog.getByLabel("合計金額")).toHaveValue("9120");
    await expect(dialog.getByLabel("支払先")).toHaveValue("大阪市水道局");

    await dialog.getByLabel("支払内容").fill("水道料金");
    await dialog.getByLabel("合計金額").fill("9160");
    await dialog.getByRole("button", { name: "修正して登録" }).click();

    await expect(dialog).toBeHidden();
    await expect(queue.getByText("確認が必要 0件")).toBeVisible();
    const registeredSection = queue.getByRole("region", { name: "登録済み" });
    await expect(registeredSection).toBeVisible();
    await expect(registeredSection.getByText("大阪市水道局")).toBeVisible();
    await expect(registeredSection.getByText("9,160円")).toBeVisible();
  });
});
