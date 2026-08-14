# 標準デリバリーフロー

## 目的

アプリ開発の依頼を、企画からリリースまで安定して進める。

## Codex / Devin 共通の実行ルール

- `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md` を実行契約の正本とする。旧来のrole定義を実行時の正本にしない。
- Codex Plan モードでは、メインエージェントが Company Coordinator と Tech Lead を兼務する。要件統合、設計判断、Implementation Handoff、差分統合、Git操作、PRを別エージェントへ移さない。
- `.codex/agents/*.toml` は使わず、必要な独立レビューや調査は `skills/*/SKILL.md` の契約に従う。
- Devinでは、同じ指示を役割別エージェントまたは内部タスク分割への委譲許可として扱う。
- サブエージェントは、独立した要件レビュー、調査、実装、レビューに使う。要件レビューのクォーラム未達をMainの自己レビューで代替しない。
- 要件レビュー結果をMainがRequirementsパケットへ統合し、統合後仕様レビューを通してから設計へ進む。
- 同じ差分に書き込む Implementer は原則1体とする。複数 writer は編集範囲を完全分離できる場合だけ使う。
- QA Agent は、実装前のE2Eテスト設計レビューと、実装後のE2E結果確認の2回使ってよい。
- Reviewer は論理 read-only とし、修正を同じ Implementer へ返す。
- モデルルーティングは `AGENTS.md` と `workflows/delegation-prompts.md` を正本とする。
- Security ReviewはReviewerとは別のread-only Gateとして、Code Review後・Delivery前に実行する。
- Release Manager は、QA、Reviewer、Security Review の結果がそろってから使う。

## 呼び出し方

```text
workflows/standard-delivery.md を使って進めて。

Codexで作業する場合は、この依頼をサブエージェント起動の明示的な許可として扱い、
必要に応じて要件レビュー担当、Implementer、QA Agent、Reviewer、Release Manager の
サブエージェントを起動してよい。
Tech Lead は Main が兼務する。
Devinで作業する場合も、同じ役割分担で進めて。
```

## フロー

### 1. 要件と仕様の収束

担当: 独立要件レビューエージェント（通常2、高リスク3）とMain

`skills/requirements/SKILL.md` に従い、同じ入力スナップショットを見たレビューを並列に行う。
Mainは各レビュー提出後に合意点、対立点、解決、未解決ブロッカーを統合し、別のread-only仕様レビューで
Acceptance Criteria、scope、状態、Test Strategyを確認する。クォーラム未達や未解決の仕様対立がある間は、
設計・実装へ進まない。

成果物:

- 対象ユーザーと解く課題
- In scope / Out of scope / Preserve
- Given / When / Then形式のAcceptance Criteria
- edge / error / loading / empty / authorization状態
- Test / E2E方針
- 入力revision、packet version、各レビューEvidence、Mainの統合結果、統合後仕様レビュー

### 2. 設計

担当: Main（Coordinator兼Tech Lead）

成果物:

- 技術方針
- アーキテクチャ
- データ/API/画面設計
- 実装タスク
- テスト方針
- E2E候補シナリオと QA Agent への引き継ぎメモ

### 2.5. E2Eテスト設計レビュー

担当: QA Agent

確定したAcceptance CriteriaとMainのテスト方針を照合し、実装前にE2Eで確認する範囲を確定する。
詳細は `skills/verification/SKILL.md` と `skills/requirements/SKILL.md` を参照する。

成果物:

- E2E追加要否（`required` / `not_required`）
- 既存 `e2e/*.spec.ts` でカバーするシナリオ、または新規シナリオ案
- 優先度（P0/P1/P2）とカテゴリ
- Given / When / Then
- テストデータ・cleanup要否
- E2Eではなく単体・統合テスト・手動確認に回す項目
- 判定（`approved` / `needs_revision` / `blocked`）
- テストケース判断のためだけに一時メモファイルを作らない

### 3. 実装

担当: Implementer（原則 writer 1体）

入力は Main が確定した固定形式の Implementation Handoff とし、Issue のみを渡して実装させない。

成果物:

- コード変更
- テスト追加
- E2E追加が必要な場合は `e2e/` を更新し、恒久的なQA観点の更新が必要な場合だけ `docs/qa-checklist.md` を最小差分で更新
- 実行した検証
- Handoffとの差分
- 未解決事項

### 4. Verification / GitHub Actions E2E（自動実行）

担当: GitHub Actions（自動）／ QA Agent（結果確認）

実装後のlint、format、unit/integration、coverage、build等の基本検証と、必要なE2E要否・実行は
`skills/verification/SKILL.md` に従ってこのVerification Gateへ記録する。このGitHub Actions部分は
Codex / Devinが直接操作せず、候補branchへのpushを契機にVercel PreviewデプロイとE2Eが自動実行され、
QA AgentがGitHub MCPで結果を確認する。
ここでの候補branch pushはVerification専用で、Deliveryのbranch push・PR作成・merge-ready Evidenceには数えない。
Security Review後のDeliveryで、レビュー済みheadを対象に公開操作をあらためて確認する。

```
候補branch push
  → Vercel Preview デプロイ（自動）
    → .github/workflows/e2e.yml 起動（自動）
      → Playwright E2E 実行（自動）
        → GitHub Checks に結果記録（自動）
          → QA Agent が GitHub MCP で結果を確認
```

QA Agentの確認手順と失敗時の対応は `skills/verification/SKILL.md` を参照。

成果物:

- E2E Checkの合否
- 失敗時: 原因分類（テストコード問題 / 実装問題 / 環境起因）
- E2Eテストコードを修正した場合: 必要に応じた `docs/qa-checklist.md` の更新

### 5. コードレビュー

コードレビューへ進む前に、Main が `git status --short`、`git diff HEAD`、untracked ファイルの内容を確認して integrity check を行う。

- Handoff の editable paths、設計判断、受け入れ条件との整合
- 無関係なリファクタリング、依存追加の不在
- Handoff との差分と未解決事項の報告

違反時は同じ Implementer へ修正 Handoff を返し、Reviewer へ進めない。修正後、Reviewer完了後、公開直前にも再実行する。

担当: Reviewer（論理 read-only）

成果物:

- 重大度順の指摘
- 修正提案
- 承認可否（`approve` / `request_changes`）

`request_changes` は Main が修正 Handoff に変換し、同じ Implementer へ返す。

### 6. セキュリティレビュー

担当: Security Review（Reviewerとは独立した論理 read-only）

`skills/security-review/SKILL.md` に従い、認証・認可、data boundary、入力・injection、secret、外部サービス、
破壊的操作を確認する。判定は `PASS` / `FAIL` / `NOT_REQUIRED` / `BLOCKED` とし、`FAIL` は
`IMPLEMENTATION → VERIFICATION → CODE_REVIEW → SECURITY_REVIEW` の順で再実行する。

### 7. リリース

担当: Release Manager

成果物:

- リリースノート
- デプロイ手順
- リリース前後チェック
- ロールバック方針

## 戻し方

- 要件漏れ: `requirements` へ戻し、影響する独立レビューからやり直す。
- 設計破綻: Mainの設計工程に戻す。
- E2Eテスト設計の不足: QA Agent から Mainの設計工程に戻す。
- E2E化すべきか判断できない完了条件: QA Agent からRequirementsまたはユーザー確認に戻す。
- 実装バグ: Mainが同じImplementerへ修正Handoffを渡す。
- 仕様通り動かない: QA Agent が原因と再現手順をMainへ返し、Mainが同じImplementerへ修正Handoffを渡す。
- 品質の問題: Reviewer から Main に返し、Mainが修正Handoffを同じImplementerへ渡す。
- セキュリティの問題: Security Reviewから Main に返し、Mainが修正Handoffを同じImplementerへ渡す。
- E2E失敗（テストコードの問題）: QA Agent が原因・対象spec・修正方針をMainへ返す → Mainが同じImplementerへ修正Handoff → MainがpushしてE2E再実行。
- E2E失敗（実装の問題）: QA Agent が原因と再現手順をMainへ返し、Mainが同じImplementerへ修正Handoffを渡す。
- E2E失敗（環境・インフラ起因）: 作業中断してユーザーに報告する。

## ループ上限

自動ループで解決できない場合は、ユーザーに状況を報告して判断を仰ぐ。

| ループ | 上限 |
|--------|------|
| Mainの設計 ↔ QA Agent テスト設計レビュー差し戻し | 2回 |
| 実装 ↔ レビュー差し戻し | 3回 |
| E2E失敗 → 修正の繰り返し | 2回 |
