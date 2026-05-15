---
name: kakeibo-browser-verification
description: kakeiboでChrome DevTools MCPを使い、ローカルまたはpreviewのUI挙動、Vite画面、Console issue、Network request、DOM状態、スクリーンショットを確認するときに使う。
---
# Kakeibo ブラウザ確認

このリポジトリでは、Chrome DevTools MCPを主なブラウザ確認ツールとして使います。セットアップ詳細の正本は `SERVICE_TOOLING_SETUP.md` です。

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

## 報告形式

次の内容を返す。

- 対象URL
- viewportまたはdevice mode
- 表示結果
- Console確認結果
- Network確認結果
- 見つかった問題
- フォローアップタスク
