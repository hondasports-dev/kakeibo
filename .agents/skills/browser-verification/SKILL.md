---
name: browser-verification
description: このリポジトリでChrome DevTools MCPを使い、ローカルまたはpreviewのUI挙動、Vite画面、Console issue、Network request、DOM状態、スクリーンショットを確認するときに使う。
---
# ブラウザ確認

このリポジトリでは、Chrome DevTools MCPを主なブラウザ確認ツールとして使います。セットアップ詳細の正本は `docs/service-tooling-setup.md` です。

## Codex / Devin 共通の委譲ルール

- Codexでは、ユーザーが「必要に応じてサブエージェントを起動してよい」と明示した場合、それを単なる許可ではなく、ブラウザ確認を独立して進められる局面で実行時サブエージェント起動を要求する指示として扱う。
- Codexでサブエージェント機能が未ロードなら、まず `tool_search` で multi-agent / spawn 系ツールを探す。`multi_agent_v1.spawn_agent` が使える場合は、`ブラウザ確認 サブエージェントを起動` という名前をプロンプトに含め、`agent_type: qa_agent` で起動する。
- Codexでブラウザ確認のサブエージェント起動条件を満たす場合は、メインエージェントだけで代替せず、対象URLと確認範囲を渡して実行時サブエージェントを起動する。
- Devinでは、同じ指示をブラウザ確認担当への委譲許可として扱う。
- サブエージェントへ渡す場合も、このSkillと `service-ops-safety` の安全条件を必ず継承する。
- 対象URL、viewport、確認するユーザーフロー、触ってよい環境を明示する。
- secret、個人情報、本番管理画面、機密性の高いサービスダッシュボードを表示しているページは、サブエージェントにも開かせない。
- 実行時サブエージェントが利用できない環境では、利用できない理由を明記してから、メインエージェントが同じ確認を行う。

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
