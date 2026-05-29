import { Box, Stack, Typography } from "@mui/material";
import { CategorySettingsPanel } from "../components/CategorySettingsPanel";

export function CategoriesPage() {
  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Typography component="h1" variant="h5">
          カテゴリ設定
        </Typography>
        <CategorySettingsPanel />
      </Stack>
    </Box>
  );
}
