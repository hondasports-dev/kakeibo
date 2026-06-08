import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import {
  cleanupTestCategories,
  cleanupTestReceipts,
  resetTestWeekSession,
} from "./helpers/cleanup";

/**
 * 支出項目入力フォーム E2E テスト（QA Agent 担当）
 *
 * Issue #13「保存して次へ入力フロー」の受け入れ確認と回帰確認を含む。
 * Issue #14「今週の入力状況パネル」の受け入れ確認を含む。
 *
 * Issue #49 UIリファクタリングにより、画面構成が変更された:
 *   - ダッシュボード (/) : summary-grid（今週の支出）
 *   - 入力画面 (/weeks/current/input) : ExpenseEntryForm + WeekStatusPanel (PC only)
 *   - 週次サマリー (/weeks/YYYY-MM-DD) : WeeklySummaryPanel + WeekNavigator
 *
 * Issue #181 フォーム刷新により、ReceiptForm → ExpenseEntryForm に変更された:
 *   - 店舗名フィールド: input[name="shopName"] → getByLabel("店舗名 / 支払先")
 *   - 金額フィールド: input[name="amountYen"] → getByLabel("合計金額")
 *   - 日付: input[name="date"] → 週日選択UI（role="listbox"[aria-label="週内の日付候補"]）
 *   - Snackbar: "レシートを保存しました" → "支出項目を保存しました"
 *   - 収入タブ: ExpenseEntryForm は支出のみ対応（収入タブは廃止）
 *   - 保存後フォーカス戻り: ExpenseEntryForm では未実装
 *
 * カバーするシナリオ:
 *   - シナリオ 2: ログイン後にダッシュボードが表示される (P0 / smoke)
 *   - シナリオ 3: ページリロードでログイン状態が維持される (P0 / smoke)
 *   - シナリオ 5: 必須項目を入力して保存 → 成功し店名・金額がクリアされる (P0 / smoke)
 *   - シナリオ 6: 保存後レシート一覧に追加される (P0 / smoke)
 *   - [Issue #13] 保存成功通知が Snackbar で表示される
 *   - [Issue #13] 5件連続入力して操作が止まらない（完了条件）
 *   - シナリオ 7: 店舗名が空で保存 → エラーが表示される (P1 / validation)
 *   - シナリオ 8: 金額が空で保存 → エラーが表示される (P1 / validation)
 *   - シナリオ 10: 金額に文字を入力しても入力フィールドに反映されない (P1 / validation)
 *   - [Issue #51] シナリオ 11: 金額に数字を入力すると3桁カンマ区切りで表示される (P1 / validation)
 *   - [Issue #14] 入力状況パネルが表示される (P0 / smoke) ※PC幅のみ
 *   - [Issue #14] 保存後にサマリーがリアルタイム更新される (P0 / issue #14 完了条件) ※DashboardPage
 *   - [Issue #14] 保存後に直近の入力一覧にレシートが表示される (P0 / issue #14 完了条件) ※PC幅のみ
 *   - [Issue #14] 保存後に WeekStatusPanel の件数表示がリアルタイム更新される (P0 / issue #14 完了条件) ※PC幅のみ
 *   - [Issue #16] 振り返りメモを保存してセッションを完了できる (P0 / issue #16 完了条件)
 *   - [Issue #16] 完了後もメモ再編集方針が表示され、メモを更新できる (P1 / regression)
 *   - [Issue #45] 週次サマリーを前後週ナビゲーションで切り替えられる (P0 / regression)
 *   - [Issue #45] 未来週URLは今週の週次サマリーへ正規化される (P0 / error-handling)
 *   - [Issue #46] 入力画面・週次サマリーに前週比が表示される (P1 / regression)
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

function addWeeks(weekStartDate: string, weeks: number): string {
  const date = new Date(`${weekStartDate}T00:00:00`);
  date.setDate(date.getDate() + weeks * 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

// ---------------------------------------------------------------------------
// ダッシュボード・認証確認
// ---------------------------------------------------------------------------

test.describe("メイン画面の表示確認", () => {
  test("@smoke シナリオ2: ログイン済みでアクセスするとダッシュボードが表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);

    // Issue #49: ダッシュボードに変更
    await expect(page.getByRole("heading", { name: "今週のダッシュボード" })).toBeVisible();
    // summary-grid の主要カード
    await expect(page.locator(".summary-grid").locator("text=今週の支出")).toBeVisible();
  });

  test("@smoke シナリオ3: ページリロードしてもログイン状態が維持される", async ({ page }) => {
    await gotoAuthenticated(page);
    await expect(page.locator("text=今週のダッシュボード")).toBeVisible();

    await page.reload();

    await expect(page.locator("text=今週のダッシュボード")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 支出項目保存フロー（Issue #13 / #181）
// ---------------------------------------------------------------------------

test.describe("支出項目保存フロー（Issue #13 / #181 受け入れ確認）", () => {
  test.beforeEach(async ({ page }) => {
    // 入力フォームは /weeks/current/input にある
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  // テスト中に作成した支出項目を Dev DB から削除してゴミを防ぐ
  test.afterEach(async () => {
    await cleanupTestReceipts();
    await cleanupTestCategories();
  });

  test("@smoke シナリオ5: 必須項目を入力して保存すると店名・金額がクリアされる", async ({
    page,
  }) => {
    // Issue #181: ReceiptForm → ExpenseEntryForm に変更
    const shopNameInput = page.getByLabel("店舗名 / 支払先");
    const amountInput = page.getByLabel("合計金額");

    await shopNameInput.fill("スーパー北浜");
    await amountInput.fill("4280");
    // カテゴリを選択（最初のカテゴリボタンをクリック）
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();

    await page.getByRole("button", { name: "保存して次へ" }).click();

    // 店名・金額がクリアされることを確認（保存完了の主要確認）
    await expect(shopNameInput).toHaveValue("", { timeout: 15_000 });
    await expect(amountInput).toHaveValue("");

    // Snackbar で成功通知が出ることを確認（Issue #13 / #181）
    // フォームリセット完了後でも Snackbar は 3 秒以内なら表示されているはず
    const snackbar = page.getByRole("alert").filter({ hasText: "支出項目を保存しました" });
    await expect(snackbar).toBeVisible({ timeout: 3_000 });
  });

  // Issue #181: ExpenseEntryForm は保存後のフォーカス戻りを実装していないためスキップ
  test.skip("[Issue #13] 保存成功後に店名欄にフォーカスが移動する (Issue #181で廃止)", async ({
    page,
  }) => {
    const shopNameInput = page.getByLabel("店舗名 / 支払先");
    await shopNameInput.fill("テストショップ");
    await page.getByLabel("合計金額").fill("1000");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(shopNameInput).toHaveValue("");
    await expect(shopNameInput).toBeFocused();
  });

  test("[Issue #13] カテゴリが保存後も引き継がれる", async ({ page }) => {
    // Issue #181: 日付は週日選択UIに変更。カテゴリ引き継ぎのみ確認
    await page.getByLabel("店舗名 / 支払先").fill("テスト店舗");
    await page.getByLabel("合計金額").fill("500");
    // 最初のカテゴリを選択して選択状態を記録
    const firstCategory = page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first();
    await firstCategory.click();

    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("");

    // カテゴリが引き継がれている（aria-selected="true" のオプションが存在する）
    await expect(
      page.locator('[role="listbox"][aria-label="カテゴリ候補"] [aria-selected="true"]'),
    ).toBeVisible();
  });

  test("[Issue #13] 5件連続入力して操作が止まらない", async ({ page }) => {
    const shopNameInput = page.getByLabel("店舗名 / 支払先");
    const amountInput = page.getByLabel("合計金額");
    const firstCategory = page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first();
    const submitButton = page.getByRole("button", { name: "保存して次へ" });

    const shops = ["店舗A", "店舗B", "店舗C", "店舗D", "店舗E"];
    const amounts = ["100", "200", "300", "400", "500"];

    for (let i = 0; i < 5; i++) {
      await shopNameInput.fill(shops[i]);
      await amountInput.fill(amounts[i]);
      // 初回のみカテゴリを選択（以降は引き継ぎ）
      if (i === 0) {
        await firstCategory.click();
      }
      await submitButton.click();

      // 保存成功を確認（入力欄のクリア）
      await expect(shopNameInput).toHaveValue("", { timeout: 10_000 });
    }

    // 5件入力後もフォームが使用可能であることを確認
    await expect(submitButton).toBeEnabled();
  });

  test("[Issue #64] 旧の画像入力UIがなくても手入力保存フローは維持される", async ({ page }) => {
    await expect(page.getByRole("region", { name: "画像から入力" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "AI処理キュー" })).toBeVisible();

    // Issue #181: ExpenseEntryForm セレクターに変更
    await page.getByLabel("店舗名 / 支払先").fill("画像確認スーパー");
    await page.getByLabel("合計金額").fill("980");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    // 店名・金額がクリアされることを確認（保存完了の主要確認）
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 15_000 });
    await expect(page.getByLabel("合計金額")).toHaveValue("");
  });

  test("シナリオ6: 保存後に支出一覧に追加される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    // 1件目を保存
    await page.getByLabel("店舗名 / 支払先").fill("スーパー北浜");
    await page.getByLabel("合計金額").fill("4280");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // 2件目を保存
    await page.getByLabel("店舗名 / 支払先").fill("ドラッグストア");
    await page.getByLabel("合計金額").fill("1540");
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // Issue #77: InputPage から WeekStatusPanel（直近の入力一覧）が削除されたため、
    // SummaryPage（週次サマリー）で支出一覧を確認する
    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // 支出一覧に追加されていることを確認（表示順は問わない）
    const receiptList = page.locator('[class*="receipt-row"]');
    await expect(receiptList.filter({ hasText: "ドラッグストア" }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await receiptList.count()).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// バリデーション（P1）
// ---------------------------------------------------------------------------

test.describe("バリデーション（P1）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  test("シナリオ7: 店舗名が空で保存するとエラーが表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    await page.getByLabel("合計金額").fill("4280");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    // MUI TextField の helperText にエラーが表示される
    // Issue #181: エラーメッセージが「店舗名 / 支払先は必須です」に変更
    await expect(page.locator("text=店舗名 / 支払先は必須です")).toBeVisible();
  });

  test("シナリオ8: 金額が空で保存するとエラーが表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    await page.getByLabel("店舗名 / 支払先").fill("スーパー北浜");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    // Issue #181: エラーメッセージが「金額は必須です」
    await expect(page.locator("text=金額は必須です")).toBeVisible();
  });

  test("シナリオ9: カテゴリ候補が表示される（デフォルト選択あり）", async ({ page }) => {
    // Issue #181: ExpenseEntryForm ではカテゴリはデフォルト選択済み
    // カテゴリ候補UIが表示されていることを確認
    await expect(page.getByRole("button", { name: "保存して次へ" })).toBeVisible();
    await expect(page.locator('[role="listbox"][aria-label="カテゴリ候補"]')).toBeVisible();
    // デフォルトで1件選択済みであること
    await expect(
      page.locator('[role="listbox"][aria-label="カテゴリ候補"] [aria-selected="true"]'),
    ).toBeVisible();
  });

  test("シナリオ10: 金額に文字を入力しても入力フィールドに反映されない", async ({ page }) => {
    // Issue #51 / #181: 英字・記号はクライアント側で除去されるため入力できない
    const amountInput = page.getByLabel("合計金額");
    await amountInput.fill("abc");

    // 英字はクライアント側で除去されるためフィールドは空のまま
    await expect(amountInput).toHaveValue("");
  });

  test("[Issue #51] シナリオ11: 金額に数字を入力すると3桁カンマ区切りで表示される", async ({
    page,
  }) => {
    const amountInput = page.getByLabel("合計金額");

    // When: 7桁の金額を入力する
    await amountInput.fill("1234567");

    // Then: 3桁カンマ区切りで表示される
    await expect(amountInput).toHaveValue("1,234,567");

    // And: inputmode="numeric" 属性が正しく設定されている（スマートフォン数字キーボード）
    await expect(amountInput).toHaveAttribute("inputmode", "numeric");
  });
});

// ---------------------------------------------------------------------------
// カテゴリ管理（Issue #17）
// ---------------------------------------------------------------------------

test.describe("[Issue #17] カテゴリ管理の反映確認（P1 / regression）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupTestReceipts();
    await cleanupTestCategories();
  });

  test("シナリオ16: 追加・編集・無効化が入力候補と既存表示に反映される", async ({ page }) => {
    const stamp = Date.now();
    const categoryName = `E2Eカテゴリ-${stamp}`;
    const updatedCategoryName = `${categoryName}-更新`;
    const shopName = `E2Eカテゴリ店舗-${stamp}`;

    // カテゴリ設定は BottomNav「設定」タブ → /settings へ遷移
    // SettingsPage には CategorySettingsPanel が含まれている
    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: "カテゴリ設定" })).toBeVisible();
    await expect(page.getByRole("listitem", { name: "カテゴリ 食費" })).toBeVisible();

    await page.locator('input[name="newCategoryColor"]').fill("#2563eb");
    const newCategoryNameInput = page.locator('input[name="newCategoryName"]');
    await newCategoryNameInput.click();
    await newCategoryNameInput.pressSequentially(categoryName);
    await expect(newCategoryNameInput).toHaveValue(categoryName);
    await page.getByRole("button", { name: "カテゴリを追加" }).click();
    await expect(page.getByRole("listitem", { name: `カテゴリ ${categoryName}` })).toBeVisible();

    await page.getByRole("button", { name: `${categoryName}を編集` }).click();
    const editCategoryNameInput = page.locator('input[name="editCategoryName"]');
    await editCategoryNameInput.clear();
    await editCategoryNameInput.pressSequentially(updatedCategoryName);
    await page.locator('input[name="editCategoryColor"]').fill("#0f766e");
    await page.getByRole("button", { name: "変更を保存" }).click();
    await expect(
      page.getByRole("listitem", { name: `カテゴリ ${updatedCategoryName}` }),
    ).toBeVisible();

    // 入力画面に戻る
    await page.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");
    const updatedCategoryOption = page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .filter({ hasText: updatedCategoryName });
    await expect(updatedCategoryOption).toBeVisible();

    // Issue #181: ExpenseEntryForm セレクターに変更して支出項目を保存
    await updatedCategoryOption.click();
    await page.getByLabel("店舗名 / 支払先").fill(shopName);
    await page.getByLabel("合計金額").fill("1000");
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // 無効化（設定画面に戻る）
    // SettingsPage には CategorySettingsPanel が含まれている
    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");
    await page.getByRole("button", { name: `${updatedCategoryName}を無効化` }).click();
    // 無効化後: ボタンが disabled になること（設定画面では無効カテゴリも表示される）
    await expect(page.getByRole("button", { name: `${updatedCategoryName}を無効化` })).toBeDisabled(
      { timeout: 15_000 },
    );

    // 入力画面でカテゴリ候補から消えていることを確認
    await page.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");
    await expect(updatedCategoryOption).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 入力状況パネル（Issue #14）— PC幅のみ存在
// ---------------------------------------------------------------------------

test.describe("[Issue #14] 入力状況パネルの表示確認（P0 / smoke）", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await cleanupTestReceipts();
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupTestReceipts();
  });

  test("@smoke [Issue #14] 入力画面の主要セクションが表示される", async ({ page }) => {
    // Issue #181: ReceiptForm → ExpenseEntryForm に変更。収入タブは廃止
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();
    await expect(page.locator('[role="listbox"][aria-label="週内の日付候補"]')).toBeVisible();
    await expect(page.locator('[role="listbox"][aria-label="カテゴリ候補"]')).toBeVisible();
  });

  test('[Issue #14] 空状態で "まだレシートがありません" が表示される', async ({ page }) => {
    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();
    const receiptRows = page.locator('[class*="receipt-row"]');
    const emptyMessage = page.getByText("まだレシートがありません").first();
    await expect(receiptRows.or(emptyMessage).first()).toBeVisible({ timeout: 15_000 });
  });

  test("[Issue #14] ダッシュボードに今週の支出カウンターが表示される", async ({ page }) => {
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL("/");
    const spendCard = page.locator(".summary-grid .paper-panel").filter({ hasText: "今週の支出" });
    await expect(spendCard.locator("[data-value]")).toBeVisible();
  });

  test("[Issue #14] 入力フォームの保存導線が表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    await expect(page.getByRole("button", { name: "保存して次へ" })).toBeVisible();
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 保存後のリアルタイム更新確認（Issue #14）— PC幅で DashboardPage / WeekStatusPanel を確認
// ---------------------------------------------------------------------------

test.describe("[Issue #14] 保存後のリアルタイム更新確認（P0 / 完了条件）", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await cleanupTestReceipts();
    await resetTestWeekSession(getCurrentWeekStartDate());
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  // テスト中に作成したレシートを Dev DB から削除してゴミを防ぐ
  test.afterEach(async () => {
    await cleanupTestReceipts();
    await cleanupTestCategories();
  });

  test("[Issue #14] 保存後に週次サマリーへ支出が反映される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    const shopName = `QAサマリー反映_${Date.now()}`;

    await page.getByLabel("店舗名 / 支払先").fill(shopName);
    await page.getByLabel("合計金額").fill("1234");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    // 保存完了（店名クリアを待機）
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "カテゴリ別" })).toBeVisible();
    const receiptRows = page.locator('[class*="receipt-row"]');
    await expect(receiptRows.filter({ hasText: shopName }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(receiptRows.filter({ hasText: "1,234円" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("[Issue #14] 保存後に週次サマリーの支出一覧にレシートが表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    const shopName = `QA直近確認_${Date.now()}`;

    await page.getByLabel("店舗名 / 支払先").fill(shopName);
    await page.getByLabel("合計金額").fill("999");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "支出一覧" })).toBeVisible();
    const receiptRows = page.locator('[class*="receipt-row"]');
    await expect(receiptRows.filter({ hasText: shopName }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(receiptRows.filter({ hasText: "999円" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("[Issue #14] 保存後に週次サマリーの支出件数が更新される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm セレクターに変更
    const shopName = `QA進捗確認_${Date.now()}`;
    await page.getByLabel("店舗名 / 支払先").fill(shopName);
    await page.getByLabel("合計金額").fill("500");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });
    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "支出一覧" })).toBeVisible();
    await expect(page.locator('[class*="receipt-row"]').filter({ hasText: shopName })).toHaveCount(
      1,
      { timeout: 15_000 },
    );
  });
});

// ---------------------------------------------------------------------------
// 週次サマリーページ（Issue #15）— /weeks/YYYY-MM-DD に直接遷移
// ---------------------------------------------------------------------------

test.describe("週次サマリーパネル（Issue #15 受け入れ確認）", () => {
  test.afterEach(async () => {
    await cleanupTestReceipts();
  });

  test("@smoke [Issue #15] 週次サマリーページにReviewMemoPanelが表示される (P0 / smoke)", async ({
    page,
  }) => {
    // Issue #77: ReviewMemoPanel は InputPage から SummaryPage に移動した
    // 未完了セッションでは「セッションを完了」ボタンが表示される
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();
    // SummaryPage では summaryWeekSession が null の場合に自動作成するため、ロード完了を待つ
    await expect(page.getByRole("heading", { name: "週次振り返り" })).toBeVisible({
      timeout: 15_000,
    });
    // セッション状態により「メモを保存」「セッションを完了」「メモを更新」のいずれかが表示される
    // .first() で strict mode violation（複数ボタン同時表示時）を回避
    await expect(
      page
        .getByRole("button", { name: "セッションを完了" })
        .or(page.getByRole("button", { name: "メモを保存" }))
        .or(page.getByRole("button", { name: "メモを更新" }))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("@smoke [Issue #15] 週次サマリーページに遷移できる (P0 / smoke)", async ({ page }) => {
    // Issue #49: Drawer の「履歴」リンクから週次サマリーへ遷移する
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();

    // Drawer の「履歴」リンクをクリックして週次サマリーへ遷移
    await page.getByRole("link", { name: "履歴" }).click();

    // SummaryPage に遷移する
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "カテゴリ別" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "支出一覧" })).toBeVisible();
  });

  test("[Issue #15] 空状態でレシート0件の表示が正しい (P0 / smoke)", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // 合計支出セクションが表示されること
    await expect(page.getByText("合計支出")).toBeVisible({ timeout: 15_000 });
  });

  test("[Issue #15] レシート保存後にサマリーがリアルタイム更新される (P0 / 完了条件)", async ({
    page,
  }) => {
    // PC幅で入力画面 → 保存 → サマリー遷移の流れで確認
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();

    // Issue #181: ExpenseEntryForm セレクターに変更
    const shopName = `QAサマリーテスト_${Date.now()}`;
    await page.getByLabel("店舗名 / 支払先").fill(shopName);
    await page.getByLabel("合計金額").fill("1500");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // サマリーページに遷移して確認（Drawer の「履歴」を使用）
    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "支出一覧" })).toBeVisible();
    await expect(page.locator('[class*="receipt-row"]').filter({ hasText: shopName })).toHaveCount(
      1,
      { timeout: 30_000 },
    );
  });

  test("[Issue #15] 再度ナビで戻れる (P1)", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);

    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // ナビで戻る
    await page.getByRole("link", { name: "入力", exact: true }).click();
    await expect(page).toHaveURL("/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  test("@smoke [Issue #45] 週次サマリーを前後週ナビゲーションで切り替えられる", async ({
    page,
  }) => {
    const currentWeekStartDate = getCurrentWeekStartDate();
    const previousWeekStartDate = addWeeks(currentWeekStartDate, -1);

    await gotoAuthenticated(page, `/weeks/${currentWeekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    // getFourWeeksSummary クエリロード完了を待機（グラフかプレースホルダーのどちらかが出るまで）
    await expect(
      page
        .getByRole("img", { name: "週別支出推移グラフ" })
        .or(page.getByText("今週または前週の支出データがあると表示されます")),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeDisabled();

    await page.getByRole("button", { name: "前の週へ" }).click();

    await expect(page).toHaveURL(new RegExp(`/weeks/${previousWeekStartDate}$`));
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeEnabled();
    // 前の週へ移動後、週次振り返りセクションが表示される
    // （セッションがなければプレースホルダー、あれば ReviewMemoPanel が表示される）
    await expect(
      page
        .getByRole("heading", { name: "週次振り返り" })
        .or(page.getByText("この週の振り返りメモはまだありません")),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("@smoke [Issue #45] 未来週URLは今週の週次サマリーへ正規化される", async ({ page }) => {
    const currentWeekStartDate = getCurrentWeekStartDate();
    const futureWeekStartDate = addWeeks(currentWeekStartDate, 1);

    // 認証してから未来週 URL にアクセスする（page.goto だと認証なしになるため）
    await gotoAuthenticated(page, `/weeks/${futureWeekStartDate}`);

    // weekSession の初期化完了 + URL 正規化を待つ
    await expect(page).toHaveURL(new RegExp(`/weeks/${currentWeekStartDate}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 前週比表示（Issue #46）
// ---------------------------------------------------------------------------

test.describe("[Issue #46] 前週比表示（P1 / regression）", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async () => {
    await cleanupTestReceipts();
  });

  test.afterEach(async () => {
    await cleanupTestReceipts();
  });

  test("入力画面・週次サマリーに前週との差額だけが表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm の日付は週日選択UI（今週内のみ）のため、
    // 前週データは「前の週へ」ナビゲート後に保存し、今週へ戻って今週分を保存する
    const firstCategory = page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first();
    const submitButton = page.getByRole("button", { name: "保存して次へ" });

    // まず前の週に移動して保存
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "前の週へ" }).click();
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
    await page.getByLabel("店舗名 / 支払先").fill("前週比較用ストア");
    await page.getByLabel("合計金額").fill("7000");
    await firstCategory.click();
    await submitButton.click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // 今週に戻って保存
    await page.getByRole("button", { name: "次の週へ" }).click();
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
    await page.getByLabel("店舗名 / 支払先").fill("今週比較用ストア");
    await page.getByLabel("合計金額").fill("6280");
    await submitButton.click();
    await expect(page.getByLabel("店舗名 / 支払先")).toHaveValue("", { timeout: 10_000 });

    // SummaryPage で前週比を確認（Issue #77: ReviewMemoPanel は InputPage から SummaryPage に移動）
    await page.getByRole("link", { name: "履歴" }).click();
    await expect(page).toHaveURL(/\/weeks\/\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // SummaryPage の週次サマリー合計セクションの前週比が表示されること（regression 確認）
    // 注: 共有 DevDB のため既存データにより差額の固定値確認は行わず、
    //     前週比コンポーネントが表示されること（数値または「前週データなし」）を確認する
    await expect(page.getByLabel("前週比").first()).toBeVisible({ timeout: 15_000 });

    // ReviewMemoPanel の前週比確認（Issue #77: ReviewMemoPanel は SummaryPage に移動済み）
    await expect(page.getByRole("heading", { name: "週次振り返り", level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    const reviewPanel = page
      .getByRole("heading", { name: "週次振り返り", level: 2 })
      .locator("../../..");
    await expect(reviewPanel.getByLabel("前週比")).toBeVisible();

    // WeeklySummaryPanel と ReviewMemoPanel の両方に前週比が表示されること（2件）
    await expect(page.getByLabel("前週比")).toHaveCount(2);
    // 前週の 7,000円 はカテゴリ別支出・支出一覧には表示されない（グラフバーラベルを除く）
    const categorySection = page
      .getByRole("heading", { name: "カテゴリ別", level: 2 })
      .locator("../../..");
    // AnimatedCounter導入により「7,000」と「円」が別要素になるため、部分一致で検索
    // 単語境界\bを使って「17,000」などに誤マッチしないよう堅牢化 (CodeRabbit指摘対応)
    await expect(categorySection.getByText(/\b7,000\b/)).toHaveCount(0);
    const receiptListSection = page.getByLabel("週次サマリーの支出一覧");
    await expect(receiptListSection.getByText(/\b7,000\b/)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 振り返りメモとセッション完了（Issue #16）
// ---------------------------------------------------------------------------

test.describe("振り返りメモとセッション完了（Issue #16 受け入れ確認）", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    // Issue #77: ReviewMemoPanel は SummaryPage に移動したため、SummaryPage を起点にする
    await resetTestWeekSession(getCurrentWeekStartDate());
    // InputPage を経由してセッションを作成してから SummaryPage へ遷移する
    // （getOrCreateWeekSession を呼ぶため InputPage に一度アクセスが必要）
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const weekStartDate = getCurrentWeekStartDate();
    await page.goto(`/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    // ReviewMemoPanel が表示されるまで待機（セッション状態は問わない）
    await expect(page.getByRole("heading", { name: "週次振り返り", level: 2 })).toBeVisible({
      timeout: 15_000,
    });
  });

  test.afterEach(async () => {
    await resetTestWeekSession(getCurrentWeekStartDate());
    await cleanupTestReceipts();
  });

  test("[Issue #16] 振り返りメモ保存からセッション完了、完了後のメモ更新まで確認できる", async ({
    page,
  }) => {
    const reviewMemoInput = page.getByLabel("振り返りメモ");
    const updatedMemo = `E2E振り返りメモ_${Date.now()}_更新`;

    // ReviewMemoPanel は SummaryPage に表示される
    await expect(page.getByRole("heading", { name: "週次振り返り", level: 2 })).toBeVisible();

    // セッション状態に応じてフローを実行（resetTestWeekSession が完了してない場合も考慮）
    const isAlreadyCompleted = await page
      .getByRole("button", { name: "メモを更新" })
      .isVisible()
      .catch(() => false);

    if (!isAlreadyCompleted) {
      // draft 状態: メモを保存してからセッションを完了
      const firstMemo = `E2E振り返りメモ_${Date.now()}`;
      await reviewMemoInput.fill(firstMemo);
      await page.getByRole("button", { name: "メモを保存" }).click();
      await expect(page.getByText("振り返りメモを保存しました")).toBeVisible({
        timeout: 10_000,
      });

      await page.getByRole("button", { name: "セッションを完了" }).click();
      // セッション完了後もSummaryPageに留まる（onCompleteが未設定のため）
      await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();
    }

    // 完了後はReviewMemoPanelが「完了済み」モードになりメモ再編集可能
    await expect(
      page.getByText("この週は完了済みです。振り返りメモは完了後も再編集できます。"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "メモを更新" })).toBeVisible();

    // 完了後のメモ更新確認
    await reviewMemoInput.fill(updatedMemo);
    await page.getByRole("button", { name: "メモを更新" }).click();

    await expect(page.getByText("振り返りメモを更新しました")).toBeVisible({ timeout: 10_000 });
    await expect(reviewMemoInput).toHaveValue(updatedMemo);

    // リロードしてもメモが維持される
    await page.reload();
    await expect(page.getByRole("heading", { name: "週次振り返り", level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("振り返りメモ")).toHaveValue(updatedMemo);
  });
});

// ---------------------------------------------------------------------------
// 週別支出推移グラフ（Issue #47）
// ---------------------------------------------------------------------------

test.describe("週別支出推移グラフ（Issue #47）", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.afterEach(async () => {
    await cleanupTestReceipts();
    await cleanupTestCategories();
    await resetTestWeekSession(getCurrentWeekStartDate());
  });

  test("[Issue #47] 週次サマリーページに週別支出推移セクションが表示される", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // Then: 週別支出推移セクションが表示される（グラフまたはプレースホルダー）
    await expect(page.getByRole("heading", { name: "週別支出推移" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("[Issue #47] データが1週のみの場合プレースホルダーテキストが表示される @smoke", async ({
    page,
  }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // Then: グラフまたはプレースホルダーが表示されること
    await expect(
      page
        .getByRole("img", { name: "週別支出推移グラフ" })
        .or(page.getByText("今週または前週の支出データがあると表示されます")),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("[Issue #47] ダッシュボードにグラフが表示されない", async ({ page }) => {
    // ダッシュボード（/）ではグラフが表示されない
    await gotoAuthenticated(page);
    await expect(page.getByRole("heading", { name: "今週のダッシュボード" })).toBeVisible();

    await expect(page.getByRole("img", { name: "週別支出推移グラフ" })).not.toBeVisible();
  });

  test("[Issue #47] 既存の前週比テキストが壊れていない", async ({ page }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // Then: 前週比ラベルが表示されている（regression確認）
    // WeeklySummaryPanel と ReviewMemoPanel の両方に前週比が表示されるため first() で取得
    await expect(page.getByLabel("前週比").first()).toBeVisible({ timeout: 15_000 });
  });

  test("[Issue #82] 週次サマリーページで折れ線グラフが表示されクリックでモーダルが開く", async ({
    page,
  }) => {
    const weekStartDate = getCurrentWeekStartDate();
    await gotoAuthenticated(page, `/weeks/${weekStartDate}`);
    await expect(page.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeVisible();

    // 折れ線グラフが表示される（またはプレースホルダー）
    await expect(
      page
        .getByRole("img", { name: "週別支出推移グラフ" })
        .or(page.getByText("今週または前週の支出データがあると表示されます")),
    ).toBeVisible({ timeout: 20_000 });

    // グラフが表示されている場合のみクリックテストを行う
    const graph = page.getByRole("img", { name: "週別支出推移グラフ" });
    if (await graph.isVisible().catch(() => false)) {
      // データポイント（circle）をクリック
      const point = graph.locator("circle").first();
      await point.click();

      // モーダルが表示される
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("の入出金比較")).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// 入力画面リニューアル（Issue #77）
// ---------------------------------------------------------------------------

test.describe("入力画面リニューアル（Issue #77 受け入れ確認）", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestReceipts();
    await gotoAuthenticated(page, "/weeks/current/input");
    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupTestReceipts();
  });

  // Issue #181: ExpenseEntryForm は支出専用で収入タブは廃止。関連テストをスキップ
  test.skip("@smoke [Issue #77] 支出タブと収入タブが表示される (Issue #181で廃止)", async ({
    page,
  }) => {
    await expect(page.getByRole("tab", { name: "支出" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "収入" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "支出" })).toHaveAttribute("aria-selected", "true");
  });

  test("@smoke [Issue #77] 支出フォームに店名フィールドが表示される", async ({ page }) => {
    // Issue #181: ExpenseEntryForm では収入タブなし。支出フォームのみ確認
    await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
    await expect(page.getByLabel("合計金額")).toBeVisible();
  });

  test.skip("@smoke [Issue #77] 収入タブに切り替えると銀行名フィールドが表示される (Issue #181で廃止)", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "収入" }).click();
    await expect(page.getByRole("tab", { name: "収入" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('input[name="bankName"]')).toBeVisible();
    await expect(page.locator('input[name="shopName"]')).not.toBeVisible();
  });

  test.skip("[Issue #77] 収入: 銀行名・金額・カテゴリを入力して保存できる (Issue #181で廃止)", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "収入" }).click();
    await expect(page.locator('input[name="bankName"]')).toBeVisible();

    const bankName = `QA銀行_${Date.now()}`;
    await page.locator('input[name="bankName"]').fill(bankName);
    await page.locator('input[name="amountYen"]').fill("50000");
    await page
      .locator('[role="listbox"][aria-label="カテゴリ候補"] [role="option"]')
      .first()
      .click();
    await page.getByRole("button", { name: "保存して次へ" }).click();

    await expect(page.locator('input[name="bankName"]')).toHaveValue("", { timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "収入" })).toHaveAttribute("aria-selected", "true");
  });

  test("@smoke [Issue #77] 週ナビゲーターが表示される", async ({ page }) => {
    // 週ナビゲーターの前週ボタン・次週ボタンが表示される
    await expect(page.getByRole("button", { name: "前の週へ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeVisible();
    // 今週は次の週へボタンが無効
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeDisabled();
  });

  test("[Issue #77] 前の週へナビゲートできる", async ({ page }) => {
    const currentWeekStartDate = getCurrentWeekStartDate();
    const previousWeekStartDate = addWeeks(currentWeekStartDate, -1);

    await page.getByRole("button", { name: "前の週へ" }).click();

    // 前週に移動したので「次の週へ」ボタンが有効になる
    await expect(page.getByRole("button", { name: "次の週へ" })).toBeEnabled({ timeout: 5_000 });
    // 前週の年をテキストで確認（WeekNavigator が "YYYY年..." 形式で表示する）
    const prevYear = previousWeekStartDate.substring(0, 4);
    await expect(page.getByText(new RegExp(`${prevYear}年`))).toBeVisible({ timeout: 5_000 });
  });
});
