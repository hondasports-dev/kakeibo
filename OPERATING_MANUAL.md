# 運用マニュアル

## 使い方

Codex / Devinでは、まず `$virtual-company` を使って依頼を分解する。

`.agents/roles/` 配下は役割別プロンプト集であり、それだけで実行時サブエージェントが常駐するわけではない。必要な役割だけを読み、過剰な分業を避ける。

Codexで実行時サブエージェント機能が未ロードの場合は、`tool_search` で multi-agent / spawn 系ツールを探す。`multi_agent_v1.spawn_agent` が使える場合はそれを使い、プロンプトに「xxx サブエージェントを起動」という役割名を明記する。

通常の `$virtual-company` では、ユーザーの依頼文に「必要に応じてサブエージェントを起動してよい」とある場合に実行時サブエージェントを起動する。Plan 契約（`AGENTS.md`）で Issue を処理する場合、フェーズ0（`issue-gate-0`）が複数ロール確認を要求するため、ユーザーが追加で許可文を書いていなくても Product Lead A/B/C、Tech Lead、QA Agent などを起動してよい。Devinでは、同じ文を役割別エージェントまたは内部タスク分割への委譲許可として扱う。

## Issue を1つ解決する場合（推奨）

Cursor では Plan モードで Issue 番号を渡す。Codex / Devin では「実施計画を先に出力してから実行」と指示する。
エージェント契約の正本は **`AGENTS.md`「Plan モードでの Issue 対応」**。手順の正本は **`docs/development-process.md`**。

内部フロー:

1. **`issue-gate-0`** — プロダクトリードA/B/C、Tech Lead、QA Agent（UI変更時は UX/UIデザイナー）が要件を確認する。
   - `needs_discussion` が1つでもあれば実装に進まず、論点をまとめてユーザー確認へ戻す。
2. **`tdd-implement`** — RED → GREEN で進める。
3. **`e2e-author`**（該当時） — E2E spec 追加・更新、または省略理由。
4. **`verify-pre-push`** — push 前検証、必要ならローカル E2E。
5. **`code-review`** — preview 差分のセルフレビューと Must-fix / Nice-to-have 対応ループ。
6. **PR 作成・push** — `docs/development-process.md`「Issue 対応フロー」参照。
7. **CI** — GitHub Actions / E2E 確認。失敗時は修正 → 再検証 → `code-review` 再実行 → 再 push。

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
- Tech Lead は、Product Lead / UX/UI Designer の統合判定が `approved` になってから進める。
- 実装タスクが分離できる場合だけ、Implementer を複数に分ける。
- QA Agent は、実装前のE2Eテスト設計レビューと、実装後のE2E結果確認の2回使ってよい。
- PR作成後の QA Agent と Reviewer は並列で走らせてもよい。
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
