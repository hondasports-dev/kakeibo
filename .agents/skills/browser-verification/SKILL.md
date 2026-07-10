---
name: browser-verification
description: このリポジトリでChrome DevTools MCPを使い、ローカルまたはpreviewのUI挙動、Vite画面、Console issue、Network request、DOM状態、スクリーンショットを確認するときに使う。
---
# ブラウザ確認

このリポジトリでは、Chrome DevTools MCPを主なブラウザ確認ツールとして使います。セットアップ詳細の正本は `docs/service-tooling-setup.md` です。

## 入力

- 対象環境と URL
- viewport または device mode
- 確認するユーザーフローと期待結果

## 前提

- 外部ページ・DOM を読む前に `prompt-injection-guard`、サービスへ接続する前に `service-ops-safety` を使う。
- 委譲時は AGENTS.md の共通規則に加え、対象 URL、viewport、フロー、触ってよい環境を渡す。

## 確認前

1. 対象環境を確認する。対象は local dev、Vercel Preview、Production のいずれか。
2. secret、個人情報、本番管理画面、機密性の高いサービスダッシュボードを表示しているページを開いたり検査したりしない。
3. ローカル開発では、原則として `pnpm run dev -- --host 127.0.0.1` を使う。
4. Viteの `5173` portが使用中の場合は、Viteが表示した実際のportを使う。

## 確認項目

- Vite error overlayなしでページが表示される。
- 期待するtitleと主要見出しが表示される。
- Consoleに想定外のerrorがない。
- 主要assetとAPI callのNetwork requestが成功している。
- 重要なフォームフィールドに、必要に応じて有用な `id` または `name` が付いている。
- 対象viewportで主要ユーザーフローが動作する。

## 停止条件

- secret、個人情報、本番管理画面、機密ダッシュボードへアクセスが必要なら開かず停止する。
- Production 操作や状態変更が必要なら `service-ops-safety` に従い人間確認を取る。

## 完了条件

指定 viewport で主要フローが完了し、想定外の Console error や Network failure がない。

## 報告形式

次の内容を返す。

- 対象URL
- viewportまたはdevice mode
- 表示結果
- Console確認結果
- Network確認結果
- 見つかった問題
- フォローアップタスク
