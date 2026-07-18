import { Link as RouterLink } from "react-router-dom";
import { Button, Card, CardActions, CardContent, Grid, Typography } from "@mui/material";
import { SystemAdminPageFrame } from "./SystemAdminPageFrame";

export function SystemAdminHomePage() {
  return (
    <SystemAdminPageFrame
      description="対象を検索して、所属・ロール・招待状態などの管理情報を確認します。"
      title="管理トップ"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdminLinkCard
            description="表示名、メールアドレス、userIdから対象ユーザーを探します。"
            label="ユーザーを検索"
            to="/admin/users"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdminLinkCard
            description="グループ名またはgroupIdから対象グループを探します。"
            label="グループを検索"
            to="/admin/groups"
          />
        </Grid>
      </Grid>
      <Typography color="text.secondary" variant="body2">
        監査ログとシステム管理者の変更操作は後続の管理機能で提供します。
      </Typography>
    </SystemAdminPageFrame>
  );
}

function AdminLinkCard({
  description,
  label,
  to,
}: {
  description: string;
  label: string;
  to: string;
}) {
  return (
    <Card sx={{ height: "100%" }} variant="outlined">
      <CardContent>
        <Typography component="h3" variant="h6">
          {label}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      </CardContent>
      <CardActions>
        <Button component={RouterLink} to={to}>
          開く
        </Button>
      </CardActions>
    </Card>
  );
}
