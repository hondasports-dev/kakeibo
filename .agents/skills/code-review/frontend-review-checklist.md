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
