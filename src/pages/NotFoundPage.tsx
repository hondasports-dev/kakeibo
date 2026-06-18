import { Link } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";

export function NotFoundPage() {
  return (
    <Box className="auth-screen" component="main" sx={{ alignContent: "start", py: 4 }}>
      <Box className="app-main" sx={{ maxWidth: 480 }}>
        <Stack spacing={2.5}>
          <Typography component="h1" variant="h5">
            ページが見つかりませんでした
          </Typography>
          <Typography color="text.secondary" variant="body2">
            お探しのページは存在しないか、移動した可能性があります。
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
            <Button component={Link} to="/" variant="contained">
              ホームへ戻る
            </Button>
            <Button component={Link} to="/privacy" variant="outlined">
              プライバシーポリシー
            </Button>
            <Button component={Link} to="/terms" variant="outlined">
              利用規約
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
