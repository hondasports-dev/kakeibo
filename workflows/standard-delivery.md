# 標準デリバリーフロー

## 目的

アプリ開発の依頼を、企画からリリースまで安定して進める。

## Codex / Devin 共通の実行ルール

- `.agents/roles/` 配下のファイルは、役割別の指示書として扱う。
- Codexでは、ユーザーが「必要に応じてサブエージェントを起動してよい」と明示した場合、それを単なる許可ではなく、役割分担・並列調査・独立した実装タスクが有効な局面でサブエージェント起動を要求する指示として扱う。
- Codexでサブエージェント機能が未ロードなら、まず `tool_search` で multi-agent / spawn 系ツールを探す。`multi_agent_v1.spawn_agent` が使える場合はそれを使い、プロンプトに「xxx サブエージェントを起動」という役割名を明記する。
- Devinでは、同じ指示を役割別エージェントまたは内部タスク分割への委譲許可として扱う。
- 実行時サブエージェントが利用できない環境では、利用できない理由を明記してから、メインエージェントが必要な役割指示書を読み、同じ順序で作業する。
- Product Lead と Tech Lead は、要件が曖昧な間は順番に進める。
- Implementer は、担当範囲が分離できる場合だけ複数に分ける。
- QA Agent は、実装前のE2Eテスト設計レビューと、実装後のE2E結果確認の2回使ってよい。
- PR作成後の QA Agent と Reviewer は並列で実行してよい。
- Release Manager は、QA と Reviewer の結果がそろってから使う。

## 呼び出し方

```text
workflows/standard-delivery.md を使って進めて。

Codexで作業する場合は、この依頼をサブエージェント起動の明示的な許可として扱い、
必要に応じて Product Lead、Tech Lead、Implementer、QA Agent、Reviewer、Release Manager の
サブエージェントを起動してよい。
Devinで作業する場合も、同じ役割分担で進めて。
```

## フロー

### 1. 企画と要件

担当: Product Lead

成果物:

- 対象ユーザー
- 解く課題
- MVP範囲
- 成功指標
- 作らない機能

### 2. 設計

担当: Tech Lead

成果物:

- 技術方針
- アーキテクチャ
- データ/API/画面設計
- 実装タスク
- テスト方針
- E2E候補シナリオと QA Agent への引き継ぎメモ

### 2.5. E2Eテスト設計レビュー

担当: QA Agent

Product Lead の完了条件と Tech Lead のテスト方針を照合し、実装前にE2Eで確認する範囲を確定する。
詳細は `.agents/roles/04-qa-agent.md` の「E2Eテスト設計レビュー」を参照。

成果物:

- E2E追加要否（`required` / `not_required`）
- 既存 `docs/e2e-test-cases.md` でカバーするシナリオ、または新規シナリオ案
- 優先度（P0/P1/P2）とカテゴリ
- Given / When / Then
- テストデータ・cleanup要否
- E2Eではなく単体・統合テスト・手動確認に回す項目
- 判定（`approved` / `needs_revision` / `needs_discussion`）
- テストケース判断のためだけに一時メモファイルを作らない

### 3. 実装

担当: Implementer

成果物:

- コード変更
- テスト追加
- E2E追加が必要な場合は `e2e/` を更新し、恒久的な台帳更新が必要な場合だけ `docs/e2e-test-cases.md` を最小差分で更新
- 実行した検証
- 未解決事項

### 4. コードレビュー

担当: Reviewer

成果物:

- 重大度順の指摘（GitHubのPRインラインコメントとして投稿）
- 修正提案
- 承認可否（`approve` / `request_changes`）

### 5. GitHub Actions E2E（自動実行）

担当: GitHub Actions（自動）／ QA Agent（結果確認）

このフェーズはCodex / Devinが直接操作しない。PRのpushを契機にVercel Previewデプロイと
E2Eが自動実行され、QA AgentがGitHub MCPで結果を確認する。

```
PR push
  → Vercel Preview デプロイ（自動）
    → .github/workflows/e2e.yml 起動（自動）
      → Playwright E2E 実行（自動）
        → GitHub Checks に結果記録（自動）
          → QA Agent が GitHub MCP で結果を確認
```

QA Agentの確認手順と失敗時の対応は `.agents/roles/04-qa-agent.md` を参照。

成果物:

- E2E Checkの合否
- 失敗時: 原因分類（テストコード問題 / 実装問題 / 環境起因）
- E2Eテストコードを修正した場合: 必要に応じた `docs/e2e-test-cases.md` の更新

### 6. リリース

担当: Release Manager

成果物:

- リリースノート
- デプロイ手順
- リリース前後チェック
- ロールバック方針

## 戻し方

- 要件漏れ: Product Lead に戻す。
- 設計破綻: Tech Lead に戻す。
- E2Eテスト設計の不足: QA Agent から Tech Lead に戻す。
- E2E化すべきか判断できない完了条件: QA Agent から Product Lead またはユーザー確認に戻す。
- 実装バグ: Implementer に戻す。
- 仕様通り動かない: QA Agent から Implementer に戻す。
- 品質やセキュリティの問題: Reviewer から Implementer または Tech Lead に戻す。
- E2E失敗（テストコードの問題）: QA Agent が `e2e/` を修正してpush → E2E再実行。
- E2E失敗（実装の問題）: QA Agent から Implementer に戻す。
- E2E失敗（環境・インフラ起因）: 作業中断してユーザーに報告する。

## ループ上限

自動ループで解決できない場合は、ユーザーに状況を報告して判断を仰ぐ。

| ループ | 上限 |
|--------|------|
| Tech Lead ↔ QA Agent テスト設計レビュー差し戻し | 2回 |
| 実装 ↔ レビュー差し戻し | 3回 |
| E2E失敗 → 修正の繰り返し | 2回 |
