---
name: workspace-preflight
description: Verify that a repository change starts in an isolated task worktree with a non-protected branch and a known baseline. Use before editing code, configuration, or process files.
---

# Workspace Preflight

このSkillは、リポジトリのファイルを変更するタスクで、Requirementsへ入る前かつ最初の編集前に適用する。常時必須の安全Skillを読んだ後、他の変更工程より先に実行する。

## 実行

タスク用worktreeのrootで次を実行する。

```bash
node scripts/check-task-worktree.mjs --require-clean
```

次のEvidenceが揃うまで、`apply_patch`、エディタ保存、生成物の更新などファイル変更を始めない。

- 終了コード `0`
- 出力 `WORKSPACE_PREFLIGHT status: PASS`
- `main` / `preview` ではないtask branch
- canonical worktreeとは異なる、Gitに登録済みのtask worktree
- preflight開始時点のclean baseline

## FAIL時

FAILしたまま作業を進めない。特に次の場合は、変更を加えずに止める。

- canonical worktreeにいる
- `main` / `preview` にいる
- detached HEAD、またはGitに登録されていない場所にいる
- 開始前から未コミット差分がある

必要なら `git worktree add <task-path> -b codex/<task-name> preview` でtask worktreeを作り、そこでpreflightを再実行する。既存の差分やcanonical worktreeを勝手に消したり戻したりしない。

## 例外

`docs/` 配下、`README.md`、`CHANGELOG.md`だけの文書変更は、別途記録したうえでこのpreflightを省略できる。ユーザーが既存PRへ混ぜる修正を明示した場合も、新しいworktreeの作成自体は省略できるが、既存PRのtask worktreeでpreflightを実行する。`AGENTS.md`、`.loop/`、`skills/`、`scripts/`、設定ファイル、アプリコードは文書扱いにしない。

pre-commit hookの `--staged` チェックは最後の安全網であり、編集前のpreflightの代わりにはならない。

## 安全境界

このSkillとスクリプトはlocal Gitの状態だけを読み取り、secret、env、外部サービス、productionデータを扱わない。preflight自体はbranch作成、checkout、削除、reset、commit、pushを実行しない。
