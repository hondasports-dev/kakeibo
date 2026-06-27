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
 *   - シナリオ N-8: SummaryPageに週移動導線がある (P1 / validation)
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
  test("@navigation シナリオN-1.1: SP幅でBottomNavigationの非選択項目と選択状態が視認できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const bottomNav = page.getByRole("navigation", { name: "ボトムナビゲーション" });
    await expect(bottomNav).toBeVisible();

    for (const label of ["入力", "履歴", "設定"]) {
      const item = bottomNav.getByRole("link", { name: label, exact: true });
      await expect(item).toBeVisible();
      await expect(item.locator("svg")).toBeVisible();

      const colors = await item.evaluate((element) => {
        const labelElement = element.querySelector(".MuiBottomNavigationAction-label");
        const iconElement = element.querySelector("svg");
        const navElement = element.closest("nav");
        return {
          label: labelElement ? getComputedStyle(labelElement).color : "",
          icon: iconElement ? getComputedStyle(iconElement).color : "",
          background: navElement ? getComputedStyle(navElement).backgroundColor : "",
        };
      });

      expect(colors.label).not.toBe(colors.background);
      expect(colors.icon).not.toBe(colors.background);
    }

    const selectedItem = bottomNav.getByRole("link", { name: "ホーム", exact: true });
    const selectedBackground = await selectedItem.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(selectedBackground).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("@smoke @navigation シナリオN-1: SP幅でBottomNavigation 4タブが表示され、タップで各画面に遷移できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationが表示されることを確認
    const bottomNav = page.getByRole("navigation", { name: "ボトムナビゲーション" });
    await expect(bottomNav).toBeVisible();

    // 4つのタブが表示されることを確認（BottomNav 内に限定）
    await expect(bottomNav.getByRole("link", { name: "ホーム" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "入力", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "履歴" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "設定", exact: true })).toBeVisible();

    // 各タブをタップして遷移を確認
    await bottomNav.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL("/");

    await bottomNav.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    await bottomNav.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page).toHaveURL("/settings");
  });

  test("@smoke @navigation シナリオN-2: PC幅でBottomNavigationが非表示になり、Drawerが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // BottomNavigationが非表示またはDOMに存在しないことを確認
    const bottomNav = page.getByRole("navigation", { name: "ボトムナビゲーション" });
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

    // Drawer内のリンクをクリックして遷移を確認（Drawer に限定）
    const drawer = page.getByLabel("サイドメニュー");
    await drawer.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    await drawer.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page).toHaveURL("/settings");

    await drawer.getByRole("link", { name: "ホーム", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("@smoke @sidebar シナリオN-3.1: PC幅でサイドバーをChevronLeftボタンで閉じられる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    const drawer = page.getByLabel("サイドメニュー");

    // 初期状態で「サイドバーを閉じる」ボタンが存在することを確認
    const closeButton = drawer.getByRole("button", { name: "サイドバーを閉じる" });
    await expect(closeButton).toBeVisible();

    // ナビラベルが表示されていることを確認
    await expect(drawer.getByText("ホーム")).toBeVisible();
    await expect(drawer.getByText("入力")).toBeVisible();

    // 閉じるボタンをクリック
    await closeButton.click();

    // ナビラベルが非表示になることを確認（DOMから削除される）
    await expect(drawer.getByText("ホーム")).not.toBeVisible();
    await expect(drawer.getByText("入力")).not.toBeVisible();

    // 「サイドバーを開く」ボタンが表示されることを確認
    const openButton = drawer.getByRole("button", { name: "サイドバーを開く" });
    await expect(openButton).toBeVisible();
  });

  test("@smoke @sidebar シナリオN-3.2: PC幅でサイドバーをChevronRightボタンで再度開ける", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    const drawer = page.getByLabel("サイドメニュー");

    // まず閉じる
    const closeButton = drawer.getByRole("button", { name: "サイドバーを閉じる" });
    await closeButton.click();

    // 開くボタンをクリック
    const openButton = drawer.getByRole("button", { name: "サイドバーを開く" });
    await openButton.click();

    // ナビラベルが再表示されることを確認
    await expect(drawer.getByText("ホーム")).toBeVisible();
    await expect(drawer.getByText("入力")).toBeVisible();

    // 閉じるボタンが戻ることを確認
    await expect(closeButton).toBeVisible();
  });

  test("@sidebar シナリオN-3.3: サイドバー閉じた状態でもアイコン付きナビで遷移できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    const drawer = page.getByLabel("サイドメニュー");

    // サイドバーを閉じる
    await drawer.getByRole("button", { name: "サイドバーを閉じる" }).click();

    // アイコン付きのナビ項目をクリックして遷移を確認
    await drawer.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    await drawer.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page).toHaveURL("/settings");
  });

  test("@navigation シナリオN-4: ダッシュボードにカテゴリ別内訳・前週比が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);

    await expect(page.getByRole("heading", { name: "支出カテゴリ", level: 2 })).toBeVisible();
    await expect(page.getByLabel("前週比").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "前週との比較", level: 2 })).toBeVisible();
  });

  test("@navigation シナリオN-5: SP幅でInputPageを開くとフォームのみが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await page.setViewportSize({ width: 390, height: 844 });

    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    // 入力フォームが表示されることを確認（aria-label ベースのセレクター）
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();
    await expect(page.getByRole("listbox", { name: "カテゴリ候補" })).toBeVisible();

    // サマリーがDOM上に存在しないまたは非表示であることを確認
    const summary = page.getByText("今週のサマリー");
    await expect(summary).not.toBeVisible();
  });

  test("@navigation シナリオN-6: PC幅でInputPageを開くと入力フォームとWeekNavigatorが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await page.setViewportSize({ width: 1280, height: 800 });

    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();

    // Issue #77: ReviewMemoPanel は InputPage から SummaryPage に移動した
    // PC幅では WeekNavigator（前の週/次の週ボタン）と入力フォームが表示される
    await expect(page.getByRole("button", { name: /前の週/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /次の週/ })).toBeVisible();
  });

  test("@navigation シナリオN-7: SummaryPageに週次サマリーが表示される", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    // 「合計」または「支出合計」的なテキストが表示されることを確認
    await expect(page.getByText("合計").or(page.getByText("支出合計"))).toBeVisible();

    // WeekNavigator（前の週/次の週ボタン）が表示されることを確認
    await expect(page.getByRole("button", { name: /前の週/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /次の週/ })).toBeVisible();
  });

  test("@navigation シナリオN-8: SummaryPageに週移動導線がある", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    // SummaryPage には WeekNavigator（前/次の週ボタン）が表示される
    await expect(
      page
        .getByRole("button", { name: "前の週へ" })
        .or(page.getByRole("link", { name: "入力を再開" })),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("@smoke @navigation シナリオN-9: SPで入力フローを一通り完走できる", async ({ page }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationの「入力」タブをタップ（BottomNav内に限定）
    const bottomNavN9 = page.getByRole("navigation", { name: "ボトムナビゲーション" });
    await bottomNavN9.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");

    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();

    // BottomNavigationも引き続き表示されていることを確認
    await expect(page.getByRole("navigation", { name: "ボトムナビゲーション" })).toBeVisible();
  });

  test("@smoke @navigation シナリオN-10: 既存のURL構造が維持されている", async ({ page }) => {
    // 各URLに直接アクセスして404にならないことを確認
    // 最初だけ gotoAuthenticated で認証し、以降は page.goto でページ遷移する
    await gotoAuthenticated(page, "/");
    await expect(page.getByText("今週のダッシュボード")).toBeVisible();

    await page.goto("/weeks/current/input");
    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();

    const weekStartDate = getCurrentWeekStartDate();
    await page.goto(`/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
  });
});
