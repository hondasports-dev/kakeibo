import { Button, Paper, Stack, Typography } from "@mui/material";
import type { UserDetail } from "../hooks/useSystemAdminUserDetail";

type UserProfileCardProps = {
  detail: UserDetail;
  onClearActive: () => void;
};

export function UserProfileCard({ detail, onClearActive }: UserProfileCardProps) {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={1}>
        <Typography component="h3" variant="h5">
          {detail.displayName}
        </Typography>
        <Typography>email: {detail.email ?? "未登録"}</Typography>
        <Typography>userId: {detail.userId}</Typography>
        <Typography data-testid="system-admin-active-group">
          activeGroupId: {detail.activeGroupId ?? "未選択"}
        </Typography>
        <Button
          disabled={!detail.activeGroupId}
          onClick={onClearActive}
          sx={{ alignSelf: "flex-start" }}
          variant="outlined"
        >
          activeグループを解除
        </Button>
      </Stack>
    </Paper>
  );
}
