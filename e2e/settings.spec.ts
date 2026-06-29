import { expect, test } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

test.describe("設定台帳（Issue #375）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, "/settings");
    await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();
  });

  test("@smoke 3領域の現在値と危険な操作を順序どおり表示する", async ({ page }) => {
    const ledger = page.getByTestId("settings-ledger");
    await expect(ledger).toBeVisible();
    await expect(ledger.getByRole("heading", { name: "グループ", level: 2 })).toBeVisible();
    await expect(ledger.getByRole("heading", { name: "カテゴリ", level: 2 })).toBeVisible();
    await expect(ledger.getByRole("heading", { name: "週の設定", level: 2 })).toBeVisible();
    await expect(ledger.getByText(/.+曜日 から .+曜日 まで/)).toBeVisible();

    const headings = await ledger.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual(["グループ", "カテゴリ", "週の設定", "危険な操作"]);

    const dangerTrigger = ledger.getByRole("button", { name: "危険な操作" });
    await expect(dangerTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("危険な操作をキーボードで展開できる", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "危険な操作" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: "オーナー権限の譲渡", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "グループの削除", level: 3 })).toBeVisible();
  });

  test("週設定を保存して成功通知を表示する", async ({ page }) => {
    await page.getByRole("button", { name: "変更を保存" }).click();
    await expect(page.getByText("週の設定を保存しました")).toBeVisible({ timeout: 15_000 });
  });

  test("/categories 互換ルートでも同じ設定台帳を表示する", async ({ page }) => {
    await page.goto("/categories");
    await expect(page).toHaveURL("/categories");
    await expect(page.getByTestId("settings-ledger")).toBeVisible();
    await expect(page.getByRole("heading", { name: "カテゴリ", level: 2 })).toBeVisible();
  });
});
