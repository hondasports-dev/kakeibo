import { expect, test } from "@playwright/test";
import { addMonths, formatMonthLabel } from "../lib/domain/common/month";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupE2eExpenseEntries, cleanupTestReceipts } from "./helpers/cleanup";

test.describe("月次サマリー（Issue #87）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page);
    // 共有E2Eグループの既存データを消し、選択した過去月の空状態を決定的にする。
    await cleanupE2eExpenseEntries({ page });
    await cleanupTestReceipts({ page });
  });

  test.afterEach(async ({ page }) => {
    await cleanupE2eExpenseEntries({ page });
    await cleanupTestReceipts({ page });
  });

  test("@smoke 月移動、今月への復帰、年月ピッカー、月内明細を確認できる", async ({ page }) => {
    const fixedNow = new Date("2026-08-12T03:00:00.000Z");
    await page.clock.setFixedTime(fixedNow);
    const currentMonth = "2026-08";
    const previousMonth = addMonths(currentMonth, -1);
    const targetMonth = addMonths(currentMonth, -12);
    const [targetYear, targetMonthNumber] = targetMonth.split("-");

    await page.goto(`/months/${currentMonth}`);
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole("heading", { name: "月次サマリー", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "次月へ" })).toBeDisabled();

    await page.getByRole("button", { name: "前月へ" }).click();
    await expect(page).toHaveURL(`/months/${previousMonth}`);
    await expect(page.getByRole("button", { name: "今月へ" })).toBeEnabled();

    await page.getByRole("button", { name: "今月へ" }).click();
    await expect(page).toHaveURL(`/months/${currentMonth}`);
    await expect(
      page.locator(`[aria-label="${formatMonthLabel(currentMonth)}を選択"]`),
    ).toBeVisible();

    await page.getByRole("button", { name: /日付を選択してください/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "カレンダー表示から年選択表示に切り替える" }).click();
    await page.getByRole("radio", { name: targetYear, exact: true }).click();
    await page.getByRole("radio", { name: `${Number(targetMonthNumber)}月`, exact: true }).click();

    await expect(page).toHaveURL(`/months/${targetMonth}`);
    await expect(
      page.locator(`[aria-label="${formatMonthLabel(targetMonth)}を選択"]`),
    ).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "年" })).toHaveText(targetYear);
    await expect(page.getByRole("spinbutton", { name: "月" })).toHaveText(targetMonthNumber);
    await expect(page.getByRole("heading", { name: /支出一覧/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /収入一覧/ })).toBeVisible();
    await expect(page.getByLabel("月次サマリーの支出一覧")).toContainText(
      "この月の支出はまだありません",
    );
    await expect(page.getByLabel("月次サマリーの収入一覧")).toContainText(
      "この月の収入はまだありません",
    );

    await page.getByRole("button", { name: "今月へ" }).click();
    await expect(page).toHaveURL(`/months/${currentMonth}`);

    await page.goto("/months/2000-01");
    await expect(page.getByText("この月の支出はまだありません").first()).toBeVisible();
    await expect(page.getByText("この月の収入はまだありません")).toBeVisible();
  });
});
