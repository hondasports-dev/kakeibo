# フロントエンド レビュー観点

## 正しさ

- ローディング／エラー／空状態が適切に扱われている
- `null`／`undefined`／空配列／`0` などの扱いが明確

## React

- render 中に副作用がない
- derived state を不要に state 化していない
- `useEffect` の依存配列が適切（過不足がない）

## Convex React

- `useQuery` / `useMutation` の引数が安定している
- mutation 失敗時のエラー表示が一貫している

## TypeScript

- `any` が無い
- API の不整合は境界層で吸収されている

## UI/UX・アクセシビリティ

- クリック可能要素の a11y が担保されている
- リストの `key` が安定している
- Playwright ロケーターが strict mode に抵触しない（同名ボタンは `getByTestId` 等で限定）

## 保守性

- 責務分離、命名、重複が適切か
- Convex サーバー実装ファイルを UI から直接 import していないか（共有定数は `convex/lib/` 等）

## テスト

- ユニット / コンポーネントテストが追加・更新されているか
- ユーザー導線の変更に E2E が必要なら追加・更新されているか
- `test-case-review-checklist.md` の観点（正常系・エッジ・準異常・異常系）をカバーしているか
- `expect` の判定が業務仕様と一致し、ただ pass するための値ではないか
