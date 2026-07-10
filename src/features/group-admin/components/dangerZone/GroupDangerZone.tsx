import { GroupSettingsProvider, useHasGroupSettingsProvider } from "../GroupSettingsProvider";
import { GroupDangerZoneContent } from "./GroupDangerZoneContent";

export function GroupDangerZone() {
  const hasProvider = useHasGroupSettingsProvider();
  if (hasProvider) return <GroupDangerZoneContent />;
  return (
    <GroupSettingsProvider>
      <GroupDangerZoneContent />
    </GroupSettingsProvider>
  );
}
