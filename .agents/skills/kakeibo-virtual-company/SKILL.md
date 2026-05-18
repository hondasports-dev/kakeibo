---
name: kakeibo-virtual-company
description: kakeiboリポジトリで仮想ソフト開発会社のワークフローを使い、役割選択、作業分解、Product Lead、Tech Lead、Implementer、QA Agent、Reviewer、Release Managerへの分担、market-to-build / standard-deliveryワークフローの選択を行うときに使う。通常の小さなコード修正では、役割分担が明示的に必要な場合だけ使う。
---
# Kakeibo 仮想ソフト開発会社

このSkillは、リポジトリ内の役割分担ワークフローを使うための入口です。すべての役割ドキュメントを最初から読み込まず、現在の依頼に必要なものだけを参照します。

## Codex / Devin 共通の委譲ルール

- `agents/` 配下のファイルは、役割別の指示書として扱う。
- Codexでは、ユーザーが「必要に応じてサブエージェントを起動してよい」と明示した場合だけ、実行時サブエージェントへ委譲してよい。
- Devinでは、同じ指示を役割別エージェントまたは内部タスク分割への委譲許可として扱う。
- 実行時サブエージェントが利用できない環境では、メインエージェントが必要な役割指示書を読み、同じ順序で作業する。
- サブエージェントへ委譲する場合は、担当範囲、編集してよいファイル、成果物、検証方法を明示する。
- 他のエージェントやメインエージェントの変更を戻さないよう、各サブエージェントに明記する。

## 参照元ドキュメント

- `COMPANY.md`: 役割構成と運用原則
- `OPERATING_MANUAL.md`: 使い方の例と並列化ルール
- `agents/00-company-coordinator.md`: 作業分解の入口
- `agents/01-product-lead.md`: プロダクト、ユーザー、MVP、成功指標
- `agents/02-tech-lead.md`: アーキテクチャ、作業分解、技術リスク
- `agents/03-implementer.md`: 実装とテスト
- `agents/04-qa-agent.md`: 受け入れ確認、回帰確認、不具合報告
- `agents/05-reviewer.md`: コード品質、保守性、セキュリティ
- `agents/06-release-manager.md`: リリースノート、デプロイ、ロールバック
- `agents/optional-ux-ui-designer.md`: UI/UXが重要なタスクのみ
- `workflows/market-to-build.md`: 市場調査から開発までのワークフロー
- `workflows/standard-delivery.md`: 標準デリバリーフロー

## 使い方

1. 依頼を分解する必要がある場合は、`agents/00-company-coordinator.md` から始める。
2. 現在の作業に必要な役割ファイルだけを読む。
3. 小さく範囲が明確な実装やレビューでは、すべての役割を使わない。
4. ユーザー、市場、MVP範囲が曖昧な場合は、Tech Leadより先にProduct Leadを使う。
5. アーキテクチャ、データモデル、技術リスクが曖昧な場合は、Implementerより先にTech Leadを使う。
6. 実装後にQA AgentとReviewerを使う。必要なら並列で実行してよい。
7. Release Managerは、リリース、デプロイ、ロールバック、本番影響がある場合だけ使う。
8. 市場調査では、ユーザーが明示的に案を承認するまで実装へ進まない。
9. Codexでサブエージェントを起動する場合は、直前に委譲理由と担当範囲を整理する。

## 出力

次の内容を返す。

- ゴール
- 選択した役割
- 実行順序
- 選択した役割への依頼文または引き継ぎメモ
- リスクと未解決の確認事項
