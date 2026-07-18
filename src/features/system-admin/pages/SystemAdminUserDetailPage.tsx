import { Children, useCallback, useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import {
  SystemAdminBackLink,
  SystemAdminEmptyState,
  SystemAdminErrorState,
  SystemAdminPageFrame,
} from "./SystemAdminPageFrame";
import {
  SystemAdminMembershipChangeDialog,
  type MembershipDialogGroup,
  type SystemAdminMembershipOperation,
} from "../components/SystemAdminMembershipChangeDialog";

type UserDetail = {
  id: string;
  displayName: string;
  userId: string;
  email: string | null;
  activeGroupId: string | null;
  environment: string;
  memberships: { groupId: string; groupName: string; role: "owner" | "member" }[];
  invitations: { groupId: string; groupName: string; status: string }[];
  membershipsTruncated?: boolean;
  invitationsTruncated?: boolean;
};
type GroupCandidate = { id: string; name: string; status: string };
type DialogState = {
  operation: SystemAdminMembershipOperation;
  sourceGroup?: MembershipDialogGroup;
  targetGroup?: MembershipDialogGroup;
} | null;

export function SystemAdminUserDetailPage() {
  const { userId } = useParams();
  const getUserDetail = useAction(api.systemAdminSearch.getUserDetail);
  const searchGroups = useAction(api.systemAdminSearch.searchGroups);
  const operate = useMutation(api.systemAdminMembership.systemAdminMembershipOperation);
  const [detail, setDetail] = useState<UserDetail | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [candidates, setCandidates] = useState<GroupCandidate[]>([]);
  const [selectedSource, setSelectedSource] = useState<MembershipDialogGroup | undefined>();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [confirming, setConfirming] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setDetail(undefined);
    setError(false);
    try {
      const response = await getUserDetail({ userId: userId as Id<"users"> });
      setDetail(response as UserDetail | null);
    } catch {
      setError(true);
    }
  }, [getUserDetail, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (groupQuery.trim().length === 0) {
      setCandidates([]);
      return;
    }
    void searchGroups({
      queryType: "name",
      query: groupQuery,
      paginationOpts: { numItems: 20, cursor: null },
    })
      .then((response) => {
        if (!cancelled) setCandidates(response.page.filter((group) => group.status === "active"));
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [groupQuery, searchGroups]);

  const runOperation = async (reason: string) => {
    if (!detail || !dialog) return;
    setConfirming(true);
    setOperationError(undefined);
    try {
      await operate({
        targetUserId: detail.id as Id<"users">,
        operation: dialog.operation,
        sourceGroupId: dialog.sourceGroup?.id as Id<"groups"> | undefined,
        targetGroupId: dialog.targetGroup?.id as Id<"groups"> | undefined,
        reason,
      });
      setDialog(null);
      setSelectedSource(undefined);
      setSuccess("操作を完了しました。監査ログと通知outboxに記録しました。");
      await load();
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : "操作に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

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
      {success ? (
        <Alert onClose={() => setSuccess("")} severity="success">
          {success}
        </Alert>
      ) : null}
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
            onClick={() => setDialog({ operation: "clear_active" })}
            sx={{ alignSelf: "flex-start" }}
            variant="outlined"
          >
            activeグループを解除
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 2 }} variant="outlined">
        <Typography component="h3" variant="h6">
          所属グループ
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {detail.memberships.length ? (
            <List disablePadding>
              {detail.memberships.map((membership) => {
                const source = { id: membership.groupId, name: membership.groupName };
                return (
                  <ListItem
                    data-testid={`system-admin-membership-${membership.groupId}`}
                    key={membership.groupId}
                    sx={{ display: "block", px: 0 }}
                  >
                    <Stack
                      sx={{
                        alignItems: "flex-start",
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Typography sx={{ flex: 1, minWidth: 220 }}>
                        {membership.groupName}（{membership.groupId}） / {membership.role}
                      </Typography>
                      <Button
                        disabled={membership.role === "owner"}
                        onClick={() => setDialog({ operation: "remove", sourceGroup: source })}
                        size="small"
                        title={
                          membership.role === "owner" ? "ownerの解除は#477で行います" : undefined
                        }
                        variant="outlined"
                      >
                        グループから外す
                      </Button>
                      <Button
                        onClick={() => setDialog({ operation: "set_active", targetGroup: source })}
                        size="small"
                        variant="outlined"
                      >
                        activeに設定
                      </Button>
                      <Button
                        onClick={() => setSelectedSource(source)}
                        size="small"
                        disabled={membership.role === "owner"}
                        title={
                          membership.role === "owner" ? "ownerの付替えは#477で行います" : undefined
                        }
                        variant={selectedSource?.id === source.id ? "contained" : "text"}
                      >
                        移動元に選択
                      </Button>
                    </Stack>
                    {membership.role === "owner" ? (
                      <Typography color="text.secondary" variant="caption">
                        ownerの解除・付替えは#477で行います。
                      </Typography>
                    ) : null}
                  </ListItem>
                );
              })}
            </List>
          ) : (
            <Typography color="text.secondary">所属グループはありません。</Typography>
          )}
          {detail.membershipsTruncated ? (
            <Alert severity="warning">所属グループは上限件数まで表示しています。</Alert>
          ) : null}
          <TextField
            label="追加・移動先グループを検索"
            onChange={(event) => setGroupQuery(event.target.value)}
            value={groupQuery}
          />
          {candidates.map((candidate) => {
            const target = { id: candidate.id, name: candidate.name, status: candidate.status };
            return (
              <Stack
                key={candidate.id}
                sx={{ alignItems: "center", display: "flex", flexDirection: "row", gap: 1 }}
              >
                <Typography sx={{ flex: 1 }}>
                  {candidate.name}（{candidate.id}）
                </Typography>
                <Button
                  onClick={() =>
                    setDialog(
                      selectedSource
                        ? {
                            operation: "transfer",
                            sourceGroup: selectedSource,
                            targetGroup: target,
                          }
                        : { operation: "add", targetGroup: target },
                    )
                  }
                  size="small"
                  variant="contained"
                >
                  {selectedSource ? "このグループへ移動" : "このグループに追加"}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </Paper>
      <DetailList title="招待状態" empty="招待情報はありません。">
        {detail.invitations.map((invitation) => (
          <ListItem key={invitation.groupId}>
            {invitation.groupName}（{invitation.groupId}） / {invitation.status}
          </ListItem>
        ))}
      </DetailList>
      {detail.invitationsTruncated ? (
        <Alert severity="warning">招待情報は上限件数まで表示しています。</Alert>
      ) : null}
      <Alert severity="info" variant="outlined">
        変更対象は所属とactiveGroupIdだけです。家計データ、招待トークン、Clerkアカウントは移動・削除しません。
      </Alert>
      <SystemAdminMembershipChangeDialog
        confirming={confirming}
        environment={detail.environment}
        error={operationError}
        onCancel={() => {
          if (!confirming) {
            setDialog(null);
            setOperationError(undefined);
          }
        }}
        onConfirm={runOperation}
        open={dialog !== null}
        operation={dialog?.operation ?? "add"}
        sourceGroup={dialog?.sourceGroup}
        target={detail}
        targetGroup={dialog?.targetGroup}
      />
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
