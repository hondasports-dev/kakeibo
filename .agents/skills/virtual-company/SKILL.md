---
name: virtual-company
description: このリポジトリで仮想ソフト開発会社のワークフローを使い、役割選択、作業分解、Product Lead、Tech Lead、Implementer、QA Agent、Reviewer、Release Managerへの分担、market-to-build / standard-deliveryワークフローの選択を行うときに使う。通常の小さなコード修正では、役割分担が明示的に必要な場合だけ使う。
---
# 仮想ソフト開発会社

このSkillは、リポジトリ内の役割分担ワークフローを使うための入口です。すべての役割ドキュメントを最初から読み込まず、現在の依頼に必要なものだけを参照します。

## Codex / Devin 共通の委譲ルール

- `.agents/roles/` 配下のファイルは、役割別の指示書として扱う。
- Codexでは、ユーザーが「必要に応じてサブエージェントを起動してよい」と明示した場合、それを単なる許可ではなく、役割分担・並列調査・独立した実装タスクが有効な局面で `spawn_agent` による実行時サブエージェント起動を要求する指示として扱う。
- Codexで複数ロールまたは独立タスクに分けられる場合は、メインエージェントだけで代替せず、担当範囲を分離して実行時サブエージェントを起動する。
- Devinでは、同じ指示を役割別エージェントまたは内部タスク分割への委譲許可として扱う。
- 実行時サブエージェントが利用できない環境では、メインエージェントが必要な役割指示書を読み、同じ順序で作業する。
- サブエージェントへ委譲する場合は、担当範囲、編集してよいファイル、成果物、検証方法を明示する。
- Implementer 相当のサブエージェントへ委譲する場合、作業ブランチ用の `git worktree` 作成、
  branch作成、stage、commit、push、PR作成はメインエージェントが担当し、サブエージェントには
  作業対象のworktreeパスと禁止操作を明示する。
- 他のエージェントやメインエージェントの変更を戻さないよう、各サブエージェントに明記する。

## 参照元ドキュメント

- `COMPANY.md`: 役割構成と運用原則
- `OPERATING_MANUAL.md`: 使い方の例と並列化ルール
- `.agents/roles/00-company-coordinator.md`: 作業分解の入口
- `.agents/roles/01-product-lead.md`: プロダクト、ユーザー、MVP、成功指標
- `.agents/roles/02-tech-lead.md`: アーキテクチャ、作業分解、技術リスク
- `.agents/roles/03-implementer.md`: 実装とテスト
- `.agents/roles/04-qa-agent.md`: 受け入れ確認、回帰確認、不具合報告
- `.agents/roles/05-reviewer.md`: コード品質、保守性、セキュリティ
- `.agents/roles/06-release-manager.md`: リリースノート、デプロイ、ロールバック
- `.agents/roles/optional-ux-ui-designer.md`: UI/UXが重要なタスクのみ
- `workflows/market-to-build.md`: 市場調査から開発までのワークフロー
- `workflows/standard-delivery.md`: 標準デリバリーフロー

## 使い方

1. GitHub Issue番号を解決・実装・続行・close・deliverする依頼では、まず `$issue-delivery` を優先する。
2. 依頼を分解する必要がある場合は、`.agents/roles/00-company-coordinator.md` から始める。
3. 現在の作業に必要な役割ファイルだけを読む。
4. 小さく範囲が明確な実装やレビューでは、すべての役割を使わない。
5. ユーザー、市場、MVP範囲が曖昧な場合は、Tech Leadより先にProduct Leadを使う。
6. UI/UX変更を含む場合は、Product Lead と合わせて UX/UI Designer を使う。
7. アーキテクチャ、データモデル、技術リスクが曖昧な場合は、Implementerより先にTech Leadを使う。
8. Tech Lead の仕様確定後、E2Eテスト設計が必要な場合はQA Agentで実装前レビューを行う。
9. 実装後にQA AgentとReviewerを使う。必要なら並列で実行してよい。
10. Release Managerは、リリース、デプロイ、ロールバック、本番影響がある場合だけ使う。
11. 市場調査では、ユーザーが明示的に案を承認するまで実装へ進まない。
12. Codexでサブエージェントを起動する場合は、直前に委譲理由と担当範囲を整理する。

## 出力

次の内容を返す。

- ゴール
- 選択した役割
- 実行順序
- 選択した役割への依頼文または引き継ぎメモ
- リスクと未解決の確認事項
