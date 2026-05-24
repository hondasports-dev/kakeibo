# E2Eテストケース一覧

## 更新履歴

| 日付 | Issue | 内容 |
|------|-------|------|
| 2026-05-24 | #64 | レシート画像アップロードUI シナリオ I64-1 追加 |
| 2025-01-23 | #49 | ナビゲーション E2E シナリオ N-1〜N-10 追加 |
| 2025-01-23 | #49 | responsive.spec.ts R-1/R-2 削除、R-3 更新 |

## シナリオ一覧

### Issue #49: UIの機能整理 (navigation.spec.ts)

| ID | シナリオ | 優先度 | カテゴリ | ファイル |
|----|---------|--------|---------|---------|
| N-1 | SP幅BottomNavigation 4タブ表示・遷移 | P0 | smoke | navigation.spec.ts |
| N-2 | PC幅Drawer表示・BottomNav非表示 | P0 | smoke | navigation.spec.ts |
| N-3 | Drawer全リンク遷移 | P0 | smoke | navigation.spec.ts |
| N-4 | ダッシュボードカード3枚以内・カテゴリ別/前週比非表示 | P1 | validation | navigation.spec.ts |
| N-5 | SP幅入力画面のサマリー非表示 | P1 | validation | navigation.spec.ts |
| N-6 | PC幅入力画面の左右ペインレイアウト | P1 | validation | navigation.spec.ts |
| N-7 | SummaryPageに週次サマリー表示 | P1 | validation | navigation.spec.ts |
| N-8 | SummaryPageから週次レビューへの遷移ボタン | P1 | validation | navigation.spec.ts |
| N-9 | SPで入力フロー完走 | P0 | validation | navigation.spec.ts |
| N-10 | URL構造維持確認 | P0 | regression | navigation.spec.ts |

### Issue #64: レシート画像アップロードUI (receipt-form.spec.ts)

| ID | シナリオ | 優先度 | カテゴリ | ファイル |
|----|---------|--------|---------|---------|
| I64-1 | 画像アップロードUIが手入力保存フローを妨げない | P1 | regression | receipt-form.spec.ts |

### 既存シナリオ (responsive.spec.ts)

| ID | シナリオ | 優先度 | カテゴリ | ステータス |
|----|---------|--------|---------|---------|
| ~~R-1~~ | ~~390px viewport でメイン画面の主要要素が表示される~~ | ~~P0~~ | ~~smoke~~ | **削除** (Issue #49 でダッシュボードが変更されたため) |
| ~~R-2~~ | ~~320px viewport でメイン画面の主要要素が表示される~~ | ~~P0~~ | ~~smoke~~ | **削除** (Issue #49 でダッシュボードが変更されたため) |
| R-3 | 390px viewport でカテゴリ設定画面の主要要素が表示される | P0 | smoke | **更新** (BottomNavigation 経由の遷移に変更) |

---

## 詳細シナリオ

### Issue #49: UIの機能整理

#### シナリオ N-1: SP幅でBottomNavigation 4タブが表示され、タップで各画面に遷移できる (P0/smoke)

**Given:** ユーザーがSP幅（390px）でログイン済み状態でダッシュボード（/）を開く  
**When:** BottomNavigation が表示される  
**Then:**
- 4つのタブが表示される: 「ホーム」「入力」「履歴」「設定」
- 各タブをタップすると対応する画面に遷移する:
  - 「ホーム」タップ → URL が / になる
  - 「入力」タップ → URL が /weeks/current/input になる
  - 「設定」タップ → URL が /settings になる

#### シナリオ N-2: PC幅でBottomNavigationが非表示になり、Drawerが表示される (P0/smoke)

**Given:** ユーザーがPC幅（1280px）でログイン済み状態でアプリを開く  
**When:** ダッシュボード（/）が表示される  
**Then:**
- BottomNavigation（aria-label="navigation" などのrole=navigationで画面下部にあるもの）が非表示 または DOMに存在しない
- Drawer（role="navigation" または aria-label="サイドメニュー"）が表示される

#### シナリオ N-3: DrawerのすべてのリンクからURL遷移できる (P0/smoke)

**Given:** ユーザーがPC幅でログイン済み状態でダッシュボードを開く  
**When:** Drawer内のリンクをクリックする  
**Then:**
- 「入力」リンク → /weeks/current/input に遷移
- 「設定」リンク → /settings に遷移
- 「ホーム」リンク → / に遷移

#### シナリオ N-4: ダッシュボードにカテゴリ別内訳・前週比カードが表示されない (P1/validation)

**Given:** ユーザーがログイン済み状態でダッシュボード（/）を開く  
**When:** ダッシュボードが表示される  
**Then:**
- 「カテゴリ別内訳」「カテゴリ別支出」という heading/text が表示されない
- カードの数が3枚以内である（ [role="article"] または適切なセレクタで確認）

#### シナリオ N-5: SP幅でInputPageを開くとフォームのみが表示される (P1/validation)

**Given:** ユーザーがSP幅でログイン済み状態で /weeks/current/input を開く  
**When:** ページが表示される  
**Then:**
- 入力フォームが表示される（店名、金額、カテゴリなどのフォーム要素）
- サマリー（「今週のサマリー」的なセクション）がDOM上にない or 非表示

#### シナリオ N-6: PC幅でInputPageを開くと左右2ペインレイアウトになる (P1/validation)

**Given:** ユーザーがPC幅でログイン済み状態で /weeks/current/input を開く  
**When:** ページが表示される  
**Then:**
- 入力フォームが表示される
- サマリーパネルも同時に表示される（workbench-grid レイアウト）

#### シナリオ N-7: SummaryPageに週次サマリーが表示される (P1/validation)

**Given:** ユーザーがログイン済み状態で /weeks/<今週のweekStartDate> を開く  
**Then:**
- 「合計」または「支出合計」的なテキストが表示される
- WeekNavigator（前の週/次の週ボタン）が表示される

#### シナリオ N-8: SummaryPageに週次レビューへの遷移ボタンがある (P1/validation)

**Given:** ユーザーがログイン済み状態で /weeks/<今週のweekStartDate> を開く  
**Then:**
- 「振り返り」「レビュー」「完了」などのボタンまたはリンクが存在する

#### シナリオ N-9: SPで入力フローを一通り完走できる (P0/validation)

**Given:** ユーザーがSP幅でログイン済み状態でダッシュボードを開く  
**When:**
1. BottomNavigation の「入力」タブをタップ
2. /weeks/current/input に遷移
3. 入力フォームが表示される  
**Then:**
- フォームが正常に表示されている（店名フィールド、金額フィールドが存在）
- BottomNavigation も引き続き表示されている

#### シナリオ N-10: 既存のURL構造が維持されている (P0/regression)

**Given:** ユーザーがログイン済み状態  
**When:** 各URLに直接アクセスする  
**Then:**
- / → ダッシュボードが表示される（404にならない）
- /weeks/current/input → 入力画面が表示される（404にならない）
- /settings → 設定画面が表示される（404にならない）
- /weeks/2025-01-06 → サマリー画面が表示される（404にならない）

### Issue #64: レシート画像アップロードUI

#### シナリオ I64-1: 画像アップロードUIが手入力保存フローを妨げない (P1/regression)

**Given:** ユーザーがログイン済み状態で /weeks/current/input を開く
**When:**
1. `画像から入力` セクションで画像ファイルを選択する
2. プレビュー、ファイル名、削除ボタン、`読み取る` ボタンを確認する
3. 選択画像を削除して未選択状態へ戻ることを確認する
4. 再度画像を選択し、`読み取る` を押す
5. 解析中表示後に未接続/準備中UIを確認する
6. 店舗名、金額、カテゴリを手入力して `保存して次へ` を押す
**Then:**
- 画像UI操作後も手入力フィールドを操作できる
- 読み取り未接続UIが表示されても保存フローは妨げられない
- 保存成功通知が表示され、既存どおり店名・金額がクリアされる
- 画像はDB保存やフォーム自動反映をしない

### 既存シナリオ

#### シナリオ R-3: 390px viewport でカテゴリ設定画面の主要要素が表示される (P0/smoke) - 更新

**Given:** ユーザーがSP幅（390px）でログイン済み状態でダッシュボードを開く  
**When:** BottomNavigation の「設定」タブをクリック → /settings に遷移  
**Then:**
- 設定画面が表示される
- TODO: カテゴリ設定ページが /categories に実装されたら、カテゴリ設定へのリンクをクリック → カテゴリ設定画面の要素を確認

---

## 実装上の注意点

- 今週の weekStartDate は JavaScript の Date から月曜日を計算して求める
- 不確かなセレクタは `getByRole` や `getByText` などアクセシブルなものを使う
- `@smoke` タグはテスト名に `@smoke` を含めることで付与する
- `@navigation` タグも同様にテスト名に含めることで付与する
- responsive.spec.ts の R-3 は、SettingsPage の実装が確定していないため現時点では `/settings` に遷移する部分まで実装
