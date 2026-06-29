import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { CategorySettingsPanel } from "../components/CategorySettingsPanel";
import { GroupDangerZone, GroupSettingsPanel } from "../../group-admin";
import { WeekDaySettingsPanel } from "../components/WeekDaySettingsPanel";
import { SettingsSectionErrorBoundary } from "../components/SettingsSectionErrorBoundary";

export function SettingsPage() {
  return (
    <Box className="app-main">
      <Stack spacing={3.5}>
        <Box>
          <Typography component="h1" variant="h5">
            設定
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
            グループやカテゴリ、週の設定を確認・管理します。
          </Typography>
        </Box>

        <Paper className="settings-ledger" data-testid="settings-ledger" elevation={0}>
          <Box className="settings-ledger-section">
            <SettingsSectionErrorBoundary>
              <GroupSettingsPanel includeDangerZone={false} />
            </SettingsSectionErrorBoundary>
          </Box>
          <Divider />
          <Box className="settings-ledger-section">
            <SettingsSectionErrorBoundary>
              <CategorySettingsPanel />
            </SettingsSectionErrorBoundary>
          </Box>
          <Divider />
          <Box className="settings-ledger-section">
            <SettingsSectionErrorBoundary>
              <WeekDaySettingsPanel />
            </SettingsSectionErrorBoundary>
          </Box>
          <Divider />
          <Box className="settings-ledger-section settings-ledger-section--danger">
            <SettingsSectionErrorBoundary>
              <GroupDangerZone />
            </SettingsSectionErrorBoundary>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
