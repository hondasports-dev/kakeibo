import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useParams } from "react-router-dom";
import { Alert, CircularProgress, List, ListItem, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import {
  SystemAdminBackLink,
  SystemAdminEmptyState,
  SystemAdminErrorState,
  SystemAdminPageFrame,
} from "./SystemAdminPageFrame";

type GroupDetail = {
  name: string;
  id: string;
  status: string;
  members: { userId: string; displayName: string | null; email: string | null; role: string }[];
  invitations: { email: string; status: string }[];
};

export function SystemAdminGroupDetailPage() {
  const { groupId } = useParams();
  const getGroupDetail = useAction(api.systemAdminSearch.getGroupDetail);
  const [detail, setDetail] = useState<GroupDetail | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    setDetail(undefined);
    setError(false);
    getGroupDetail({ groupId: groupId as never })
      .then((response) => setDetail(response as GroupDetail | null))
      .catch(() => setError(true));
  }, [getGroupDetail, groupId]);

  if (error)
    return (
      <SystemAdminPageFrame title="グループ詳細">
        <SystemAdminErrorState />
      </SystemAdminPageFrame>
    );
  if (detail === undefined)
    return (
      <SystemAdminPageFrame title="グループ詳細">
        <LoadingDetail />
      </SystemAdminPageFrame>
    );
  if (detail === null)
    return (
      <SystemAdminPageFrame title="グループ詳細">
        <SystemAdminEmptyState message="対象グループが見つかりません。" />
        <SystemAdminBackLink to="/admin/groups">グループ検索へ戻る</SystemAdminBackLink>
      </SystemAdminPageFrame>
    );

  const stale = detail.status === "deleting" || detail.status === "deleted";
  return (
    <SystemAdminPageFrame title="グループ詳細">
      <SystemAdminBackLink to="/admin/groups">グループ検索へ戻る</SystemAdminBackLink>
      {stale ? (
        <Alert severity="warning">
          このグループは状態が「{detail.status}」です。表示は最新状態と異なる場合があります。
        </Alert>
      ) : null}
      <Paper sx={{ p: 3 }} variant="outlined">
        <Typography component="h3" variant="h5">
          {detail.name}
        </Typography>
        <Typography>groupId: {detail.id}</Typography>
        <Typography>状態: {detail.status}</Typography>
      </Paper>
      <Paper sx={{ p: 2 }} variant="outlined">
        <Typography component="h3" variant="h6">
          所属メンバー
        </Typography>
        {detail.members.length ? (
          <List>
            {detail.members.map((member) => (
              <ListItem key={member.userId}>
                {member.displayName ?? "ユーザー"}（{member.email ?? "email未登録"}） /{" "}
                {member.role} / userId: {member.userId}
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            所属メンバーはいません。
          </Typography>
        )}
      </Paper>
      <Paper sx={{ p: 2 }} variant="outlined">
        <Typography component="h3" variant="h6">
          招待状態
        </Typography>
        {detail.invitations.length ? (
          <List>
            {detail.invitations.map((invitation) => (
              <ListItem key={invitation.email}>
                {invitation.email} / {invitation.status}
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            招待情報はありません。
          </Typography>
        )}
      </Paper>
      <Alert severity="info" variant="outlined">
        この画面では所属・招待の状態を確認するだけで、変更操作は行いません。
      </Alert>
    </SystemAdminPageFrame>
  );
}

function LoadingDetail() {
  return (
    <Stack spacing={1} sx={{ alignItems: "center" }}>
      <CircularProgress aria-label="詳細を読み込み中" />
      <Typography>詳細を読み込んでいます。</Typography>
    </Stack>
  );
}
