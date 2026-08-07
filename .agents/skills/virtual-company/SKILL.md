---
name: virtual-company
description: このリポジトリで仮想ソフト開発会社のワークフローを使い、役割選択、作業分解、Product Lead、Tech Lead、Implementer、QA Agent、Reviewer、Release Managerへの分担、market-to-build / standard-deliveryワークフローの選択を行うときに使う。通常の小さなコード修正では、役割分担が明示的に必要な場合だけ使う。
---
# 仮想ソフト開発会社

このSkillは、リポジトリ内の役割分担ワークフローを使うための入口です。すべての役割ドキュメントを最初から読み込まず、現在の依頼に必要なものだけを参照します。

## 目的

依頼に必要な役割だけを選び、順序、責任、成果物を明確にして作業を分担する。Codex Plan モードでは、メインエージェントが Coordinator と Tech Lead を兼務する。

## 入力

- ゴール、対象範囲、完了条件
- 独立して進められる調査・実装・検証単位
- 外部操作、秘密情報、production などの制約

## 前提

- `.agents/roles/` を役割指示書として扱い、必要なものだけ読む。
- 委譲は AGENTS.md の共通規則に従い、役割名、担当範囲、成果物、検証方法を明示する。
- branch、worktree、stage、commit、push、PR はメインエージェントが管理する。
- `.codex/agents/*.toml` は使わず、本 Skill、`AGENTS.md`、`.agents/roles/**` を正本とする。
- 同一差分に書き込む Implementer は原則1体とし、Reviewer は論理 read-only とする。

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

1. GitHub Issue番号を解決・実装・続行・close・deliverする依頼では、**AGENTS.md Plan 契約**に従う。
2. Codex Plan モードでは、メインエージェントが `.agents/roles/00-company-coordinator.md` と `.agents/roles/02-tech-lead.md` を参照して依頼を分解・設計する。
3. 現在の作業に必要な役割ファイルだけを読む。
4. 小さく範囲が明確な実装やレビューでは、すべての役割を使わない。
5. ユーザー、市場、MVP範囲が曖昧な場合は、Tech Leadより先にProduct Leadを使う。
6. UI/UX変更を含む場合は、Product Lead と合わせて UX/UI Designer を使う。
7. アーキテクチャ、データモデル、技術リスクが曖昧な場合は、メインエージェントがTech LeadとしてImplementerより先に確定する。
8. Tech Lead の仕様確定後、E2Eテスト設計が必要な場合はQA Agentで実装前レビューを行う。
9. 実装後にQA AgentとReviewerを使う。Reviewerは論理read-onlyで、修正は同じImplementerへ返す。
10. Release Managerは、リリース、デプロイ、ロールバック、本番影響がある場合だけ使う。
11. 市場調査では、ユーザーが明示的に案を承認するまで実装へ進まない。
12. Codexでサブエージェントを起動する場合は、直前に委譲理由と担当範囲を整理する。
13. Implementer には `tdd-implement` の固定形式 Implementation Handoff を渡し、Issue のみを渡して実装させない。

## 停止条件

- 市場調査では、ユーザーが案を承認するまで実装へ進まない。
- production、secret、外部書き込みが必要なら、担当を起動する前にメインエージェントが確認を取る。
- 小さく単一責務の作業に不要な役割を追加しない。

## 完了条件と出力

次の内容を返す。

- ゴール
- 選択した役割
- 実行順序
- 選択した役割への依頼文または引き継ぎメモ
- リスクと未解決の確認事項
