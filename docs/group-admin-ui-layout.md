# グループ管理画面の表示構成

グループ管理 UI（`GroupSettingsPanel`）のセクション構成と Phase1/Phase2 の表示境界を定義する。

関連 Issue: [#214](https://github.com/hondasports/kakeibo/issues/214)
権限の正本: `docs/group-admin-permissions.md`

## 1. 画面位置

- ルート: `/settings`
- コンポーネント: `src/components/GroupSettingsPanel.tsx`
- セクション部品: `src/components/groupAdmin/GroupSettingsSection.tsx`

## 2. セクション構成（上から順）

| 順序 | セクション | testId | owner | member | Phase1 操作 |
| --- | --- | --- | --- | --- | --- |
| 1 | グループ情報 | `group-info-section` | 表示 | 表示 | グループ切替（既存）、グループ名変更（#215 で有効化） |
| 2 | メンバー管理 | `member-management-section` | 表示 | 表示 | 一覧（#216）、解除（#217・owner のみ） |
| 3 | 招待管理 | `invite-management-section` | 表示 | **非表示** | 招待送信（既存）、pending 一覧（#218）、取り消し（#219） |
| 4 | 危険な操作 | `danger-zone-section` | 表示 | **非表示** | Phase2 のプレースホルダのみ |

`member` には招待管理・危険な操作を出さず、画面下部に「招待と削除はオーナーのみ操作できます。」を表示する。

## 3. グループ情報セクション

### owner

- ロール Chip、メンバー数 Chip
- 複数グループ所属時: グループ切替セレクト + 切替ボタン（グループ名変更フォームは非表示）
- 単一グループ時: グループ名変更フォームのみ（#215 まで disabled プレースホルダ。テキスト表示は出さない）

### member

- ロール Chip、メンバー数 Chip
- 複数グループ所属時: グループ切替（既存どおり）
- グループ名変更フォームは非表示

## 4. メンバー管理セクション

### owner / member 共通

- メンバー一覧（表示名、メール、ロール Chip、「あなた」Chip）

### owner のみ

- `member` ロールへのグループ解除ボタン（確認ダイアログ必須）

### member

- 解除ボタン非表示

## 5. 招待管理セクション（owner のみ）

- 招待メール入力 + 送信ボタン（既存）
- 送信済み pending 招待一覧（`GroupPendingInvitationList`、同一メールは最新 1 件のみ表示）
- 招待取り消し（#219 で一覧行に追加。取り消しはメール単位で無効化する）

## 6. 危険な操作セクション（owner のみ・Phase2 余白）

Phase1 では操作ボタンを置かず、次の Phase2 候補を文言のみ列挙する。

- オーナー権限の譲渡（#222）
- メンバーのロール変更（#223）
- グループの削除（#224）
- 管理操作の監査ログ（#225）

## 7. UI 状態

| 状態 | 表示 |
| --- | --- |
| 読込中 | パネル全体でスピナー + 「グループ設定を読み込んでいます。」 |
| グループ未作成 | info Alert「グループ作成後にメンバー管理を利用できます。」 |
| エラー | パネル上部に error Alert（操作失敗メッセージ） |
| 成功 | Snackbar（招待送信、メンバー解除、グループ切替） |

## 8. レスポンシブ

- フォーム行は `direction={{ xs: "column", sm: "row" }}` でスマホ幅では縦積み
- メンバー行は `group-member-row` で折り返し（`App.css`）

## 9. 後続 Issue への差し込み位置

| Issue | 差し込み先 |
| --- | --- |
| #215 グループ名変更 | グループ情報セクションの disabled フォームを有効化 |
| #216 メンバー一覧 | メンバー管理セクションの一覧表示を強化 |
| #217 メンバー解除 | メンバー管理セクション（既存ボタンを #213 ガードに合わせて強化） |
| #218 pending 一覧 | 招待管理セクションに `GroupPendingInvitationList` を配置（完了） |
| #219 pending 取り消し | 招待管理セクションの一覧行に追加 |
