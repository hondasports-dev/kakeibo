import { Link } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";

export function NotFoundPage() {
  return (
    <Box className="app-main">
      <Stack spacing={2}>
        <Typography>ページが見つかりませんでした。</Typography>
        <Button component={Link} to="/" variant="contained">
          ホームへ戻る
        </Button>
      </Stack>
    </Box>
  );
}
