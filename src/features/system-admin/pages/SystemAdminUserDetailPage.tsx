import { Children, useEffect, useState } from "react";
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

type UserDetail = {
  displayName: string;
  userId: string;
  email: string | null;
  activeGroupId: string | null;
  memberships: { groupId: string; groupName: string; role: string }[];
  invitations: { groupId: string; groupName: string; status: string }[];
};

export function SystemAdminUserDetailPage() {
  const { userId } = useParams();
  const getUserDetail = useAction(api.systemAdminSearch.getUserDetail);
  const [detail, setDetail] = useState<UserDetail | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setDetail(undefined);
    setError(false);
    getUserDetail({ userId: userId as never })
      .then((response) => setDetail(response as UserDetail | null))
      .catch(() => setError(true));
  }, [getUserDetail, userId]);

  if (error)
    return (
      <SystemAdminPageFrame title="ユーザー詳細">
        <SystemAdminErrorState />
      </SystemAdminPageFrame>
    );
  if (detail === undefined)
    return (
      <SystemAdminPageFrame title="ユーザー詳細">
        <LoadingDetail />
      </SystemAdminPageFrame>
    );
  if (detail === null)
    return (
      <SystemAdminPageFrame title="ユーザー詳細">
        <SystemAdminEmptyState message="対象ユーザーが見つかりません。" />
        <SystemAdminBackLink to="/admin/users">ユーザー検索へ戻る</SystemAdminBackLink>
      </SystemAdminPageFrame>
    );

  return (
    <SystemAdminPageFrame title="ユーザー詳細">
      <SystemAdminBackLink to="/admin/users">ユーザー検索へ戻る</SystemAdminBackLink>
      <Paper sx={{ p: 3 }} variant="outlined">
        <Stack spacing={1}>
          <Typography component="h3" variant="h5">
            {detail.displayName}
          </Typography>
          <Typography>email: {detail.email ?? "未登録"}</Typography>
          <Typography>userId: {detail.userId}</Typography>
          <Typography>activeGroupId: {detail.activeGroupId ?? "未設定"}</Typography>
        </Stack>
      </Paper>
      <DetailList title="所属グループ" empty="所属グループはありません。">
        {detail.memberships.map((membership) => (
          <ListItem key={membership.groupId}>
            {membership.groupName}（{membership.groupId}） / {membership.role}
          </ListItem>
        ))}
      </DetailList>
      <DetailList title="招待状態" empty="招待情報はありません。">
        {detail.invitations.map((invitation) => (
          <ListItem key={invitation.groupId}>
            {invitation.groupName}（{invitation.groupId}） / {invitation.status}
          </ListItem>
        ))}
      </DetailList>
      <Alert severity="info" variant="outlined">
        この画面では所属・招待の状態を確認するだけで、変更操作は行いません。
      </Alert>
    </SystemAdminPageFrame>
  );
}

function DetailList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography component="h3" variant="h6">
        {title}
      </Typography>
      {Children.count(children) > 0 ? (
        <List>{children}</List>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {empty}
        </Typography>
      )}
    </Paper>
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
