# 標準デリバリーフロー

## 目的

アプリ開発の依頼を、企画からリリースまで安定して進める。

## Codex / Devin 共通の実行ルール

- `agents/` 配下のファイルは、役割別の指示書として扱う。
- Codexでは、ユーザーが「必要に応じてサブエージェントを起動してよい」と明示した場合だけ、実行時サブエージェントへ委譲してよい。
- Devinでは、同じ指示を役割別エージェントまたは内部タスク分割への委譲許可として扱う。
- 実行時サブエージェントが利用できない環境では、メインエージェントが必要な役割指示書を読み、同じ順序で作業する。
- Product Lead と Tech Lead は、要件が曖昧な間は順番に進める。
- Implementer は、担当範囲が分離できる場合だけ複数に分ける。
- QA Agent と Reviewer は、実装後に並列で実行してよい。
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

### 3. 実装

担当: Implementer

成果物:

- コード変更
- テスト追加
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

QA Agentの確認手順と失敗時の対応は `agents/04-qa-agent.md` を参照。

成果物:

- E2E Checkの合否
- 失敗時: 原因分類（テストコード問題 / 実装問題 / 環境起因）
- E2Eテストコードを修正した場合: `docs/e2e-test-cases.md` の更新

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
| 実装 ↔ レビュー差し戻し | 3回 |
| E2E失敗 → 修正の繰り返し | 2回 |
