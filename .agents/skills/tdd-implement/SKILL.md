---
name: tdd-implement
description: Plan 契約フェーズ1。GATE0 Go 後の TDD 実装（RED/GREEN、Issue 再検討、失敗切り分け）。worktree 手順は development-process 参照。
argument-hint: "<issue-number>"
triggers:
  - user
  - model
---

# TDD 実装（Plan 契約フェーズ1）

## 前提

- `issue-gate-0` で **GATE0 成果物** と統合判定 **Go** があること
- 手順正本: `docs/development-process.md`（worktree、ブランチ分離、必要ドキュメント）

## 併用ガード

- コード変更前に作業ブランチまたは worktree を分離する（`development-process.md` 参照）
- Convex 編集前に `convex/_generated/ai/guidelines.md` を読む
- 振る舞い変更・バグ修正は TDD を基本とする

## Issue を再検討する

- 問題、期待する振る舞い、影響ファイル、受け入れ条件を自分の言葉で要約する
- UI/UX 変更の有無、画面状態、ユーザー導線、E2E 追加・更新・省略理由を実装前に決める
- `e2e-test-case.md`、`implementation-plan.md`、`delivery-notes.md` などの一時メモファイルは作らない
- UI 変更では既存 UI/UX ドキュメントとコンポーネントパターンを確認してから編集する
- 自動判断ルール:
  - Issue 本文に「->」「〜に変更」「置き換え」などがあれば、既存機能を置き換える形と判断する
  - 家計簿アプリで「支出推移」「週別グラフ」などがあれば、デフォルト対象は expense
  - 「今週 vs 前週」「今週と前週」などは、今週を基準に前週を比較対象とする

## TDD で進める

1. 望ましい振る舞いを証明する最小のユニットテスト、コンポーネントテスト、または Convex テストを先に追加する
2. 対象テストを実行し、期待した理由で **失敗** することを確認する（RED）
3. 最小の本体コード変更を入れ、対象テストが通るまで再実行する（GREEN）
4. RED、GREEN、レビュー修正、ドキュメント更新など、意味単位で小さくコミットする
5. E2E はフェーズ2 `e2e-author` で扱う。ユニット/コンポーネント/Convex テストで足りる場合は E2E を省略できる

## 失敗は体系的に切り分ける

- 正確なエラー文、行番号、失敗テスト名、ロケーター、再現条件を読む
- コード、テストデータ、認証・環境変数、ネットワーク、外部サービス、既存 flaky を分けて確認する
- E2E 失敗が今回の変更由来か不明な場合は、main で同じテストを単体実行して再現性を確認する
- Clerk / Convex E2E では秘密値を表示しない
- Playwright の `.or()` は strict mode violation を避けるため、必要に応じて `.first()` などで 1 件に限定する

## 完了条件

- RED / GREEN の証拠（テスト名・コミット）がある
- GATE0 成果物の実装範囲内で完了条件を満たしている
- 次フェーズ: `e2e-author`（該当時）→ `verify-pre-push`

## 危険信号

- 失敗するテストなしで振る舞い変更を実装しようとしている
- 別 Issue のブランチに混ぜようとしている
- GATE0 成果物なしでコードを編集している
