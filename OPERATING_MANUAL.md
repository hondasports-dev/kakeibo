# 運用マニュアル

## 使い方

Codex / Devinでは、まず `$virtual-company` を使って依頼を分解する。

`.agents/roles/` 配下は役割別プロンプト集であり、それだけで実行時サブエージェントが常駐するわけではない。必要な役割だけを読み、過剰な分業を避ける。

Codex Plan モードでは Main が Coordinator と Tech Lead を兼務する。`.codex/agents/*.toml` は使わず、`AGENTS.md`、`.agents/skills/**`、`.agents/roles/**` を正本とする。

サブエージェントは独立した調査や専門評価、Implementer、Reviewer に使う。Tech Lead の設計判断は Main に残し、同一差分の writer は原則 Implementer 1体、Reviewer は論理 read-only とする。

推奨モデルは Main / Tech Lead と Reviewer が `gpt-5.6-sol`、Implementer と QA が `gpt-5.6-luna`。effort と例外条件の正本は `AGENTS.md`「モデルルーティング」と `workflows/delegation-prompts.md` とする。

## Issue を1つ解決する場合（推奨）

Cursor では Plan モードで Issue 番号を渡す。Codex / Devin では「実施計画を先に出力してから実行」と指示する。
エージェント契約の正本は **`AGENTS.md`「Plan モードでの Issue 対応」**。手順の正本は **`docs/development-process.md`**。

内部フロー:

1. **`issue-gate-0`** — Main がユーザー要求、Issue、docs、既存コードを統合し、必要に応じてプロダクトリードA/B/C、QA Agent、UX/UIデザイナーの評価を得て、Tech Lead 判断を確定する。
   - `needs_discussion` が1つでもあれば実装に進まず、論点をまとめてユーザー確認へ戻す。
2. **`tdd-implement`** — Main が固定形式の Implementation Handoff を作り、原則1体の Implementer が RED → GREEN で進める。
3. **Main integrity check** — Handoff と実差分を照合し、違反時は同じ Implementer へ返す。
4. **`e2e-author`**（該当時） — E2E spec 追加・更新、または省略理由。
5. **`verify-pre-push`** — push 前検証、必要ならローカル E2E。
6. **`code-review`** — 論理 read-only の Reviewer が preview 差分をレビューし、Main が指摘を同じ Implementer へ返す。
7. **PR 作成・push** — `docs/development-process.md`「Issue 対応フロー」参照。
8. **CI** — GitHub Actions / E2E 確認。失敗時は修正 → 再検証 → `code-review` 再実行 → 再 push。

ループ上限を超えた場合や環境起因のエラーは、中断してユーザーに報告する。

## マイルストーンを一括で解決する場合

Plan モードでマイルストーン名を渡す。`AGENTS.md`「マイルストーン Plan」に従い、open Issue を**直列**で処理する。

1. `gh issue list --milestone "<title>" --state open` で Issue を列挙
2. 各 Issue で上記フロー（GATE0 → TDD → verify → review → PR → CI）
3. ユーザー明示時のみ **`babysit-pr`** → **`gh pr merge --rebase`**
4. 進捗は GitHub Issue タスク台帳で管理する

`convex/` / `.github/` 変更で CODEOWNERS approval が必要な場合は人間 approval が必要。

## Codex / Devinでの使い方

### 企画から始める場合

```text
$virtual-company を使って、
このアプリ案を企画、設計、実装、QA、レビュー、リリースに分解して。
Codexで作業する場合は、必要に応じてサブエージェントを起動してよい。
Devinで作業する場合も、同じ役割分担で進めて。
```

### 市場調査から始める場合

```text
$virtual-company と $research-current-market を使って、
今作るべきアプリ案を調査して。
ユーザーが承認するまで実装には進まないで。
Codexで作業する場合は、ユーザー承認後に必要に応じてサブエージェントを起動してよい。
Devinで作業する場合も、同じ役割分担で進めて。
```

### 実装だけ頼む場合

```text
$virtual-company を使って、
次の設計に基づいて実装して。
必要な役割は Implementer を中心にして。
Codexで作業する場合は、担当範囲が分離できるときだけImplementerサブエージェントを起動してよい。
Devinで作業する場合も、同じ役割分担で進めて。
```

### レビューだけ頼む場合

```text
$virtual-company を使って、
この差分をレビューして。
必要な役割は Reviewer を中心にして。
Codexで作業する場合は、必要に応じてReviewerサブエージェントを起動してよい。
Devinで作業する場合も、同じ役割分担で進めて。
```

## 並列化の方針

- Product Lead A/B/C は並列で評価してよい。
- UI/UX変更を含む場合は UX/UI Designer も Product Lead と並列で評価してよい。
- Main の Tech Lead 判断は、Product Lead / UX/UI Designer の評価が `approved` になってから確定する。
- 同一差分の writer は原則 Implementer 1体。複数に分けるのは編集範囲を完全分離できる場合だけとする。
- QA Agent は、実装前のE2Eテスト設計レビューと、実装後のE2E結果確認の2回使ってよい。
- Reviewer は論理 read-only とし、修正は Main 経由で同じ Implementer に戻す。
- Release Manager は QA と Reviewer の結果がそろってから使う。
- サブエージェントを起動できない場合は、理由を書いてからメインエージェントが該当ロール文書を読む。理由なしにメインエージェントだけで代替しない。

## サブエージェントがコマンドを実行できない場合の対処

サブエージェント（Implementer, QA Agent, Reviewer など）がシェルコマンド（`git`, `pnpm`, `npx` など）の実行に失敗した場合は、次の手順で対処する。

1. **サブエージェントはメインエージェントに報告する**
   - 実行できなかったコマンドと理由を明示する
   - それ以外の作業（ファイル編集など）の完了状況を報告する

2. **メインエージェントがコマンドを代わりに実行する**
   - サブエージェントの報告を受け取り、指定されたコマンドを実行する

3. **必要であれば処理をサブエージェントに戻す**
   - コマンド実行結果をサブエージェントに伝え、残りの作業を継続させる

### 例

```
Implementer: "pnpm test --run の実行に失敗しました。メインエージェントで実行してください。"
→ メインエージェント: pnpm test --run を実行
→ メインエージェント: 結果をImplementerに渡して残作業を継続
```

## 注意

`.agents/roles/` ディレクトリは永続的な指示書であり、実行時サブエージェントそのものを常駐させるものではない。会話中に役割分担する場合は、`$virtual-company` から必要な指示書だけを参照する。Codexでサブエージェントを起動する場合は、`tool_search` で利用可能な起動ツールを確認し、役割名を含めて起動する。
