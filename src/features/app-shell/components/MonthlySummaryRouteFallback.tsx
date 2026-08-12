import { SuzumemoLoadingState } from "../../ui";

export function MonthlySummaryRouteFallback() {
  return (
    <SuzumemoLoadingState
      label="月次サマリーを読み込み中"
      message="月次サマリーを読み込んでいます…"
      variant="page"
    />
  );
}
