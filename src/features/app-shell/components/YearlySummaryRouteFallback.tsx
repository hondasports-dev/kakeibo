import { SuzumemoLoadingState } from "../../ui";

export function YearlySummaryRouteFallback() {
  return (
    <SuzumemoLoadingState
      label="年次サマリーを読み込み中"
      message="年次サマリーを読み込んでいます…"
      variant="page"
    />
  );
}
