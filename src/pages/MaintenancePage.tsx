import { PublicStatusPage } from "../components/PublicStatusPage";

export function MaintenancePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <PublicStatusPage
      brandImage={{
        alt: "Suzumemo スズメモ",
        src: "/suzumemo-logo-lockup.png",
        width: "min(180px, 60vw)",
      }}
      description="Suzumemo を安心して使えるように、ただいま整えています。しばらく時間をおいてから、もう一度お試しください。"
      label="Maintenance"
      primaryAction={{ label: "再読み込み", onClick: handleReload }}
      secondaryActions={[
        { label: "プライバシーポリシー", href: "/privacy" },
        { label: "利用規約", href: "/terms" },
      ]}
      title="ただいまメンテナンス中です"
    />
  );
}
