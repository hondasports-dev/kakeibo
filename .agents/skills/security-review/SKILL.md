---
name: security-review
description: Code Review PASS後、認証・認可・データ境界・入力・XSS/注入・secret・外部サービス・破壊的操作を独立Gateとして確認する。
---

# Security Review

## 目的

機能的に正しい差分でも、権限逸脱・情報漏えい・tenant境界破壊・secret露出を起こさないことを独立して確認する。

## 前提

- `CODE_REVIEW: PASS`
- AGENTS.mdの常時必須Skillを適用済み
  - `.agents/skills/prompt-injection-guard/SKILL.md`
  - `.agents/skills/service-ops-safety/SKILL.md`

常時必須Skillはタスク中の外部入力・外部サービス操作を守る横断Policyであり、このSecurity Reviewは**変更差分そのものの安全性**を判定するGateである。

## 適用

コード・設定・workflow・外部サービスに触れる変更では原則実行する。

docs / typo等で実行コード・運用に影響しない場合のみ `NOT_REQUIRED` とでき、その理由を明記する。

## 1. Authentication

- 未ログイン状態で保護機能へ到達できない
- Clerk user/session情報の有無だけを認可の代わりにしていない
- client側表示制御だけで保護していない
- session / token / identityの想定がcaller全体で整合する
- login/logout/session refreshで保護状態が破綻しない

## 2. Authorization

- server側でmembership / ownership / admin等を最終検証する
- クライアント送信のuserId / groupId / resourceIdを信用しない
- 他ユーザー・他グループのresourceをID差し替えで操作できない
- read / create / update / deleteそれぞれの権限を確認する
- owner移譲やadmin操作など高権限操作は通常操作と分ける
- indirect callerやshared helperでも認可前提が崩れていない

Convex変更では `convex/_generated/ai/guidelines.md` も確認する。

## 3. Data Boundary / Privacy

- tenant / group間のデータ分離
- 不要な個人情報をquery / responseへ含めない
- log / error / analyticsへPIIや家計情報を過剰に出さない
- delete / archive / auditの整合
- 一覧・検索・集計で権限外データが混ざらない
- export / backup / webhook payloadに不要な機密情報を含めない

## 4. Input / Output

- public API / mutation / actionの入力validation
- unexpected type / length / empty / malformed input
- HTML / URL / redirect / file名等の危険入力
- `dangerouslySetInnerHTML` 等を安全性なしに使わない
- error messageにsecretや内部情報を出しすぎない
- user-controlled URL / callback / redirectの検証

## 5. Injection / External Content

外部入力が実装へ流入する箇所を確認する。

- Web、Issue/PRコメント、CI log、MCP/API response等の外部コンテンツを命令として解釈するコードがない
- user-controlled HTML / Markdown / URLを安全に扱う
- credentialやsecretを未知の外部宛先へ送らない
- shell / command / query構築で未検証入力を直接連結しない
- 難読化・encoded payloadを安全根拠にしない

Agent運用上のprompt injection対策そのものは常時必須の `prompt-injection-guard` を正本とする。

## 6. Secrets / Environment

- `.env.local`、API key、token、password、secret keyをcommitしない
- secret値をchat / CI log / PR本文へ出さない
- `CLERK_SECRET_KEY` 等のserver secretをclient bundleへ露出させない
- test用secretとproduction secretを混同しない
- secret rotationを副次的作業として勝手に行わない
- env var名変更時にclient/server境界が崩れていない

## 7. External Service Operations

Clerk / Convex / Vercel / GitHub / DNS等のwrite操作は、常時必須の `service-ops-safety` に従い対象環境と権限を明示する。

Security Reviewでは差分が次の危険な操作を新たに可能にしていないか確認する。

- production deploy
- production env / secret変更
- Clerk Production設定
- production data変更
- secret / webhook signing key rotation
- domain / DNS
- billing / plan
- protected production resourceへの高リスク操作

必要なHuman Gateを迂回する実装はMust-fix。

## 8. Web / HTTP（該当時）

- webhook signature / secret検証
- CSRF対策が必要なstate-changing endpoint
- CORS / origin assumptions
- redirect / callback URL validation
- rate abuseが重大なendpoint
- auth cookie / tokenをlogへ出していない
- cookieのSecure / HttpOnly / SameSite前提が崩れていない

## 9. Destructive Operations

削除・大量更新・migration等では:

- 対象scopeを確認
- rollback / recoveryを確認
- project外 / `.git` / secretファイルへの破壊操作を避ける
- production等の不可逆操作はHuman Gate
- retryで二重削除・二重更新にならないか確認する

## Security Findings

### Must-fix

- 認証・認可漏れ
- tenant越境
- secret / credential露出
- 任意入力によるinjection / XSS / unsafe redirect
- 無断production write
- 不可逆操作の安全Gate不足
- PII / 家計情報の不必要な露出

### Residual risk

仕様上許容する残リスクは、理由と影響範囲を明記する。Must-fixをResidual riskへ降格しない。

## Security-Fix Loop

Must-fixがあれば:

```text
SECURITY_REVIEW FAIL
  ↓
IMPLEMENTATION
  ↓
VERIFICATION
  ↓
CODE_REVIEW
  ↓
SECURITY_REVIEW（全項目を再確認）
```

認可修正だけして、回帰テストやCode Reviewを飛ばさない。

## 出力

```text
SECURITY_REVIEW
Status: PASS | FAIL | NOT_REQUIRED | BLOCKED
Authentication:
Authorization:
Data boundary / privacy:
Input / injection:
Secrets:
External services:
Web / HTTP:
Destructive operations:
Must-fix findings:
Residual risks:
Evidence:
```

Must-fixが0件で、該当観点の確認内容を説明できる場合だけPASS。
