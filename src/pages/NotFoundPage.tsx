import { PublicStatusPage } from "../components/PublicStatusPage";

export function NotFoundPage() {
  return (
    <PublicStatusPage
      brandImage={{ alt: "Suzumemo", src: "/suzumemo-app-icon.png", width: 64 }}
      description="指定されたページは移動または削除された可能性があります。ホームからもう一度お探しください。"
      label="404 Not Found"
      primaryAction={{ label: "ホームへ戻る", href: "/" }}
      secondaryActions={[
        { label: "プライバシーポリシー", href: "/privacy" },
        { label: "利用規約", href: "/terms" },
      ]}
      title="ページが見つかりません"
    />
  );
}
