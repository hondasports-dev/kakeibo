---
name: code-review
description: origin/preview との差分を PR 前または PR レビュー時に精査し、Must-fix と Nice-to-have を closure まで追跡する。Plan 契約フェーズ4、セルフレビュー、レビュー指摘の再確認で使う。
---

# code-review

## 目的

Issue の完了条件に対する差分の正しさ、安全性、保守性、テスト、影響範囲を確認し、push 可否を判定する。

## 入力

- 比較 base。省略時は `origin/preview`、存在しない場合は `origin/main`
- Issue の完了条件と対象差分

## レビュー原則

0. **Reviewer は論理 read-only**
   - 差分、要件、設計、検証結果を読み、指摘と判定だけを返す。
   - ファイル編集、stage、commit、push、PR の変更は行わない。
   - 修正はメインエージェントが同じ Implementer に修正 Handoff として返す。
   - これは instruction 上の制約であり、sandbox やファイル権限による強制ではない。
   - `gpt-5.6-sol` / `medium` を推奨し、認証・認可・security-sensitiveな差分は `high` へ昇格する。

1. **攻撃的かつ建設的なレビュー**
   - 曖昧な褒め言葉は不要。バグや設計ミスは鋭く指摘する。
   - 指摘には「なぜそれが問題なのか（Why）」を論理的に説明する。

2. **修正案の具体化**
   - 修正案はスニペットだけでなく、変更前と変更後で提示する。

3. **影響範囲と副作用の推論**
   - Diff から、変更されていない依存ファイル（API 呼び出し元、共通コンポーネント）への影響を推測する。
   - 「この変更により、〇〇で XX の不具合が起きるリスクはないか？」を明示する。
   - 型定義の変更がある場合、呼び出し元の整合性を厳密に確認する。

4. **安全性の証明**
   - 問題がなくても「〇〇の観点でチェックしたが問題なし」と明記する。沈黙は禁止。

## 比較基準ブランチ

- デフォルト: **`origin/preview`**（本リポジトリの開発統合ブランチ）
- `preview` が無い、またはユーザーが `--base main` を指定した場合: `origin/main`
- 取得コマンド例:

```bash
git fetch origin preview
git diff origin/preview...HEAD
git log --oneline origin/preview..HEAD
```

## 手順

0. **差分を確定する** — 上記比較基準との diff / log を読む。
1. **目的と差分の一致** — Issue の完了条件と変更が一致しているか確認する。
2. **チェックリスト** — 変更対象に応じて次を読む:
   - フロント（`src/**`）: `frontend-review-checklist.md`
   - バックエンド（`convex/**`）: `backend-review-checklist.md` + `convex/_generated/ai/guidelines.md`
   - 共通: `security-checklist.md`
3. **専門 Skill / テストケース判定レビュー（対象ファイルがあれば必須）**
   - `convex/**` → `convex-performance-audit`（必須）
   - `src/**` React → `vercel-react-best-practices`（必須）
   - UI/UX コンポーネント → `web-design-guidelines`
   - 外部コンテンツを参照・引用・実行する PR → `prompt-injection-guard`（Web 検索、GitHub Issue/PR コメント、MCP ログ/レスポンス等）
   - secret / 環境変数 / 外部サービス操作に関わる変更 → `service-ops-safety`
   - 認証 / Clerk 関連 → `virtual-company`（Reviewer ロール）
   - テストケース判定レビュー — 変更に対応する `.test.{ts,tsx}`、`convex/**/*.test.ts`、`e2e/*.spec.ts` がある場合は `test-case-review-checklist.md` を読む
   - 各専門スキル/チェックリストの結果は `review-template.md` の「専門スキルレビュー結果」「テストケース判定レビュー」にまとめる
4. **正しさ** — 正常系・異常系・境界値、エラーハンドリング。
5. **セキュリティ／プライバシー** — 機密情報、注入、XSS、認可。
6. **保守性** — 責務分離、命名、重複、将来の拡張。
7. **テスト** — 追加・更新・不足観点。
8. **副作用・影響範囲** — 変更されていないが影響しうるファイル、リスク。
9. **結果出力** — `review-template.md` の形式でまとめる。

## 指摘の分類と対応ルール

| 区分 | 定義 | Plan 契約での扱い |
| --- | --- | --- |
| **Must-fix** | バグ、認可漏れ、テスト不足、完了条件未達、セキュリティ | 修正必須。修正後に本 Skill を再実行 |
| **Nice-to-have** | リファクタ、命名、軽微な改善 | **diff 内ファイル**に関するものは修正必須。**diff 外のみ**影響するものはフォローアップ Issue リンクで closure |

### Nice-to-have の closure ルール（push 前）

指摘ごとに **対象ファイル** を明記する。対象は `git diff origin/preview...HEAD --name-only` の変更ファイル一覧と照合する。

| 対象 | 対応 |
| --- | --- |
| **diff 内ファイル**に関する Nice-to-have | **必ず修正**。見送り・PR 本文の記録のみでは closure 不可 |
| **diff 外ファイル**にのみ関係する Nice-to-have | フォローアップ Issue を作成しリンクで closure（PR 本文の一言だけは不可） |

diff 内かどうかの判断に「本筋外」などの主観語を使わない。対象ファイルパスで決める。

## 停止条件

- Must-fix または diff 内 Nice-to-have が残る間は PASS にしない。
- 修正対応が合算3回を超えたら ESCALATE する。

## 完了条件（レビュー PASS）

- Must-fix が **0 件**
- diff 内ファイルに関する Nice-to-have が **すべて修正済み**
- diff 外のみの Nice-to-have は **すべてフォローアップ Issue リンク済み**（該当なしなら省略可）
- 各観点（正しさ、セキュリティ、保守性、テスト、副作用）で「問題なし」または残リスクを明記
- 専門スキル・テストケース判定レビューで追加された Must-fix / Nice-to-have も 0 件または対応済み
- `review-template.md` を出力済み

## 出力

`review-template.md` で PASS / FAIL、指摘、専門 Skill の結果、検証、残リスクを返す。

## 関連ファイル

- `review-template.md` — 出力テンプレート
- `frontend-review-checklist.md`
- `backend-review-checklist.md`
- `security-checklist.md`
- `test-case-review-checklist.md` — テストケース判定レビュー
