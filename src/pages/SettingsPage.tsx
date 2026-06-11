import { Box, Stack, Typography } from "@mui/material";
import { CategorySettingsPanel } from "../components/CategorySettingsPanel";
import { GroupSettingsPanel } from "../components/GroupSettingsPanel";
import { WeekDaySettingsPanel } from "../components/WeekDaySettingsPanel";

export function SettingsPage() {
  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Typography component="h1" variant="h5">
          設定
        </Typography>
        <GroupSettingsPanel />
        <CategorySettingsPanel />
        <WeekDaySettingsPanel />
      </Stack>
    </Box>
  );
}
