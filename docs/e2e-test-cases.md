# E2E テストケース（Playwright）

## 概要

- **対象**: Issue #12「週次入力フォームを実データ保存に接続」完了後の機能
- **実装予定**: Issue #19（Playwright smoke E2E導入）
- **前提**: Issue #18（テスト基盤・CI整理）完了後
- **優先度**: P0（smoke）から P2（edge-case）まで段階的に実装

## Issue Delivery での作成基準

`$issue-delivery` では、Tech Lead の仕様確定後・Implementer の実装前に QA Agent が
E2Eテスト設計レビューを行う。

- Product Lead の完了条件と Tech Lead のテスト方針を照合する。
- 既存シナリオでカバーできる場合は、新規E2Eを増やさず既存シナリオ番号を参照する。
- 新規シナリオが必要な場合は、優先度（P0/P1/P2）、カテゴリ、Given / When / Then、テストデータ・cleanup要否を決める。
- E2Eは、ユーザー価値に直結する主要導線、認証・権限、データ保存、重大な回帰リスクを優先する。
- 細かいバリデーション分岐や境界値の大半は、単体テストまたは統合テストで確認する。
- 新規E2Eシナリオを追加したPRでは、このドキュメントも同時に更新する。
- QA Agent に Secret値を渡さない。必要な場合は GitHub Actions Secrets に設定済みであることだけを前提条件にする。

## テスト環境

### ブラウザ・実行環境

- **ブラウザ**: Chromium（初期段階は smoke test のみ）
- **実行環境**: GitHub Actions（ubuntu-latest）、ローカル開発環境
- **URL**:
  - ローカル: `http://localhost:5173`
  - Vercel Preview: `https://<branch>-<project>.vercel.app`（GitHub Actions で実行）

### 認証方式

**重要**: Playwright E2E では、Clerk Development instance のメール/パスワード認証ユーザーを使用します。Google OAuth は自動化不可のため、E2E テストでは使いません。

#### セットアップ手順

`.env.local` に以下を設定（テストユーザー認証情報はローカル専用、ログ出力禁止）:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY はサーバーサイド用（Webhook 等）。フロントエンドのみの E2E テストでは不要。
# Playwright + @clerk/testing の setupClerkTestingToken はパブリッシャブルキーのみ使用する。
E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
E2E_CLERK_USER_PASSWORD=<secure-password>
VITE_CONVEX_URL=https://...
```

テストユーザー作成コマンド:

```bash
pnpm exec clerk users create \
  --instance dev \
  --email "codex+clerk_test@example.com" \
  --password "<secure-password>" \
  --first-name Codex \
  --last-name Test \
  --yes
```

参考: `docs/development-process.md` の「Codex 開発時の Clerk 認証」セクション

### Playwright 設定方針

- **storageState**: `@clerk/testing` で Clerk 認証を事前実行し、`playwright/.clerk/user.json` に保存
- **タイムアウト**: 30秒（API 遅延対応）
- **リトライ**: 最大 2 回（flaky テスト対応）
- **スクリーンショット・trace**: 失敗時のみ保存（1〜3 日の短期保存）

## テストシナリオ一覧

### シナリオ 1: 未ログイン状態でアクセス → ログイン画面が表示される

- **優先度**: P0
- **カテゴリ**: smoke
- **前提条件**:
  - ブラウザキャッシュ・Cookie なし（新規セッション）
  - Clerk 認証トークンなし
- **手順**:
  1. `http://localhost:5173` にアクセス
  2. ページが読み込まれるまで待機
- **期待結果**:
  - ログイン画面が表示される
  - 「Googleでログイン」ボタンが表示される
  - ヘッダーに「家計簿にログイン」の見出しが表示される
  - Alert に「Clerkの開発用テストユーザーではGoogle OAuthにログインできません」というメッセージが表示される
- **対応するコード**: `src/App.tsx` の `SignedOutScreen` コンポーネント

#### Playwright 参考実装

```typescript
test('未ログイン状態でアクセス → ログイン画面が表示される', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('http://localhost:5173')
  await page.waitForSelector('text=家計簿にログイン')

  const loginButton = page.locator('button:has-text("Googleでログイン")')
  await expect(loginButton).toBeVisible()

  const alertText = page.locator('[role="alert"]')
  await expect(alertText).toContainText('Clerkの開発用テストユーザーではGoogle OAuthにログインできません')
})
```

---

### シナリオ 2: メール/パスワード認証でログイン → メイン画面にリダイレクトされる

- **優先度**: P0
- **カテゴリ**: smoke
- **前提条件**:
  - Clerk Development instance にテストユーザーが作成済み
  - `.env.local` に `E2E_CLERK_USER_EMAIL`、`E2E_CLERK_USER_PASSWORD` が設定済み
- **手順**:
  1. ログイン画面から「Googleでログイン」ボタンをクリック
  2. Clerk の認証画面にリダイレクト
  3. メール/パスワード認証タブを選択
  4. テストユーザーのメールアドレスを入力
  5. パスワードを入力
  6. 「ログイン」ボタンをクリック
  7. SSO callback 画面（CircularProgress）が表示される
  8. メイン画面にリダイレクト
- **期待結果**:
  - URL が `http://localhost:5173/` に戻る
  - 「今週のレシート入力」という見出しが表示される
  - ヘッダーにユーザーメニュー（アバター + 名前）が表示される
  - サマリーカード（入力済み件数、今週の支出、予算残り）が表示される
  - レシート追加フォームが表示される
- **対応するコード**: `src/App.tsx` の `AuthenticatedApp`、`KakeiboApp` コンポーネント

#### Playwright 参考実装

```typescript
test('メール/パスワード認証でログイン → メイン画面にリダイレクトされる', async ({ page }) => {
  await page.goto('http://localhost:5173')

  const googleLoginButton = page.locator('button:has-text("Googleでログイン")')
  await googleLoginButton.click()

  await page.waitForURL(/clerk\.accounts\.dev/)

  const emailTab = page.locator('button:has-text("メールアドレス")')
  if (await emailTab.isVisible()) {
    await emailTab.click()
  }

  await page.locator('input[type="email"]').fill(process.env.E2E_CLERK_USER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.E2E_CLERK_USER_PASSWORD!)
  await page.locator('button[type="submit"]').click()

  await page.waitForURL('http://localhost:5173/')

  await expect(page.locator('text=今週のレシート入力')).toBeVisible()
  await expect(page.locator('[class*="user-menu-button"]')).toBeVisible()
})
```

---

### シナリオ 3: ログイン状態でページリロード → ログイン状態が維持される

- **優先度**: P0
- **カテゴリ**: smoke
- **前提条件**:
  - ログイン済みの状態
  - Clerk storageState が保存済み
- **手順**:
  1. メイン画面でページをリロード（`page.reload()`）
  2. ページが再読み込みされる
- **期待結果**:
  - ログイン状態が維持される
  - ログイン画面に戻らない
  - メイン画面が表示される
- **対応するコード**: `src/App.tsx` の `AuthenticatedApp` コンポーネント、Clerk SDK

#### Playwright 参考実装

```typescript
test('ログイン状態でページリロード → ログイン状態が維持される', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.locator('text=今週のレシート入力')).toBeVisible()

  await page.reload()

  await expect(page.locator('text=今週のレシート入力')).toBeVisible()
  await expect(page.locator('[class*="user-menu-button"]')).toBeVisible()
})
```

---

### シナリオ 4: ログアウト → ログイン画面に戻る

- **優先度**: P1
- **カテゴリ**: smoke
- **前提条件**:
  - ログイン済みの状態
- **手順**:
  1. ユーザーメニューをクリック
  2. 「ログアウト」をクリック
- **期待結果**:
  - ログイン画面が表示される
  - 「Googleでログイン」ボタンが表示される
- **対応するコード**: `src/App.tsx` の `UserMenu` コンポーネント

#### Playwright 参考実装

```typescript
test('ログアウト → ログイン画面に戻る', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.locator('text=今週のレシート入力')).toBeVisible()

  await page.locator('[class*="user-menu-button"]').click()
  await page.waitForSelector('[role="menu"]')
  await page.locator('[role="menuitem"]:has-text("ログアウト")').click()

  await page.waitForURL('http://localhost:5173/')
  await expect(page.locator('text=家計簿にログイン')).toBeVisible()
  await expect(page.locator('button:has-text("Googleでログイン")')).toBeVisible()
})
```

---

### シナリオ 5: 必須項目を全て入力して保存 → 成功し、フォームがリセットされる

- **優先度**: P0
- **カテゴリ**: smoke（最重要）
- **前提条件**:
  - ログイン済みの状態
  - Convex backend が正常に動作している
- **手順**:
  1. 日付を選択（週内の日付）
  2. 店舗名を入力（例: スーパー北浜）
  3. 金額を入力（例: 4280）
  4. カテゴリを選択（例: 食費）
  5. 「保存して次へ」ボタンをクリック
- **期待結果**:
  - 保存が成功する（エラーアラートが表示されない）
  - 店舗名・金額・メモがクリアされる
  - 日付・カテゴリが前回値を引き継ぐ
- **対応するコード**: `src/components/ReceiptForm.tsx`、Convex `createReceipt` mutation

#### Playwright 参考実装

```typescript
test('必須項目を全て入力して保存 → 成功し、フォームがリセットされる', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.locator('text=今週のレシート入力')).toBeVisible()

  await page.locator('input[name="date"]').fill('2026-05-12')
  await page.locator('input[name="shopName"]').fill('スーパー北浜')
  await page.locator('input[name="amountYen"]').fill('4280')
  await page.locator('[role="listitem"]:has-text("食費")').click()

  await page.locator('button:has-text("保存して次へ")').click()

  // 保存完了を待機
  await page.waitForTimeout(1500)

  // フォームリセット確認
  await expect(page.locator('input[name="shopName"]')).toHaveValue('')
  await expect(page.locator('input[name="amountYen"]')).toHaveValue('')

  // 日付・カテゴリが引き継がれていることを確認
  await expect(page.locator('input[name="date"]')).toHaveValue('2026-05-12')
})
```

---

### シナリオ 6: 保存後にレシート一覧に追加される

- **優先度**: P0
- **カテゴリ**: smoke
- **前提条件**:
  - ログイン済みの状態
  - シナリオ 5 が完了（最初のレシートが保存済み）
- **手順**:
  1. 別のレシートを入力して保存
  2. レシート一覧を確認
- **期待結果**:
  - 新しいレシートがレシート一覧の最上部に表示される
  - 複数のレシートが表示される
- **対応するコード**: `src/App.tsx`、Convex `getReceiptsByWeek` query

#### Playwright 参考実装

```typescript
test('保存後にレシート一覧に追加される', async ({ page }) => {
  await page.locator('input[name="shopName"]').fill('ドラッグストア')
  await page.locator('input[name="amountYen"]').fill('1540')
  await page.locator('[role="listitem"]:has-text("日用品")').click()
  await page.locator('button:has-text("保存して次へ")').click()

  await page.waitForTimeout(1500)

  const receiptList = page.locator('[class*="receipt-row"]')
  await expect(receiptList.first()).toContainText('ドラッグストア')
  expect(await receiptList.count()).toBeGreaterThanOrEqual(2)
})
```

---

### シナリオ 7: 店舗名が空で保存試みる → エラーメッセージが表示される

- **優先度**: P1
- **カテゴリ**: validation
- **手順**:
  1. 店舗名を空のまま他フィールドを入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - 店舗名フィールドにエラーメッセージが表示される
- **対応するコード**: `src/validation/receipt.ts`

#### Playwright 参考実装

```typescript
test('店舗名が空で保存試みる → エラーメッセージが表示される', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('input[name="amountYen"]').fill('4280')
  await page.locator('[role="listitem"]:has-text("食費")').click()
  await page.locator('button:has-text("保存して次へ")').click()

  // MUI TextField の helperText エリアにエラーが表示される
  const shopNameField = page.locator('input[name="shopName"]').locator('../..')
  await expect(shopNameField.locator('p')).toBeVisible()
})
```

---

### シナリオ 8: 金額が空で保存試みる → エラーメッセージが表示される

- **優先度**: P1
- **カテゴリ**: validation
- **手順**:
  1. 金額を空のまま他フィールドを入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - 金額フィールドにエラーメッセージが表示される

#### Playwright 参考実装

```typescript
test('金額が空で保存試みる → エラーメッセージが表示される', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('input[name="shopName"]').fill('スーパー北浜')
  await page.locator('[role="listitem"]:has-text("食費")').click()
  await page.locator('button:has-text("保存して次へ")').click()

  const amountField = page.locator('input[name="amountYen"]').locator('../..')
  await expect(amountField.locator('p')).toBeVisible()
})
```

---

### シナリオ 9: カテゴリ未選択で保存試みる → エラーメッセージが表示される

- **優先度**: P1
- **カテゴリ**: validation
- **手順**:
  1. カテゴリを選択しないまま他フィールドを入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - カテゴリセクションにエラーメッセージが表示される

#### Playwright 参考実装

```typescript
test('カテゴリ未選択で保存試みる → エラーメッセージが表示される', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('input[name="shopName"]').fill('スーパー北浜')
  await page.locator('input[name="amountYen"]').fill('4280')
  // カテゴリを選択しない
  await page.locator('button:has-text("保存して次へ")').click()

  await expect(page.locator('text=カテゴリは必須です')).toBeVisible()
})
```

---

### シナリオ 10: 金額に文字を入力して保存試みる → エラーメッセージが表示される

- **優先度**: P1
- **カテゴリ**: validation
- **手順**:
  1. 金額に "abc" を入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - 金額フィールドにエラーメッセージが表示される

#### Playwright 参考実装

```typescript
test('金額に文字を入力して保存試みる → エラーメッセージが表示される', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('input[name="shopName"]').fill('スーパー北浜')
  await page.locator('input[name="amountYen"]').fill('abc')
  await page.locator('[role="listitem"]:has-text("食費")').click()
  await page.locator('button:has-text("保存して次へ")').click()

  const amountField = page.locator('input[name="amountYen"]').locator('../..')
  await expect(amountField.locator('p')).toBeVisible()
})
```

---

### シナリオ 11: 金額が 0 で保存試みる → エラーメッセージが表示される

- **優先度**: P2
- **カテゴリ**: validation（境界値）
- **手順**:
  1. 金額に "0" を入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - 金額フィールドにエラーメッセージが表示される（「金額は 1 円以上です」）

---

### シナリオ 12: 金額が 9,999,999 を超えて保存試みる → エラーメッセージが表示される

- **優先度**: P2
- **カテゴリ**: validation（境界値）
- **手順**:
  1. 金額に "10000000" を入力して保存ボタンをクリック
- **期待結果**:
  - 保存が実行されない
  - 金額フィールドにエラーメッセージが表示される（「金額は 9,999,999 円以下です」）

---

### シナリオ 13: 別ユーザーのレシートが見えないこと（UI レベルの確認）

- **優先度**: P1
- **カテゴリ**: regression（ユーザー分離）
- **前提条件**:
  - テストユーザー A・B の Clerk 認証情報が用意されている
- **手順**:
  1. テストユーザー A でログインしてレシートを保存
  2. ログアウト
  3. テストユーザー B でログイン
  4. レシート一覧を確認
- **期待結果**:
  - テストユーザー B にはテストユーザー A のレシートが表示されない
- **対応するコード**: `convex/receipts.ts` の `getReceiptsByWeek`（userId フィルタリング）

---

### シナリオ 14: ネットワークエラー時にエラーアラートが表示される

- **優先度**: P2
- **カテゴリ**: error-handling
- **手順**:
  1. ブラウザを Offline に設定して保存ボタンをクリック
- **期待結果**:
  - エラーアラートが表示される
  - フォームの入力内容が保持される（クリアされない）

#### Playwright 参考実装

```typescript
test('ネットワークエラー時にエラーアラートが表示される', async ({ page, context }) => {
  await page.goto('http://localhost:5173')
  await page.locator('input[name="shopName"]').fill('スーパー北浜')
  await page.locator('input[name="amountYen"]').fill('4280')
  await page.locator('[role="listitem"]:has-text("食費")').click()

  await context.setOffline(true)
  await page.locator('button:has-text("保存して次へ")').click()
  await page.waitForTimeout(3000)

  await expect(page.locator('[role="alert"]').filter({ hasText: /失敗|エラー/ })).toBeVisible()

  // フォームの内容が保持されている
  await expect(page.locator('input[name="shopName"]')).toHaveValue('スーパー北浜')

  await context.setOffline(false)
})
```

---

### シナリオ 15: 振り返りメモ保存 → セッション完了 → 完了後もメモ更新方針が明確

- **優先度**: P1
- **カテゴリ**: regression（Issue #16 完了条件）
- **前提条件**:
  - ログイン済みの状態
  - 週次セッションが表示されている
  - E2E cleanup で対象週のセッションを `draft` に戻してから開始する
- **手順**:
  1. 「週次振り返り」セクションを確認
  2. 振り返りメモを入力
  3. 「メモを保存」をクリック
  4. 「セッションを完了」をクリック
  5. 完了後に振り返りメモを再編集し、「メモを更新」をクリック
  6. ページをリロードする
- **期待結果**:
  - 振り返りメモを入力できる
  - メモ保存の成功メッセージが表示される
  - セッション完了の成功メッセージが表示される
  - ヘッダーに「完了済み」状態が表示される
  - 完了済み状態では「振り返りメモは完了後も再編集できます」という方針が表示される
  - 完了後は「メモを更新」ボタンで振り返りメモを再編集できる
  - リロード後も更新後のメモと「完了済み」状態が再表示される
- **対応するコード**: `src/components/ReviewMemoPanel.tsx`、Convex `updateReviewMemo` / `completeWeekSession` mutation

#### Playwright 参考実装

```typescript
test('[Issue #16] 振り返りメモ保存からセッション完了、完了後のメモ更新方針まで確認できる', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.getByRole('heading', { name: '週次振り返り', level: 2 })).toBeVisible()

  const reviewMemoInput = page.getByLabel('振り返りメモ')
  await reviewMemoInput.fill('食費が多かったので来週は作り置きを増やす')
  await page.getByRole('button', { name: 'メモを保存' }).click()
  await expect(page.getByText('振り返りメモを保存しました')).toBeVisible()

  await page.getByRole('button', { name: 'セッションを完了' }).click()
  await expect(page.getByText('今週の入力を完了しました')).toBeVisible()
  await expect(page.getByText('完了済み')).toBeVisible()
  await expect(page.getByText('振り返りメモは完了後も再編集できます')).toBeVisible()

  await reviewMemoInput.fill('更新後メモ')
  await page.getByRole('button', { name: 'メモを更新' }).click()
  await expect(page.getByText('振り返りメモを更新しました')).toBeVisible()

  await page.reload()
  await expect(page.getByText('完了済み')).toBeVisible()
  await expect(page.getByLabel('振り返りメモ')).toHaveValue('更新後メモ')
})
```

---

### シナリオ 16: カテゴリ追加・編集・無効化がレシート入力候補と既存表示に反映される

- **優先度**: P1
- **カテゴリ**: regression（Issue #17 完了条件）
- **前提条件**:
  - ログイン済みの状態
  - テスト用の一意なカテゴリ名・店舗名を用意する（例: `E2Eカテゴリ-<timestamp>`）
  - カテゴリ設定画面とレシート入力画面を行き来できる
- **手順**:
  1. カテゴリ設定画面を開く
  2. 新規カテゴリを追加する
  3. 追加したカテゴリの名前と色を変更する
  4. レシート入力画面へ戻る
  5. 変更後カテゴリが入力候補に表示されることを確認する
  6. そのカテゴリでレシートを1件保存する
  7. カテゴリ設定画面で同カテゴリを無効化する
  8. レシート入力画面へ戻る
  9. 無効化カテゴリが新規入力候補に表示されないことを確認する
  10. 週次サマリーまたはレシート一覧を確認する
- **期待結果**:
  - 追加・変更したカテゴリが active の間はレシート入力候補に表示される
  - 無効化後は新規レシート入力候補に表示されない
  - 無効化前に保存済みのレシートは表示が壊れず、カテゴリ名が表示される
  - 週次サマリーまたは一覧で inactive カテゴリの名称・色が解決される
- **テストデータ・cleanup**:
  - 作成カテゴリは最後に無効化する
  - 作成レシートは既存の cleanup 経路で削除する。削除できない場合は一意な店舗名で汚染を限定する
- **対応するコード**: `src/components/CategorySettingsPanel.tsx`、`src/components/ReceiptForm.tsx`、Convex `categories` / `receipts`

---

## テスト実行方法

### ローカル開発環境での実行

```bash
# 1. テスト環境をセットアップ
pnpm exec clerk auth login
pnpm exec clerk link
pnpm exec clerk env pull --instance dev --file .env.local

# 2. テストユーザーを作成（初回のみ）
pnpm exec clerk users create \
  --instance dev \
  --email "codex+clerk_test@example.com" \
  --password "<secure-password>" \
  --first-name Codex \
  --last-name Test \
  --yes

# 3. 開発サーバーを起動
pnpm run dev
pnpm run convex:dev

# 4. E2E テストを実行（Issue #19 で Playwright 導入後）
pnpm exec playwright test

# 特定のシナリオのみ実行
pnpm exec playwright test --grep "必須項目を全て入力"

# UI モードで実行（デバッグ用）
pnpm exec playwright test --ui
```

### GitHub Actions での実行方針（Issue #18 で整備）

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E tests
        run: pnpm exec playwright test
        env:
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
          E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
          E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 3
```

---

## テスト優先度と段階的導入

### Phase 1: Smoke Test（P0）— Issue #19 実装時の最初の段階

実装するシナリオ:
- シナリオ 1: 未ログイン状態でアクセス
- シナリオ 2: メール/パスワード認証でログイン
- シナリオ 5: 必須項目を全て入力して保存
- シナリオ 6: 保存後にレシート一覧に追加される

**目標**: ログイン → 入力 → 保存の基本フローが動作することを確認

### Phase 2: Validation & UX（P1）— Phase 1 が安定した後

実装するシナリオ:
- シナリオ 3: ページリロード後のログイン状態維持
- シナリオ 4: ログアウト
- シナリオ 7〜10: バリデーションエラー
- シナリオ 13: ユーザー分離
- シナリオ 15: 振り返りメモ保存 → セッション完了 → 完了後もメモ更新方針が明確
- シナリオ 16: カテゴリ追加・編集・無効化がレシート入力候補と既存表示に反映される

### Phase 3: Edge Cases（P2）— Phase 2 が安定した後

実装するシナリオ:
- シナリオ 11〜12: 金額の境界値テスト
- シナリオ 14: ネットワークエラーハンドリング

---

## テスト環境の注意事項

### Clerk テストユーザーの管理

- テストユーザーの認証情報（メール、パスワード）は `.env.local` で管理
- ログ、Pull Request、チャット、Git リポジトリに出力しない
- GitHub Actions では Secrets を使用
- 複数テストユーザーが必要な場合（ユーザー分離テスト）は別途 Secrets を作成

### Convex 環境の確認

- `VITE_CONVEX_URL` が Development deployment を指していることを確認
- `CLERK_JWT_ISSUER_DOMAIN` が Clerk Development instance に設定されていることを確認

### Vercel Preview での実行

- `VERCEL_AUTOMATION_BYPASS_SECRET` を使用して Protection Bypass for Automation を設定
- GitHub Actions secrets にのみ保存し、ログや PR コメントに出力しない

---

## トラブルシューティング

### Clerk 認証でハング

**原因**: storageState が古い、または Clerk JWT が無効

**対応**:
```bash
rm -f playwright/.clerk/user.json
# storageState を再生成
```

### Convex mutation が "Unauthorized" エラー

**原因**: `CLERK_JWT_ISSUER_DOMAIN` が設定されていない

**対応**:
```bash
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN 'https://xxxx.clerk.accounts.dev'
```

### UI 要素が見つからない

**対応**:
- `[role="..."]` などの ARIA role ベースのセレクタを優先
- `text=...` でテキスト検索
- MUI のクラス名は変わる可能性があるため `[class*="..."]` は最終手段

---

## 参考資料

- Playwright 公式ドキュメント: https://playwright.dev/docs/intro
- Clerk Testing ドキュメント: https://clerk.com/docs/testing/overview
- 開発プロセス: `docs/development-process.md`
- 技術設計: `docs/technical-design.md`
