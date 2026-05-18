# セキュリティ方針

## 概要

kakeibo は個人向けMVP Webアプリです。公開範囲を2名に限定し、
Clerk の Restricted mode と invitation によりサインアップを制限しています。

## アクセス制限

- **Clerk Restricted mode** を有効化し、招待制でユーザー登録を制限しています。
- 招待していない Google アカウントではサインアップできません。
- Convex バックエンド側でも `ctx.auth.getUserIdentity()` による認証確認と
  `tokenIdentifier` による所有者チェックを実施し、他ユーザーのデータへのアクセスを拒否します。

詳細は `docs/auth-guard.md` を参照してください。

## 脆弱性の報告

本プロジェクトは個人用MVPのため、公式の脆弱性報告プログラムは設けていません。

問題を発見した場合は、GitHub Issues にてプライベートな内容を含めずに報告するか、
リポジトリオーナーに直接連絡してください。

## シークレット管理

- `.env.local` はリポジトリに含めません（`.gitignore` 済み）。
- シークレットはコード・PRコメント・ログに出力しません。
- GitHub Actions Secrets のみに秘匿情報を保存します。

詳細は `docs/environment-variables.md` を参照してください。
