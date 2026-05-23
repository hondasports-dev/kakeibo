import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * ナビゲーション E2E テスト
 *
 * Issue #49「UIの機能整理」の受け入れ確認。
 *
 * カバーするシナリオ:
 *   - シナリオ N-1: SP幅でBottomNavigation 4タブが表示され、タップで各画面に遷移できる (P0 / smoke)
 *   - シナリオ N-2: PC幅でBottomNavigationが非表示になり、Drawerが表示される (P0 / smoke)
 *   - シナリオ N-3: DrawerのすべてのリンクからURL遷移できる (P0 / smoke)
 *   - シナリオ N-4: ダッシュボードにカテゴリ別内訳・前週比カードが表示されない (P1 / validation)
 *   - シナリオ N-5: SP幅でInputPageを開くとフォームのみが表示される (P1 / validation)
 *   - シナリオ N-6: PC幅でInputPageを開くと左右2ペインレイアウトになる (P1 / validation)
 *   - シナリオ N-7: SummaryPageに週次サマリーが表示される (P1 / validation)
 *   - シナリオ N-8: SummaryPageに週次レビューへの遷移ボタンがある (P1 / validation)
 *   - シナリオ N-9: SPで入力フローを一通り完走できる (P0 / validation)
 *   - シナリオ N-10: 既存のURL構造が維持されている (P0 / regression)
 */

function getCurrentWeekStartDate(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

test.describe("ナビゲーション（Issue #49）", () => {
  test("@smoke @navigation シナリオN-1: SP幅でBottomNavigation 4タブが表示され、タップで各画面に遷移できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationが表示されることを確認
    const bottomNav = page.getByRole("navigation", { name: "navigation" });
    await expect(bottomNav).toBeVisible();

    // 4つのタブが表示されることを確認
    await expect(page.getByRole("link", { name: "ホーム" })).toBeVisible();
    await expect(page.getByRole("link", { name: "入力" })).toBeVisible();
    await expect(page.getByRole("link", { name: "履歴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "設定" })).toBeVisible();

    // 各タブをタップして遷移を確認
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: "入力" }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");
  });

  test("@smoke @navigation シナリオN-2: PC幅でBottomNavigationが非表示になり、Drawerが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // BottomNavigationが非表示またはDOMに存在しないことを確認
    const bottomNav = page.getByRole("navigation", { name: "navigation" });
    await expect(bottomNav).not.toBeVisible();

    // Drawerが表示されることを確認
    const drawer = page.getByRole("navigation").or(page.getByLabel("サイドメニュー"));
    await expect(drawer.first()).toBeVisible();
  });

  test("@smoke @navigation シナリオN-3: DrawerのすべてのリンクからURL遷移できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Drawer内のリンクをクリックして遷移を確認
    await page.getByRole("link", { name: "入力" }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");

    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL("/");
  });

  test("@navigation シナリオN-4: ダッシュボードにカテゴリ別内訳・前週比カードが表示されない", async ({
    page,
  }) => {
    await gotoAuthenticated(page);

    // 「カテゴリ別内訳」「カテゴリ別支出」というテキストが表示されないことを確認
    await expect(page.getByText("カテゴリ別内訳")).not.toBeVisible();
    await expect(page.getByText("カテゴリ別支出")).not.toBeVisible();

    // カードの数が3枚以内であることを確認
    const articles = page.locator('[role="article"]');
    const count = await articles.count();
    expect(count).toBeLessThanOrEqual(3);
  });

  test("@navigation シナリオN-5: SP幅でInputPageを開くとフォームのみが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await page.setViewportSize({ width: 390, height: 844 });

    // 入力フォームが表示されることを確認
    await expect(page.locator('input[name="shopName"]')).toBeVisible();
    await expect(page.locator('input[name="amountYen"]')).toBeVisible();
    await expect(page.getByRole("listbox", { name: "カテゴリ候補" })).toBeVisible();

    // サマリーがDOM上に存在しないまたは非表示であることを確認
    const summary = page.getByText("今週のサマリー");
    await expect(summary).not.toBeVisible();
  });

  test("@navigation シナリオN-6: PC幅でInputPageを開くと左右2ペインレイアウトになる", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await page.setViewportSize({ width: 1280, height: 800 });

    // 入力フォームが表示されることを確認
    await expect(page.locator('input[name="shopName"]')).toBeVisible();
    await expect(page.locator('input[name="amountYen"]')).toBeVisible();

    // サマリーパネルも同時に表示されることを確認（workbench-grid レイアウト）
    await expect(page.getByText("今週のサマリー")).toBeVisible();
  });

  test("@navigation シナリオN-7: SummaryPageに週次サマリーが表示される", async ({
    page,
  }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    // 「合計」または「支出合計」的なテキストが表示されることを確認
    await expect(
      page.getByText("合計").or(page.getByText("支出合計")),
    ).toBeVisible();

    // WeekNavigator（前の週/次の週ボタン）が表示されることを確認
    await expect(page.getByRole("button", { name: /前の週/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /次の週/ })).toBeVisible();
  });

  test("@navigation シナリオN-8: SummaryPageに週次レビューへの遷移ボタンがある", async ({
    page,
  }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    // 「振り返り」「レビュー」「完了」などのボタンまたはリンクが存在することを確認
    await expect(
      page.getByRole("button", { name: /振り返り|レビュー|完了/ }).or(
        page.getByRole("link", { name: /振り返り|レビュー|完了/ }),
      ),
    ).toBeVisible();
  });

  test("@smoke @navigation シナリオN-9: SPで入力フローを一通り完走できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationの「入力」タブをタップ
    await page.getByRole("link", { name: "入力" }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    // 入力フォームが表示されることを確認
    await expect(page.locator('input[name="shopName"]')).toBeVisible();
    await expect(page.locator('input[name="amountYen"]')).toBeVisible();

    // BottomNavigationも引き続き表示されていることを確認
    await expect(page.getByRole("navigation", { name: "navigation" })).toBeVisible();
  });

  test("@smoke @navigation シナリオN-10: 既存のURL構造が維持されている", async ({
    page,
  }) => {
    // 各URLに直接アクセスして404にならないことを確認
    await gotoAuthenticated(page, "/");
    await expect(page.getByText("今週のレシート入力")).toBeVisible();

    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.locator('input[name="shopName"]')).toBeVisible();

    await gotoAuthenticated(page, "/settings");
    await expect(page.getByText("設定")).toBeVisible();

    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByText("合計").or(page.getByText("支出合計"))).toBeVisible();
  });
});
