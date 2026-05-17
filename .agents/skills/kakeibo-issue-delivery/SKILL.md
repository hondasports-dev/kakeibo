---
name: kakeibo-issue-delivery
description: GitHub Issue番号を受け取り、仕様検討→TDD実装→コードレビュー→GitHub Actions E2E確認までを自動ループして1つのIssueを解決する。
argument-hint: "<issue番号>"
triggers:
  - user
---

# Kakeibo Issue Delivery

このSkillは、1つのGitHub Issueを起点に、仕様検討からE2E確認までの開発サイクルを
自動ループして解決する。

## 前提

- Issue番号を引数として受け取る（例: `/kakeibo-issue-delivery 21`）。
- 作業前に `kakeibo-service-ops-safety` の確認事項を満たしていること。
- GitHub MCP が利用可能であること（E2E結果の確認に使用する）。

## ループ上限

| ループ | 上限 |
|--------|------|
| 実装↔レビューの差し戻し | 3回まで |
| E2E失敗→修正の繰り返し | 2回まで |
| 上限超過時 | 作業を中断し、ユーザーに状況を報告して判断を仰ぐ |

---

## フェーズ1: Issue読み込みと仕様確定

担当ロール: Tech Lead（`agents/02-tech-lead.md` を参照）

### 手順

1. GitHub MCP で Issue #$ARGUMENTS の本文・コメント・ラベルをすべて取得する。
2. `REQUIREMENTS.md`、`TECHNICAL_DESIGN.md`、`docs/development-process.md` を読む。
3. `agents/02-tech-lead.md` の依頼テンプレートに従い、次の成果物をまとめる。

### 成果物

- **仕様サマリー**: 解くべき課題・完了条件・スコープ外
- **技術方針**: 変更するファイル・新規作成するファイル・影響範囲
- **実装タスクリスト**: 順番付きの具体的なタスク（各タスクは独立してテスト可能な粒度）
- **テスト方針**: 追加すべき単体テスト・E2Eシナリオの概要
- **技術リスク**: 懸念点と代替案

### 完了条件

- 実装タスクリストが確定し、担当ロール（Implementer）に引き渡せる状態になっている。

---

## フェーズ2: TDD実装ループ

担当ロール: Implementer（`agents/03-implementer.md` を参照）

### 手順

1. `agents/03-implementer.md` のブランチ運用手順に従い、作業ブランチを作成する。
   - ブランチ名: `feature/issue-$ARGUMENTS-{短い説明}`
2. フェーズ1の実装タスクリストを1タスクずつ、次のTDDサイクルで進める。
   a. **Red**: 失敗するテストを先に書く。
   b. **Green**: テストが通る最小限の実装をする。
   c. **Refactor**: コードを整理する（テストが通ったままであること）。
3. 全タスク完了後、以下をすべてローカルで通す。
   - `pnpm test --run`
   - `pnpm run lint`
   - `pnpm run build`
4. コミットして作業ブランチをpushし、PRを作成する。
   - PRには Issue #$ARGUMENTS へのリンクを含める。

### 差し戻し時の動作

- フェーズ3（レビュー）から差し戻されたら、指摘内容を確認し修正して再pushする。
- フェーズ4（E2E）から差し戻されたら、実装の問題を修正して再pushする。

### 完了条件

- 全テストが通っている。
- lint・buildが通っている。
- PRが作成されている。

---

## フェーズ3: コードレビュー

担当ロール: Reviewer（`agents/05-reviewer.md` を参照）

### 手順

1. `agents/05-reviewer.md` の判断基準に従い、PRの差分をレビューする。
2. 重大度順に指摘をまとめ、GitHub PRの該当コード行にインラインコメントを投稿する。
3. 判定を返す。

### 判定と次のアクション

| 判定 | 次のアクション |
|------|---------------|
| `approve` | フェーズ4へ進む |
| `request_changes` | 指摘内容をフェーズ2（Implementer）へ差し戻す |

### 完了条件

- `approve` 判定が出ている。

---

## フェーズ4: GitHub Actions E2E（非同期）

このフェーズはDevinが直接操作するものではない。

PRのpushをトリガーに自動で起動される。

1. Vercel が Preview デプロイを作成する。
2. `deployment_status` イベントで `.github/workflows/e2e.yml` が起動される。
3. Playwright (Chromium) でE2Eテストが実行される。
4. 結果がGitHub Checksに記録される。

**Devinの役割**: フェーズ5でCheckの完了を確認するまで待機する。

---

## フェーズ5: E2E結果確認ループ

担当ロール: QA Agent（`agents/04-qa-agent.md` を参照）

### 手順

1. GitHub MCP の `get_pull_request_checks` でPRのCheck状況を取得する。
2. Check が `pending` / `queued` の場合は60秒待機して再確認する（最大20分）。
3. Check が `success` の場合はフェーズ6へ進む。
4. Check が `failure` の場合は、Artifactのログを取得して原因を分析する。

### 失敗時の原因分類と差し戻し先

| 原因 | 対応 |
|------|------|
| E2Eテストコードの問題（テストシナリオ漏れ・ロケーター誤り等） | `e2e/` を修正してpush → フェーズ4に戻る |
| 実装コードの問題（機能が仕様通り動いていない） | フェーズ2（Implementer）へ差し戻す |
| 環境・インフラ起因（Vercelデプロイ失敗・secrets未設定等） | 作業を中断してユーザーに報告する |

### 完了条件

- GitHub Checks がすべて `success` になっている。

---

## フェーズ6: 完了報告

### 報告内容

- 解決した Issue 番号と概要
- 作成したPRのURL
- 実装タスクの完了状況
- 追加・更新したテストの一覧
- E2Eテスト結果
- 残るリスクや今後の課題（あれば）

---

## 打ち切り条件

次のいずれかに該当した場合、作業を中断してユーザーに状況と判断を報告する。

- 実装↔レビューの差し戻しが3回を超えた。
- E2E失敗→修正が2回を超えた。
- 環境・インフラ起因のエラーが解消できない。
- フェーズ1の仕様確定で、Issueの情報だけでは判断できない重大な曖昧さがある。
