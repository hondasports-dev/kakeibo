---
name: code-review
description: PR前セルフレビュー／PRレビュー手順。preview 差分を対象に Must-fix を洗い出し、修正ループの正本。issue-tdd-workflow §9 から必ず invoke する。
argument-hint: "[--base preview|main]"
triggers:
  - user
  - model
---

# code-review

## 振る舞いと制約

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

## 使う場面

- `issue-tdd-workflow` §9 の push 前セルフレビュー（**必須**）
- PR レビュー、レビュー指摘の追跡

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
3. **専門 Skill（差分がある場合のみ追加）**
   - `convex/**` → `convex-performance-audit`
   - `src/**` React → `vercel-react-best-practices`
   - UI/UX → `web-design-guidelines`
4. **正しさ** — 正常系・異常系・境界値、エラーハンドリング。
5. **セキュリティ／プライバシー** — 機密情報、注入、XSS、認可。
6. **保守性** — 責務分離、命名、重複、将来の拡張。
7. **テスト** — 追加・更新・不足観点。
8. **副作用・影響範囲** — 変更されていないが影響しうるファイル、リスク。
9. **`private_docs/`** — AGENTS.md の参照ルール表に従い、更新漏れがないか確認。
10. **結果出力** — `review-template.md` の形式でまとめる。

## 指摘の分類と対応ルール

| 区分 | 定義 | `issue-tdd-workflow` での扱い |
| --- | --- | --- |
| **Must-fix** | バグ、認可漏れ、テスト不足、完了条件未達、セキュリティ | 修正必須。修正後に本 Skill を再実行 |
| **Nice-to-have** | リファクタ、命名、本筋外の技術負債 | Issue スコープ内なら修正。外なら PR 本文に未対応理由 |

## 完了条件（レビュー PASS）

- Must-fix が **0 件**
- 各観点（正しさ、セキュリティ、保守性、テスト、副作用）で「問題なし」または残リスクを明記
- `review-template.md` を出力済み
- **ループ上限**: Must-fix 対応 **3 回**を超えた場合は **ESCALATE**（ユーザー確認）

## 関連ファイル

- `review-template.md` — 出力テンプレート
- `frontend-review-checklist.md`
- `backend-review-checklist.md`
- `security-checklist.md`
