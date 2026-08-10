---
name: tdd-implement
description: GATE0 Go 後に RED/GREEN で最小実装し、失敗原因を切り分ける。Plan 契約フェーズ1や、Issue の振る舞い変更・バグ修正を TDD で実装するときに使う。
---

# TDD 実装（Plan 契約フェーズ1）

## 目的

GATE0 の範囲内で、失敗するテストから始めて最小変更で受け入れ条件を満たす。

## 入力

- Issue 番号と GATE0 成果物
- メインエージェントが確定した Implementation Handoff

## 前提

- `issue-gate-0` で **GATE0 成果物** と統合判定 **Go** があること
- 手順正本: `docs/development-process.md`（worktree、ブランチ分離、必要ドキュメント）

## Implementation Handoff

Issue は判断履歴であり、そのまま Implementer への依頼文にはしない。メインエージェントは、現在のユーザー要求、Issue、`AGENTS.md`、関連 docs、既存コード・テストを統合し、次の固定契約を作る。

```text
Implementation Handoff — Issue #NN
Goal:
Design Decisions:
Scope / Editable Paths:
Out of Scope:
Acceptance Criteria:
Constraints / Prohibited Operations:
References:
Test Plan / RED-GREEN:
Verification:
Return Contract:
```

- 必須項目に実装を左右する曖昧さが残る場合、Implementer へ委譲しない。
- writer は原則 Implementer 1 体とする。複数 writer は編集可能パスを完全分離できる場合だけ使う。
- Implementer は契約外の設計変更を独断で行わず、矛盾や不足をメインエージェントへ返す。
- branch、worktree、stage、commit、push、PR はメインエージェントが管理する。

## 併用ガード

- コード変更前に作業ブランチまたは worktree を分離する（`docs/development-process.md` 参照）
- Convex 編集前に `convex/_generated/ai/guidelines.md` を読む
- 振る舞い変更・バグ修正は TDD を基本とする

## Issue を再検討する

- 問題、期待する振る舞い、影響ファイル、受け入れ条件を自分の言葉で要約する
- UI/UX 変更の有無、画面状態、ユーザー導線、E2E 追加・更新・省略理由を実装前に決める
- e2e-test-case.md、implementation-plan.md、delivery-notes.md などの一時メモファイルは作らない
- UI 変更では既存 UI/UX ドキュメントとコンポーネントパターンを確認してから編集する
- 自動判断ルール:
  - Issue 本文に「->」「〜に変更」「置き換え」などがあれば、既存機能を置き換える形と判断する
  - 家計簿アプリで「支出推移」「週別グラフ」などがあれば、デフォルト対象は expense
  - 「今週 vs 前週」「今週と前週」などは、今週を基準に前週を比較対象とする

## TDD で進める

1. 望ましい振る舞いを証明する最小のユニットテスト、コンポーネントテスト、または Convex テストを先に追加する
2. 対象テストを実行し、期待した理由で **失敗** することを確認する（RED）
3. 最小の本体コード変更を入れ、対象テストが通るまで再実行する（GREEN）
4. RED、GREEN、レビュー修正、ドキュメント更新を意味単位で報告する。コミットはメインエージェントが行う
5. E2E はフェーズ2 `e2e-author` で扱う。ユニット/コンポーネント/Convex テストで足りる場合は E2E を省略できる

## 失敗は体系的に切り分ける

- 正確なエラー文、行番号、失敗テスト名、ロケーター、再現条件を読む
- コード、テストデータ、認証・環境変数、ネットワーク、外部サービス、既存 flaky を分けて確認する
- E2E 失敗が今回の変更由来か不明な場合は、`preview` で同じテストを単体実行して再現性を確認する
- Clerk / Convex E2E では秘密値を表示しない
- Playwright の `.or()` は strict mode violation を避けるため、必要に応じて `.first()` などで 1 件に限定する

## 完了条件

- RED / GREEN の証拠（テスト名・実行結果）がある
- GATE0 成果物の実装範囲内で完了条件を満たしている
- 次フェーズ: `e2e-author`（該当時）→ `verify-pre-push`
- Return Contract に従い、変更ファイル、RED/GREEN、検証結果、契約との差分、未解決事項をメインエージェントへ返している

## Main integrity check（次フェーズ前の必須ゲート）

Implementer の返却後、Main は `git status --short`、`git diff HEAD`、untracked ファイルの内容を確認し、Return Contract と照合する。

- `Scope / Editable Paths` 外の変更がない
- `Design Decisions` に反する自己判断の設計変更がない
- 無関係なリファクタリングや依存追加がない
- Acceptance Criteria と実装内容が大きく乖離していない
- Handoff との差分・未解決事項が正しく報告されている

違反があれば E2E、検証、Reviewer へ進めず、同じ Implementer へ修正 Handoff を返す。修正後は同じ完全なチェックを再実行する。

## 停止条件

- 失敗するテストなしで振る舞い変更を実装しようとしている
- 別 Issue のブランチに混ぜようとしている
- GATE0 成果物なしでコードを編集している
