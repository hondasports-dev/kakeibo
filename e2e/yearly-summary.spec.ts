import { expect, test } from "@playwright/test";
import { addYears, formatYearLabel, getCurrentYear } from "../lib/domain/common/year";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupE2eExpenseEntries, cleanupTestReceipts } from "./helpers/cleanup";

test.describe("年次サマリー（Issue #541）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page);
    await cleanupE2eExpenseEntries({ page });
    await cleanupTestReceipts({ page });
  });

  test.afterEach(async ({ page }) => {
    await cleanupE2eExpenseEntries({ page });
    await cleanupTestReceipts({ page });
  });

  test("@smoke 年移動、今年への復帰、年ピッカー、月次導線を確認できる", async ({ page }) => {
    const fixedNow = new Date("2026-08-12T03:00:00.000Z");
    await page.clock.setFixedTime(fixedNow);
    const currentYear = getCurrentYear(fixedNow);
    const previousYear = addYears(currentYear, -1);

    await page.goto(`/years/${currentYear}`);
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole("heading", { name: "年次サマリー", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "次年へ" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "月ごとの収支推移" })).toBeVisible();
    await expect(page.getByRole("button", { name: "収支の折れ線グラフ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "カテゴリ別の積み上げ面グラフ" })).toBeVisible();

    await page.getByRole("button", { name: "前年へ" }).click();
    await expect(page).toHaveURL(`/years/${previousYear}`);
    await expect(page.getByRole("button", { name: "今年へ" })).toBeEnabled();

    await page.getByRole("button", { name: "今年へ" }).click();
    await expect(page).toHaveURL(`/years/${currentYear}`);
    await expect(
      page.locator(`[aria-label="${formatYearLabel(currentYear)}を選択"]`),
    ).toBeVisible();

    await page.getByRole("link", { name: /8月/ }).click();
    await expect(page).toHaveURL(`/months/${currentYear}-08`);
    await expect(page.getByRole("heading", { name: "月次サマリー", level: 1 })).toBeVisible();

    await page
      .getByRole("link", { name: `${formatYearLabel(currentYear)}の年次サマリーを見る` })
      .click();
    await expect(page).toHaveURL(`/years/${currentYear}`);

    await page.goto("/years/2099");
    await expect(page).toHaveURL(`/years/${currentYear}`);
    await expect(page.getByText("この年の支出はまだありません").first()).toBeVisible();
  });
});
