import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupTestReceipts } from "./helpers/cleanup";
import { acceptReceiptImageExternalApiConsentIfVisible } from "./helpers/receiptImageConsent";
import { createSyntheticReceiptImage } from "./helpers/syntheticImage";

/**
 * レシート画像抽出 E2E テスト（Issue #65）
 *
 * mock モード（RECEIPT_IMAGE_EXTRACTOR_MODE=mock）で動作を確認する。
 * real モードのテストは production 系環境でのみ実施。
 *
 * カバーするシナリオ（QA Agent 設計）:
 *   - I-1: レシート画像から候補を抽出できる（mock mode）            [P0 / @smoke]
 *   - I-2: OpenAI API key がフロントエンドに露出しない              [P0 / @smoke]
 *   - I-3: 画像抽出エラー時に UI でエラーメッセージが表示される     [P1 / error-handling]
 *   - I-4: 不正な画像ファイルを拒否する                             [P1 / validation]
 *   - I-5: ReceiptImageExtractor が ReceiptForm に統合されている     [P0 / @smoke integration]
 */

const INPUT_PATH = "/weeks/current/input";
const NON_IMAGE_FILE = {
  name: "not-an-image.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("this is not an image", "utf8"),
};

test.afterEach(async ({ context }) => {
  await context.setOffline(false);
  await cleanupTestReceipts();
});

// ---------------------------------------------------------------------------
// シナリオ I-5: ReceiptImageExtractor が ReceiptForm に統合されている @smoke
// ---------------------------------------------------------------------------

test("I-5: 画像入力セクションが ReceiptForm に統合されている @smoke", async ({ page }) => {
  await gotoAuthenticated(page, INPUT_PATH);

  // 「画像から入力」セクションの存在確認
  const imageSection = page.getByRole("region", { name: "画像から入力" });
  await expect(imageSection).toBeVisible();

  // 画像選択ボタンの存在確認（file input を内包するボタン）
  await expect(
    page.locator('button[type="button"]', { hasText: "画像を選択" }).first(),
  ).toBeVisible();

  // 読み取るボタンが初期状態では無効であることを確認
  await expect(page.getByRole("button", { name: "読み取る" })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// シナリオ I-1: mock モードで画像から候補を抽出できる @smoke
// ---------------------------------------------------------------------------

test("I-1: mock モードで画像からレシート候補を抽出し入力フォームに反映する @smoke", async ({
  page,
}) => {
  await gotoAuthenticated(page, INPUT_PATH);

  const syntheticReceiptImage = await createSyntheticReceiptImage(page);
  const fileInput = page.locator('input[type="file"][aria-label="レシート画像を選択"]');
  await fileInput.setInputFiles(syntheticReceiptImage);

  // プレビューとファイル名が表示される
  await expect(page.locator(".receipt-image-file-name")).toContainText("receipt-sample.jpg", {
    timeout: 5000,
  });

  // 読み取るボタンが有効になる
  const extractButton = page.getByRole("button", { name: "読み取る" });
  await expect(extractButton).toBeEnabled({ timeout: 5000 });

  // 読み取るボタンをクリック
  await extractButton.click();
  await acceptReceiptImageExternalApiConsentIfVisible(page);

  // mock mode では「サンプルストア」が店名フィールドに反映される
  const shopNameField = page.getByLabel("店舗名");
  await expect(shopNameField).toHaveValue("サンプルストア", { timeout: 15000 });

  // 金額フィールドに 1234 が反映される
  const amountField = page.getByLabel("合計金額");
  await expect(amountField).toHaveValue(/1[,，]?234/, { timeout: 5000 });

  // mock mode の日付候補が週内日付として反映される
  const dateInput = page.locator('input[name="date"]');
  await expect(dateInput).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  const dateValue = await dateInput.inputValue();
  const minDate = await dateInput.getAttribute("min");
  const maxDate = await dateInput.getAttribute("max");
  expect(minDate).not.toBeNull();
  expect(maxDate).not.toBeNull();
  expect(dateValue >= minDate! && dateValue <= maxDate!).toBe(true);
});

// ---------------------------------------------------------------------------
// シナリオ I-2: OpenAI API key がフロントエンドに露出しない @smoke
// ---------------------------------------------------------------------------

test("I-2: OPENAI_API_KEY がフロントエンドのソースに含まれない @smoke", async ({ page }) => {
  const forbiddenPatterns = [/OPENAI_API_KEY/i, /sk-[A-Za-z0-9_-]{8,}/];
  const observedBrowserPayloads: string[] = [];
  page.on("request", (request) => {
    observedBrowserPayloads.push(request.url());
    const postData = request.postData();
    if (postData) {
      observedBrowserPayloads.push(postData);
    }
  });

  await gotoAuthenticated(page, INPUT_PATH);

  // ページの全 HTML を確認
  const html = await page.content();
  expect(html).not.toContain("sk-");
  expect(html).not.toContain("OPENAI_API_KEY");

  // ローカルストレージにも含まれていないことを確認
  const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(localStorage).not.toContain("sk-");
  expect(localStorage).not.toContain("OPENAI_API_KEY");

  const sameOriginScriptTexts = await page.evaluate(async () => {
    const origin = window.location.origin;
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
    const scriptUrls = scripts
      .map((script) => new URL(script.src, window.location.href))
      .filter((scriptUrl) => scriptUrl.origin === origin)
      .map((scriptUrl) => scriptUrl.href);
    return Promise.all(
      scriptUrls.map(async (scriptUrl) => {
        const response = await fetch(scriptUrl);
        return response.text();
      }),
    );
  });

  for (const payload of [...sameOriginScriptTexts, ...observedBrowserPayloads]) {
    for (const pattern of forbiddenPatterns) {
      expect(payload).not.toMatch(pattern);
    }
  }
});

// ---------------------------------------------------------------------------
// シナリオ I-4: 不正な画像ファイルを拒否する
// ---------------------------------------------------------------------------

test("I-4: 画像以外のファイルを選択するとエラーメッセージを表示する", async ({ page }) => {
  await gotoAuthenticated(page, INPUT_PATH);

  const fileInput = page.locator('input[type="file"][aria-label="レシート画像を選択"]');
  await fileInput.setInputFiles(NON_IMAGE_FILE);

  // エラーメッセージが表示される
  await expect(page.getByText("画像ファイルを選択してください。")).toBeVisible({ timeout: 5000 });

  // 読み取るボタンは無効のまま
  await expect(page.getByRole("button", { name: "読み取る" })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// シナリオ I-3: 抽出エラー時に手入力フォールバック導線が表示される
// ---------------------------------------------------------------------------

test("I-3: 抽出エラー時にエラーメッセージと手入力保存への導線が動く", async ({ page }) => {
  await gotoAuthenticated(page, INPUT_PATH);

  const syntheticReceiptImage = await createSyntheticReceiptImage(page);
  const fileInput = page.locator('input[type="file"][aria-label="レシート画像を選択"]');
  await fileInput.setInputFiles(syntheticReceiptImage);

  await expect(page.locator(".receipt-image-file-name")).toContainText("receipt-sample.jpg", {
    timeout: 5000,
  });

  await page.evaluate(() => {
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (
      this: HTMLCanvasElement,
      type?: string,
      quality?: number,
    ) {
      if (type === "image/jpeg") {
        return `data:image/jpeg;base64,${"a".repeat(900_001)}`;
      }
      return originalToDataUrl.call(this, type, quality);
    };
  });
  await page.getByRole("button", { name: "読み取る" }).click();
  await acceptReceiptImageExternalApiConsentIfVisible(page);

  // エラーメッセージが表示される（クリアボタン付き）
  await expect(page.getByRole("button", { name: "クリア" })).toBeVisible({ timeout: 15000 });

  // 「手入力でも保存できます。」の案内が表示される
  await expect(page.getByText("手入力でも保存できます。")).toBeVisible();

  const shopName = `画像失敗フォールバック_${Date.now()}`;
  await page.locator('input[name="shopName"]').fill(shopName);
  await page.locator('input[name="amountYen"]').fill("980");
  await page.locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]').first().click();
  await page.getByRole("button", { name: "保存して次へ" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "レシートを保存しました" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('input[name="shopName"]')).toHaveValue("");
  await expect(page.locator('input[name="amountYen"]')).toHaveValue("");
});
