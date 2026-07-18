import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { SystemAdminMembershipChangeDialog } from "../components/SystemAdminMembershipChangeDialog";

type GroupDetail = {
  name: string;
  id: string;
  status: string;
  environment: string;
  members: {
    userDocumentId: string | null;
    userId: string;
    displayName: string | null;
    email: string | null;
    role: "owner" | "member";
  }[];
  invitations: { email: string; status: string }[];
  membersTruncated?: boolean;
  invitationsTruncated?: boolean;
};

export function SystemAdminGroupDetailPage() {
  const { groupId } = useParams();
  const getGroupDetail = useAction(api.systemAdminSearch.getGroupDetail);
  const operate = useMutation(api.systemAdminMembership.systemAdminMembershipOperation);
  const recoverOwnerless = useMutation(api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup);
  const [detail, setDetail] = useState<GroupDetail | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [dialogMember, setDialogMember] = useState<GroupDetail["members"][number] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const [success, setSuccess] = useState("");
  const [recoveryTarget, setRecoveryTarget] = useState<GroupDetail["members"][number] | null>(null);
  const [recoveryReason, setRecoveryReason] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    setDetail(undefined);
    setError(false);
    try {
      const response = await getGroupDetail({ groupId: groupId as Id<"groups"> });
      setDetail(response as GroupDetail | null);
    } catch {
      setError(true);
    }
  }, [getGroupDetail, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeMember = async (reason: string) => {
    if (!detail || !dialogMember || !dialogMember.userDocumentId || !groupId) return;
    setConfirming(true);
    setOperationError(undefined);
    try {
      await operate({
        targetUserId: dialogMember.userDocumentId as Id<"users">,
        operation: "remove",
        sourceGroupId: groupId as Id<"groups">,
        reason,
      });
      setDialogMember(null);
      setSuccess("所属を解除しました。家計データは変更していません。");
      await load();
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : "操作に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

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

  const stale = detail.status !== "active";
  const ownerless =
    !stale &&
    !detail.membersTruncated &&
    detail.members.length > 0 &&
    !detail.members.some((member) => member.role === "owner");
  const target = dialogMember
    ? {
        id: dialogMember.userDocumentId ?? "",
        displayName: dialogMember.displayName ?? "ユーザー",
        email: dialogMember.email,
        activeGroupId: null,
      }
    : null;
  return (
    <SystemAdminPageFrame title="グループ詳細">
      <SystemAdminBackLink to="/admin/groups">グループ検索へ戻る</SystemAdminBackLink>
      {success ? (
        <Alert onClose={() => setSuccess("")} severity="success">
          {success}
        </Alert>
      ) : null}
      {stale ? (
        <Alert severity="warning">
          このグループは状態が「{detail.status}」のため変更できません。
        </Alert>
      ) : null}
      {ownerless ? (
        <Alert severity="error">
          ownerが0人です。通常のrole変更と分離した緊急復旧を実行してください。
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            {detail.members
              .filter((member) => member.role === "member" && member.userDocumentId)
              .map((member) => (
                <Button
                  key={member.userId}
                  onClick={() => {
                    setRecoveryTarget(member);
                    setRecoveryReason("");
                    setRecoveryError("");
                  }}
                  size="small"
                  variant="contained"
                >
                  {member.displayName ?? "ユーザー"}をownerへ
                </Button>
              ))}
          </Stack>
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
              <ListItem key={member.userId} sx={{ display: "block" }}>
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
                    {member.displayName ?? "ユーザー"}（{member.email ?? "email未登録"}） /{" "}
                    {member.role}
                  </Typography>
                  {member.userDocumentId ? (
                    <Button
                      component={Link}
                      size="small"
                      to={`/admin/users/${member.userDocumentId}`}
                      variant="text"
                    >
                      ユーザー詳細
                    </Button>
                  ) : null}
                  <Button
                    disabled={stale || member.role === "owner" || !member.userDocumentId}
                    onClick={() => setDialogMember(member)}
                    size="small"
                    title={member.role === "owner" ? "ownerの解除は#477で行います" : undefined}
                    variant="outlined"
                  >
                    グループから外す
                  </Button>
                </Stack>
                {member.role === "owner" ? (
                  <Typography color="text.secondary" variant="caption">
                    ownerの解除・付替えは#477で行います。
                  </Typography>
                ) : null}
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            所属メンバーはいません。
          </Typography>
        )}
        {detail.membersTruncated ? (
          <Alert severity="warning">メンバーは上限件数まで表示しています。</Alert>
        ) : null}
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
        {detail.invitationsTruncated ? (
          <Alert severity="warning">招待情報は上限件数まで表示しています。</Alert>
        ) : null}
      </Paper>
      <Alert severity="info" variant="outlined">
        この画面の変更は所属だけです。家計データ、招待トークン、Clerkアカウントは変更しません。
      </Alert>
      <SystemAdminMembershipChangeDialog
        confirming={confirming}
        environment={detail.environment}
        error={operationError}
        onCancel={() => {
          if (!confirming) {
            setDialogMember(null);
            setOperationError(undefined);
          }
        }}
        onConfirm={removeMember}
        open={dialogMember !== null}
        operation="remove"
        sourceGroup={{ id: detail.id, name: detail.name }}
        target={target}
      />
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => {
          if (!recovering) setRecoveryTarget(null);
        }}
        open={recoveryTarget !== null}
      >
        <DialogTitle>owner不在を復旧</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Typography>
              グループ: {detail.name}（{detail.id}）
            </Typography>
            <Typography>
              対象: {recoveryTarget?.displayName ?? "ユーザー"}（
              {recoveryTarget?.email ?? "email未登録"}）
            </Typography>
            <Typography color="error">
              owner 0人を確認し、このmemberをownerへ昇格します。
            </Typography>
            <TextField
              error={
                recoveryReason.trim().length > 500 ||
                (recoveryReason.length > 0 && recoveryReason.trim().length === 0)
              }
              helperText={`${recoveryReason.trim().length}/500文字（必須）`}
              label="復旧理由"
              multiline
              minRows={3}
              name="ownerless-recovery-reason"
              value={recoveryReason}
              onChange={(event) => setRecoveryReason(event.target.value)}
            />
            {recoveryError ? (
              <Alert aria-live="polite" severity="error">
                {recoveryError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={recovering} onClick={() => setRecoveryTarget(null)}>
            キャンセル
          </Button>
          <Button
            disabled={
              recovering ||
              recoveryReason.trim().length < 1 ||
              recoveryReason.trim().length > 500 ||
              !recoveryTarget?.userDocumentId
            }
            onClick={async () => {
              if (!groupId || !recoveryTarget?.userDocumentId) return;
              setRecovering(true);
              setRecoveryError("");
              try {
                await recoverOwnerless({
                  groupId: groupId as Id<"groups">,
                  targetUserId: recoveryTarget.userDocumentId as Id<"users">,
                  reason: recoveryReason.trim(),
                });
                setRecoveryTarget(null);
                setSuccess("owner不在グループを復旧しました。監査ログと通知outboxに記録しました。");
                await load();
              } catch (cause) {
                setRecoveryError(cause instanceof Error ? cause.message : "復旧に失敗しました");
              } finally {
                setRecovering(false);
              }
            }}
            variant="contained"
          >
            {recovering ? "復旧中…" : "復旧する"}
          </Button>
        </DialogActions>
      </Dialog>
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
