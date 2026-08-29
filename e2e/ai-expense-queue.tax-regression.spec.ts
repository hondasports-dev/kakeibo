import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupAiExpenseQueue } from "./helpers/cleanup";
import { seedMixedTaxReviewDraftByUser, seedTaxReviewDraftByUser } from "./helpers/seed";

const INPUT_PATH = "/weeks/current/input";

async function waitForReceiptInputQueue(page: Page) {
  await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "レシート入力" })).toBeVisible({
    timeout: 20_000,
  });
  const queue = page.locator(".input-workbench--expense");
  await expect(queue).toBeVisible({ timeout: 20_000 });
  return queue;
}

async function openFirstReviewDialog(page: Page) {
  const queue = await waitForReceiptInputQueue(page);
  const reviewButton = queue
    .getByRole("region", { name: "確認待ち" })
    .getByRole("button", { name: "確認する", exact: true })
    .first();
  await expect(reviewButton).toBeVisible({ timeout: 20_000 });
  await reviewButton.click();
  const dialog = page.getByRole("dialog", { name: "下書き確認" });
  await expect(dialog).toBeVisible();
  return { queue, dialog };
}

async function expectItemTaxRate(dialog: Locator, itemName: string, taxRate: string) {
  const itemNameFields = dialog.getByRole("textbox", { name: "明細名" });
  const itemNames = await itemNameFields.evaluateAll((fields) =>
    fields.map((field) => (field as HTMLInputElement).value),
  );
  const itemIndex = itemNames.indexOf(itemName);
  expect(itemIndex, itemName + "の明細が見つからない").toBeGreaterThanOrEqual(0);
  const itemCard = dialog
    .locator('input[name="item-name-' + itemIndex + '"]')
    .locator(
      "xpath=ancestor::div[.//button[contains(normalize-space(), '詳細（通常は不要）')]][1]",
    );
  const visibleTaxLabel = itemCard.locator("p:visible").filter({ hasText: "税率 " + taxRate });
  await expect(visibleTaxLabel).toHaveCount(1);
  await expect(visibleTaxLabel).toHaveText("税率 " + taxRate);
}

test.describe("Issue #672 税判定回帰の代表E2E", () => {
  test.beforeEach(async () => {
    await cleanupAiExpenseQueue();
  });

  test("@smoke R001 ユーザー確認した支払総額を再編集後も保持する", async ({ page }) => {
    const userId = process.env.E2E_CLERK_USER_ID?.trim();
    if (!userId) {
      test.skip();
      return;
    }

    await gotoAuthenticated(page, INPUT_PATH);
    await waitForReceiptInputQueue(page);
    await seedTaxReviewDraftByUser(userId);
    await page.reload();
    const { queue, dialog } = await openFirstReviewDialog(page);

    await dialog.getByLabel("レシート合計", { exact: true }).fill("7803");
    await dialog.getByRole("radio", { name: "分からない" }).first().check();
    await expect(dialog.getByText(/税を推測せず、レシート合計だけで保存します/)).toBeVisible();
    await dialog.getByRole("button", { name: "この内容で保存" }).click();

    const readySection = queue.getByRole("region", { name: "登録できます" });
    const readyItem = readySection.locator(".ai-expense-queue-item").first();
    await expect(readyItem.getByText("7,803円")).toBeVisible();
    await expect(readyItem.getByText("合計だけで保存")).toBeVisible();

    await readyItem.getByRole("button", { name: "修正する" }).click();
    await expect(dialog.getByLabel("レシート合計", { exact: true })).toHaveValue("7803");
  });

  test("@smoke R003 混在税率の商品修正後に詳細保存できる", async ({ page }) => {
    const userId = process.env.E2E_CLERK_USER_ID?.trim();
    if (!userId) {
      test.skip();
      return;
    }

    await gotoAuthenticated(page, INPUT_PATH);
    await waitForReceiptInputQueue(page);
    await seedMixedTaxReviewDraftByUser(userId);
    await page.reload();
    const { queue, dialog } = await openFirstReviewDialog(page);

    await dialog.getByRole("radio", { name: "商品によって異なる" }).check();
    await dialog.getByRole("radio", { name: "8%と10%が混ざっている" }).check();
    await expect(dialog.getByRole("heading", { name: "商品ごとの税率を確認" })).toBeVisible();
    const expectedMixedTaxRates = {
      パン: "8%",
      洗剤: "10%",
      牛乳: "8%",
      ラップ: "10%",
    } as const;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const select = dialog.getByRole("combobox", { name: /の税率$/ }).first();
      if ((await select.count()) === 0) {
        break;
      }
      const label = await select
        .locator("xpath=ancestor::*[@aria-label][1]")
        .getAttribute("aria-label");
      expect(label, "要確認商品の税率入力ラベル").toMatch(/の税率$/);
      const itemName = label!.replace(/の税率$/, "") as keyof typeof expectedMixedTaxRates;
      const expectedRate = expectedMixedTaxRates[itemName];
      expect(expectedRate, itemName + "の期待税率").toBeDefined();
      await select.click();
      await page.getByRole("option", { name: expectedRate, exact: true }).click();
      await expect
        .poll(async () => {
          const current = dialog.getByRole("combobox", { name: label!, exact: true });
          if ((await current.count()) === 0) return "resolved";
          return (await current.first().textContent())?.trim() ?? "";
        })
        .toMatch(new RegExp(`${expectedRate}|resolved`));
    }
    await expect(dialog.getByText("商品ごとの税率はすべて確認できました。")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByText("8% 218円")).toBeVisible();
    await expect(dialog.getByText("10% 220円")).toBeVisible();
    await expect(
      dialog.getByText("保存予定：小計402円 + 税36円 = 438円（推定を含む）", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "この内容で保存" }).click();
    await expect(dialog).toBeHidden();

    const readyItem = queue
      .getByRole("region", { name: "登録できます" })
      .locator(".ai-expense-queue-item")
      .filter({ hasText: "E2E混在税レビュー店" })
      .first();
    await expect(readyItem).toBeVisible({ timeout: 15_000 });
    await readyItem.getByRole("button", { name: "修正する" }).click();
    const reopenedDialog = page.getByRole("dialog", { name: "下書き確認" });
    await expect(reopenedDialog).toBeVisible();
    const editButton = reopenedDialog.getByRole("button", { name: "修正する", exact: true });
    await expect(editButton).toBeVisible();
    await editButton.click();
    await expect(reopenedDialog.getByRole("textbox", { name: "明細名" })).toHaveCount(4, {
      timeout: 15_000,
    });
    for (const [itemName, expectedRate] of Object.entries(expectedMixedTaxRates)) {
      await expectItemTaxRate(reopenedDialog, itemName, expectedRate);
    }
  });

  test("@smoke R018 確認済みtotalOnlyの5000円を登録できる", async ({ page }) => {
    const userId = process.env.E2E_CLERK_USER_ID?.trim();
    if (!userId) {
      test.skip();
      return;
    }

    await gotoAuthenticated(page, INPUT_PATH);
    await waitForReceiptInputQueue(page);
    await seedTaxReviewDraftByUser(userId);
    await page.reload();
    const { queue, dialog } = await openFirstReviewDialog(page);

    await dialog.getByLabel("レシート合計", { exact: true }).fill("5000");
    await dialog.getByRole("radio", { name: "分からない" }).first().check();
    await dialog.getByRole("button", { name: "この内容で保存" }).click();

    const readyItem = queue
      .getByRole("region", { name: "登録できます" })
      .locator(".ai-expense-queue-item")
      .first();
    await expect(readyItem.getByText("5,000円")).toBeVisible();
    await expect(readyItem.getByText("合計だけで保存")).toBeVisible();
    await expect(readyItem.getByRole("button", { name: "登録する" })).toBeVisible({
      timeout: 15_000,
    });
    await readyItem.getByRole("button", { name: "登録する" }).click();
    await expect(
      queue
        .getByRole("region", { name: "登録済み" })
        .locator(".ai-expense-queue-item")
        .filter({ hasText: "E2E税レビュー店" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      queue
        .getByRole("region", { name: "登録済み" })
        .locator(".ai-expense-queue-item")
        .filter({ hasText: "E2E税レビュー店" })
        .getByText("5,000円"),
    ).toBeVisible();
  });

  test("@smoke totalOnlyからdetailedへ再編集して登録できる", async ({ page }) => {
    const userId = process.env.E2E_CLERK_USER_ID?.trim();
    if (!userId) {
      test.skip();
      return;
    }

    await gotoAuthenticated(page, INPUT_PATH);
    await waitForReceiptInputQueue(page);
    await seedTaxReviewDraftByUser(userId);
    await page.reload();
    const { queue, dialog } = await openFirstReviewDialog(page);

    await dialog.getByRole("radio", { name: "分からない" }).first().check();
    await dialog.getByRole("button", { name: "この内容で保存" }).click();
    await expect(dialog).toBeHidden();

    const readyItem = queue
      .getByRole("region", { name: "登録できます" })
      .locator(".ai-expense-queue-item")
      .filter({ hasText: "E2E税レビュー店" })
      .first();
    await expect(readyItem.getByText("合計だけで保存")).toBeVisible();
    await readyItem.getByRole("button", { name: "修正する" }).click();
    await expect(dialog).toBeVisible();

    await dialog.getByRole("radio", { name: "表示価格にあとから税が加算される" }).check();
    await dialog.getByRole("radio", { name: "すべて8%" }).check();
    await expect(dialog.getByRole("button", { name: "この内容で保存" })).toBeEnabled();
    await dialog.getByRole("button", { name: "この内容で保存" }).click();
    await expect(dialog).toBeHidden();
    await expect(readyItem.getByText("合計だけで保存")).toHaveCount(0);

    await readyItem.getByRole("button", { name: "登録する" }).click();
    const registeredItems = queue
      .getByRole("region", { name: "登録済み" })
      .locator(".ai-expense-queue-item")
      .filter({ hasText: "E2E税レビュー店" });
    await expect(registeredItems).toHaveCount(1, { timeout: 15_000 });
    await expect(registeredItems.first().getByText("108円")).toBeVisible();
  });
});
