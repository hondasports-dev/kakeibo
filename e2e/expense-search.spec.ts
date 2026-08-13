import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupE2eExpenseEntries } from "./helpers/cleanup";

test.describe("支出検索（Issue #537）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await cleanupE2eExpenseEntries({ page });
  });

  test.afterEach(async ({ page }) => {
    await cleanupE2eExpenseEntries({ page });
  });

  test("@smoke ヘッダー検索から店名で支出を見つけられる", async ({ page }) => {
    await page.getByLabel("店舗名 / 支払先").fill("検索用スーパー北浜");
    await page.getByLabel("合計金額").fill("3210");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 15_000 });

    await page.getByLabel("支出を検索").fill("北浜");
    await page.getByRole("button", { name: "検索する" }).click();

    await expect(page).toHaveURL(/\/search\?q=/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "支出検索", level: 1 })).toBeVisible();
    await expect(page.getByText("検索用スーパー北浜").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("3,210円").first()).toBeVisible();
  });

  test("金額条件で0件なら空メッセージを表示する", async ({ page }) => {
    await page.getByLabel("店舗名 / 支払先").fill("金額フィルタ店");
    await page.getByLabel("合計金額").fill("1500");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 15_000 });

    await page.getByLabel("支出を検索").fill("金額フィルタ店");
    await page.getByRole("button", { name: "検索する" }).click();
    await expect(page.getByRole("heading", { name: "支出検索", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "検索結果（1件）" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/search?q=${encodeURIComponent("金額フィルタ店")}&min=9000`);
    await expect(page.getByText("条件に合う支出はありません")).toBeVisible({ timeout: 10_000 });
  });

  test("SP幅でもヘッダー検索窓が見える", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("支出を検索")).toBeVisible();
  });
});
