import { test, expect } from "@playwright/test";

/**
 * 公開・異常系ページ E2E（Milestone 23 / #249-#255）
 *
 * 未ログインでも閲覧できる公開ページ、404、メンテナンスページを確認する。
 * 認証は不要なため storageState を空にする。
 */

test.describe("公開・異常系ページ", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("@smoke 未ログインで /privacy を表示できる (#249)", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();
    await expect(page.getByText(/Googleログインにより取得されるメールアドレス/)).toBeVisible();
    await expect(
      page.getByText(/Gmail \/ Google Drive \/ Google Calendar 等の内容は取得しません/),
    ).toBeVisible();
  });

  test("@smoke 未ログインで /terms を表示できる (#250)", async ({ page }) => {
    await page.goto("/terms");

    await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "禁止事項" })).toBeVisible();
    await expect(page.getByText(/家計管理・支出記録の正確性を保証しません/)).toBeVisible();
  });

  test("未ログインで存在しないURLに404を表示する (#253)", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-m23");

    await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" })).toBeVisible();
    await expect(page.getByRole("link", { name: "プライバシーポリシー" })).toBeVisible();
    await expect(page.getByRole("link", { name: "利用規約" })).toBeVisible();
  });

  test("未ログインのログイン画面から法務ページへリンクできる (#249/#250)", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await expect(page.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  });

  test("未ログインで /maintenance を表示できる (#255)", async ({ page }) => {
    await page.goto("/maintenance");

    await expect(page.getByRole("heading", { name: "メンテナンス中です" })).toBeVisible();
    await expect(
      page.getByText(/現在、サービス改善のため一時的に利用を停止しています/),
    ).toBeVisible();
  });
});
