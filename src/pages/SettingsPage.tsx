import { Box, Stack, Typography } from "@mui/material";
import { CategorySettingsPanel } from "../components/CategorySettingsPanel";
import { UserSettingsPanel } from "../components/UserSettingsPanel";

export function SettingsPage() {
  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Typography component="h1" variant="h5">
          設定
        </Typography>
        <UserSettingsPanel />
        <CategorySettingsPanel />
      </Stack>
    </Box>
  );
}
