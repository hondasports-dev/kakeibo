import { test, expect, type Locator, type Page } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import {
  cleanupAiExpenseQueue,
  cleanupE2eExpenseEntries,
  cleanupTestCategories,
  cleanupAiExpenseQueueByUser,
  cleanupE2eExpenseEntriesByUser,
  cleanupTestCategoriesByUser,
} from "./helpers/cleanup";
import { seedAiExpenseDraftForExpenseEntriesByUser } from "./helpers/seed";
import { createSyntheticReceiptImage } from "./helpers/syntheticImage";

/**
 * Issue #144: 支出画像の読み取りUI
 *
 * カバーするシナリオ:
 * - 複数画像を連続追加すると、各画像が解析待ちとしてキューに表示される。
 * - SP幅でも追加ボタン、キュー状態、既存の画像入力・手入力フォームが破綻しない。
 */

const INPUT_PATH = "/weeks/current/input";

async function expectLocatorInsideViewport(locator: Locator) {
  await expect
    .poll(
      async () =>
        locator.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return Math.ceil(rect.right - window.innerWidth);
        }),
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(0);
}

async function expectLocatorInsideContainer(locator: Locator, container: Locator) {
  await expect
    .poll(
      async () => {
        const targetRect = await locator.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return { right: rect.right };
        });
        const containerRect = await container.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return { right: rect.right };
        });
        return Math.ceil(targetRect.right - containerRect.right);
      },
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(0);
}

async function acceptReceiptImageConsentIfNeeded(page: Page, firstFileName: string) {
  const consentDialog = page.getByRole("dialog", {
    name: "画像の外部API送信に同意しますか",
  });
  const firstQueueItem = page
    .getByRole("region", { name: "レシート入力" })
    .getByText(firstFileName)
    .first();

  await expect(consentDialog.or(firstQueueItem).first()).toBeVisible({ timeout: 15000 });
  if (await consentDialog.isVisible()) {
    await consentDialog.getByRole("button", { name: "同意して読み取る" }).click();
  }
}

test.describe("Issue #144 読み取りUI", () => {
  test.beforeEach(async () => {
    await cleanupAiExpenseQueue();
  });

  test("@smoke 複数画像を解析待ちとして追加できる", async ({ page }) => {
    await gotoAuthenticated(page, INPUT_PATH);

    const queue = page.getByRole("region", { name: "レシート入力", exact: true });
    await expect(queue).toBeVisible();
    await expect(queue.getByRole("button", { name: "レシートを追加", exact: true })).toBeEnabled();

    const stamp = Date.now();
    const queueFiles = [
      await createSyntheticReceiptImage(page, `ai-queue-receipt-${stamp}.jpg`),
      await createSyntheticReceiptImage(page, `ai-queue-payment-${stamp}.jpg`),
    ];
    await page.getByLabel("読み取り用画像を追加").setInputFiles(queueFiles);
    await acceptReceiptImageConsentIfNeeded(page, `ai-queue-receipt-${stamp}.jpg`);

    // Issue #152: 非同期ジョブの subscription 反映を待つ。
    // dev DB に同名ファイルの過去ジョブが残っている可能性があるため .first() で限定する。
    await expect(queue.getByText(`ai-queue-receipt-${stamp}.jpg`).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(queue.getByText(`ai-queue-payment-${stamp}.jpg`).first()).toBeVisible({
      timeout: 15000,
    });
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
    const processingSection = queue.getByRole("region", { name: "読み取り中" });
    await expect(processingSection).toBeVisible();
    await expect(processingSection.getByText("2件")).toBeVisible();

    await expect(page.getByRole("region", { name: "画像から入力" })).toHaveCount(0);
    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();
  });

  test("@smoke SP幅では撮影して追加導線が表示され、撮影用inputにcapture属性が付く", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 441, height: 864 });
    await gotoAuthenticated(page, INPUT_PATH);

    await expectLocatorInsideViewport(page.locator(".user-menu-button"));
    await expect(page.locator(".user-menu-button > span")).toBeHidden();

    const queue = page.getByRole("region", { name: "レシート入力", exact: true });
    await expect(queue).toBeVisible();
    await expectLocatorInsideViewport(queue);
    const cameraButton = queue.getByRole("button", { name: "撮影する" });
    const imageButton = queue.getByRole("button", { name: "レシートを追加", exact: true });
    await expect(cameraButton).toBeEnabled();
    await expectLocatorInsideViewport(cameraButton);
    await expectLocatorInsideContainer(cameraButton, queue);
    await expectLocatorInsideViewport(imageButton);
    await expectLocatorInsideContainer(imageButton, queue);
    await expect(page.getByLabel("読み取り用カメラ画像を追加")).toHaveAttribute(
      "capture",
      "environment",
    );

    const stamp = Date.now();
    const cameraFiles = [await createSyntheticReceiptImage(page, `ai-queue-camera-${stamp}.jpg`)];
    await page.getByLabel("読み取り用カメラ画像を追加").setInputFiles(cameraFiles);
    await acceptReceiptImageConsentIfNeeded(page, `ai-queue-camera-${stamp}.jpg`);

    await expect(queue.getByText(`ai-queue-camera-${stamp}.jpg`).first()).toBeVisible({
      timeout: 15000,
    });
    await expectLocatorInsideViewport(queue);
  });

  test("@smoke SP幅でも複数画像追加後のキューと入力導線を操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthenticated(page, INPUT_PATH);

    const queue = page.getByRole("region", { name: "レシート入力", exact: true });
    await expect(queue).toBeVisible();
    await expectLocatorInsideViewport(queue);
    await expect(queue.getByRole("button", { name: "レシートを追加", exact: true })).toBeEnabled();
    const stamp = Date.now();
    const queueFiles = [
      await createSyntheticReceiptImage(page, `ai-queue-receipt-${stamp}.jpg`),
      await createSyntheticReceiptImage(page, `ai-queue-payment-${stamp}.jpg`),
    ];
    await page.getByLabel("読み取り用画像を追加").setInputFiles(queueFiles);
    await acceptReceiptImageConsentIfNeeded(page, `ai-queue-receipt-${stamp}.jpg`);

    // Issue #152: 非同期ジョブの subscription 反映を待つ。
    // dev DB に同名ファイルの過去ジョブが残っている可能性があるため .first() で限定する。
    await expect(queue.getByText(`ai-queue-receipt-${stamp}.jpg`).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(queue.getByText(`ai-queue-payment-${stamp}.jpg`).first()).toBeVisible({
      timeout: 15000,
    });
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
    // Issue #181: 保存ボタンは変わらず「保存して次へ」
    await expect(page.getByRole("button", { name: "保存して次へ" })).toBeVisible();
    await expectLocatorInsideViewport(queue);
  });
});

test.describe("Issue #146 AI支出下書きの確認要否分類", () => {
  test("確認が必要な下書きの reviewReasons を日本語で表示する", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue");

    const queue = page.getByRole("region", { name: "レシート入力" });
    await expect(queue).toBeVisible();
    await expect(queue.getByText("登録準備OK 1件")).toBeVisible();
    await expect(queue.getByText("確認が必要 1件")).toBeVisible();
    await expect(queue.getByText("失敗 1件")).toBeVisible();

    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();
    await expect(reviewSection.getByText("信頼度が低い項目があります")).toBeVisible();
    await expect(reviewSection.getByText("必須項目を確認してください")).toBeVisible();
    await expect(reviewSection.getByRole("button", { name: "確認する" })).toBeEnabled();

    const failedSection = queue.getByRole("region", { name: "失敗" });
    await expect(failedSection.getByText("failed-receipt.png")).toBeVisible();
    await expect(failedSection.getByText("画像解析に失敗しました")).toBeVisible();
  });
});

test.describe("Issue #148 確認が必要なAI支出下書きの編集導線", () => {
  test("確認が必要な下書きを編集して登録準備OKに戻せる", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue");

    const queue = page.getByRole("region", { name: "レシート入力" });
    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();

    await reviewSection.getByRole("button", { name: "確認する" }).click();

    const dialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("店名・内容").fill("大阪市水道局 水道料金");
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

    const queue = page.getByRole("region", { name: "レシート入力" });
    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();

    await reviewSection.getByRole("button", { name: "確認する" }).click();

    const dialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("信頼度が低い項目があります")).toBeVisible();
    await expect(dialog.getByText("必須項目を確認してください")).toBeVisible();
    await expect(dialog.getByLabel("日付")).toHaveValue("2026-06-01");
    await expect(dialog.getByLabel("合計金額")).toHaveValue("9120");
    await expect(dialog.getByLabel("店名・内容")).toHaveValue("大阪市水道局");

    await dialog.getByLabel("店名・内容").fill("大阪市水道局 水道料金");
    await dialog.getByLabel("合計金額").fill("9160");
    await dialog.getByRole("button", { name: "修正して登録" }).click();

    await expect(dialog).toBeHidden();
    await expect(queue.getByText("確認が必要 0件")).toBeVisible();
    const registeredSection = queue.getByRole("region", { name: "登録済み" });
    await expect(registeredSection).toBeVisible();
    await expect(registeredSection.getByText("大阪市水道局")).toBeVisible();
    await expect(registeredSection.getByText("9,160円")).toBeVisible();
    // Issue #175: 登録済みカードに日付が表示される
    await expect(registeredSection.getByText("2026/06/01 ・ 9,160円")).toBeVisible();
  });
});

test.describe("Issue #321 AI支出下書きの明細確認・修正UI", () => {
  test("明細のカテゴリ・金額・追加・削除を操作できる", async ({ page }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue?withItems=1");

    const queue = page.getByRole("region", { name: "レシート入力" });
    const reviewSection = queue.getByRole("region", { name: "確認が必要" });
    await expect(reviewSection.getByText("review-payment.png")).toBeVisible();

    await reviewSection.getByRole("button", { name: "確認する" }).click();

    const dialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "明細" })).toBeVisible();
    await expect(dialog.getByText("明細合計 1,100円 / 差額 8,020円")).toBeVisible();
    await expect(dialog.getByText("未分類")).toBeVisible();
    await expect(dialog.getByText("低信頼度")).toBeVisible();

    await dialog.getByLabel("金額", { exact: true }).first().fill("400");
    await dialog.getByRole("button", { name: "胃薬を削除" }).click();
    await dialog.getByRole("button", { name: "明細を追加" }).click();

    await dialog.getByLabel("明細名").nth(1).fill("牛乳");
    await dialog.getByLabel("金額", { exact: true }).nth(1).fill("520");
    await dialog.getByLabel("明細カテゴリ").nth(1).click();
    await page.getByRole("option", { name: "食費" }).click();

    await dialog.getByLabel("店名・内容").fill("大阪市水道局 水道料金");
    await dialog.getByLabel("合計金額").fill("920");
    await dialog.getByRole("button", { name: "登録準備OKに戻す" }).click();

    await expect(dialog).toBeHidden();
    await expect(queue.getByText("確認が必要 0件")).toBeVisible();
    await expect(queue.getByText("登録準備OK 2件")).toBeVisible();
  });
});

test.describe("Issue #179 AI下書きからexpenseEntriesへ登録", () => {
  test.beforeEach(async () => {
    await cleanupE2eExpenseEntries();
    await cleanupAiExpenseQueue();
    await cleanupTestCategories();
  });

  test("@smoke registerReadyDraftsAsExpenseEntries でexpenseEntriesに登録できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/__e2e__/ai-expense-queue-expense-entries");

    await expect(page.getByText("Issue #179 E2E Test: Register as Expense Entries")).toBeVisible();
    await expect(page.getByTestId("auth-status")).toHaveText("ready");
    await expect(page.getByTestId("convex-status")).toHaveText("ready");

    const currentUserId = (await page.getByTestId("current-user-id").textContent())?.trim();
    expect(currentUserId).toBeTruthy();
    if (!currentUserId) {
      throw new Error("current authenticated user id is empty");
    }

    await cleanupE2eExpenseEntriesByUser(currentUserId);
    await cleanupAiExpenseQueueByUser(currentUserId);
    await cleanupTestCategoriesByUser(currentUserId);

    const { draftId } = await seedAiExpenseDraftForExpenseEntriesByUser(currentUserId);
    await page.goto(`/__e2e__/ai-expense-queue-expense-entries?draftId=${draftId}`);

    await expect(page.getByTestId("auth-status")).toHaveText("ready");
    await expect(page.getByTestId("convex-status")).toHaveText("ready");
    await expect(page.getByTestId("current-user-id")).toHaveText(currentUserId);
    await expect(page.getByTestId("draft-id")).toContainText(draftId);
    await expect(page.getByRole("button", { name: "下書きをexpenseEntriesに登録" })).toBeEnabled();
    await page.getByRole("button", { name: "下書きをexpenseEntriesに登録" }).click();

    await expect(page.getByTestId("error")).toHaveCount(0);
    await expect(page.getByTestId("result")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("registered-draft-count")).toHaveText("1");
    await expect(page.getByTestId("created-entry-count")).toHaveText("2");
    await expect
      .poll(async () => {
        const ids = (await page.getByTestId("created-entry-ids").textContent()) ?? "";
        return ids.split(",").filter(Boolean).length;
      })
      .toBe(2);
  });
});
