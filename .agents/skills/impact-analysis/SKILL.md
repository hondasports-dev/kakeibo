---
name: impact-analysis
description: 仕様確定後、編集前に変更対象のcaller/callee、共有状態、認証認可、データ、テスト、UI、外部サービス、デプロイ影響を調査する。
---

# Impact Analysis

## 目的

「変更するファイル」だけでなく、**その変更が壊しうる範囲**を実装前に把握する。

過去の障害で起きた「対象箇所だけを見て共通認証・共有状態・別画面への影響を見落とす」パターンを防ぐためのGateである。

## 入力

- REQUIREMENTS PASS成果物
- 現在のbaseとの差分予定
- 関連コード / tests / docs

## 調査順序

1. **変更surface**
   - 直接編集する予定のmodule / component / Convex function / config
2. **caller**
   - 誰がそのAPI、関数、component、hook、型、定数を使っているか
3. **callee / dependency**
   - 変更対象が依存するAPI、shared helper、provider、external service
4. **shared state**
   - React context/provider、cache、local/session state、Convex data、共通設定
5. **認証・認可境界**
   - Clerk session / user
   - group membership / ownership / admin
   - server側で最終認可しているか
6. **データ境界**
   - schema / validator / migration / existing data
   - tenant/group間の分離
   - delete / archive / auditへの影響
7. **UI影響**
   - 同じcomponent / hookを使う別画面
   - loading / empty / error / responsive
8. **テスト影響**
   - 既存unit/component/Convex/E2E
   - fixture / mock / test user / shared DB
9. **運用・外部サービス**
   - Convex deployment
   - Clerk
   - Vercel / GitHub Actions
   - env / secret / webhook
10. **変更しない範囲**
   - 無関係なリファクタや依存更新を明示的に除外する

## 検索の原則

- symbol名だけでなく型、route、component名、API名、環境変数名でも利用箇所を探す。
- 共通moduleを変更する場合は「今のIssueで使う経路」以外の利用者も確認する。
- 認証・認可・schema・shared state変更は高リスクとして扱う。
- Convexを変更する場合は `convex/_generated/ai/guidelines.md` を確認する。

## リスク分類

```text
low    : 局所変更。利用箇所・テスト範囲が限定的
medium : 複数画面 / 共通module / API契約へ波及
high   : auth、authorization、schema、migration、shared state、production/external service
```

`high` の場合は、実装前に影響範囲とrollback / recovery観点を明示する。

## ハードストップ

次が不明なまま `PASS` にしない。

- 主要caller / callee
- shared stateへの影響
- auth / data boundary（該当時）
- regression確認先
- schema / migrationの扱い（該当時）
- 外部サービス / env変更先環境（該当時）

## 出力

```text
IMPACT_ANALYSIS
Status: PASS | BLOCKED
Risk: low | medium | high
Direct changes:
Callers:
Callees / dependencies:
Shared state:
Auth / authorization:
Data / schema:
Affected UI / flows:
Regression tests:
External / deploy impact:
Out-of-scope surfaces:
Recovery / rollback considerations:
Evidence:
```

PASS後だけ `implementation` へ進む。