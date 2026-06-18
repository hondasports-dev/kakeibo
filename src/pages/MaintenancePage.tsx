import { Box, Stack, Typography } from "@mui/material";

export function MaintenancePage() {
  return (
    <Box className="auth-screen" component="main" sx={{ alignContent: "start", py: 4 }}>
      <Box className="app-main" sx={{ maxWidth: 480 }}>
        <Stack spacing={2.5} sx={{ textAlign: "center" }}>
          <Box
            alt="Suzumemo スズメモ"
            component="img"
            src="/suzumemo-logo-lockup.png"
            sx={{ display: "block", height: "auto", mx: "auto", width: "min(180px, 60vw)" }}
          />
          <Typography component="h1" variant="h5">
            メンテナンス中です
          </Typography>
          <Typography color="text.secondary" variant="body2">
            現在、サービス改善のため一時的に利用を停止しています。時間をおいて再度アクセスしてください。
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
