import { Component, type ErrorInfo, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  SystemAdminEmptyState,
  SystemAdminErrorState,
  SystemAdminPageFrame,
} from "./SystemAdminPageFrame";
import type { SystemAdminAuditAction, SystemAdminAuditItem } from "../types";

const actionOptions: Array<{ value: SystemAdminAuditAction | ""; label: string }> = [
  { value: "", label: "すべての操作" },
  { value: "system_admin_granted", label: "付与" },
  { value: "system_admin_revoked", label: "剥奪" },
  { value: "system_admin_recovered", label: "復旧" },
  { value: "system_admin_bootstrapped", label: "初期登録" },
  { value: "system_admin_user_searched", label: "ユーザー検索" },
  { value: "system_admin_group_searched", label: "グループ検索" },
  { value: "system_admin_user_viewed", label: "ユーザー詳細" },
  { value: "system_admin_group_viewed", label: "グループ詳細" },
  { value: "system_admin_membership_added", label: "所属追加" },
  { value: "system_admin_membership_removed", label: "所属解除" },
  { value: "system_admin_membership_transferred", label: "所属移動" },
  { value: "system_admin_active_group_set", label: "active設定" },
  { value: "system_admin_active_group_cleared", label: "active解除" },
  { value: "system_admin_group_deletion_resumed", label: "削除ジョブ再開" },
  { value: "system_admin_ownerless_group_recovered", label: "owner不在復旧" },
  { value: "system_admin_group_role_changed", label: "role変更" },
  { value: "system_admin_group_owner_transferred", label: "owner付替え" },
  { value: "system_admin_group_invitation_revoked", label: "pending招待取消" },
];

export function SystemAdminAuditLogPage() {
  return (
    <SystemAdminAuditErrorBoundary>
      <SystemAdminAuditLogPageContent />
    </SystemAdminAuditErrorBoundary>
  );
}

function SystemAdminAuditLogPageContent() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState<SystemAdminAuditAction | "">("");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<SystemAdminAuditItem | null>(null);
  const from = useMemo(() => parseDateBoundary(fromDate, false), [fromDate]);
  const to = useMemo(() => parseDateBoundary(toDate, true), [toDate]);
  const logs = useQuery(api.systemAdmins.listSystemAdminAuditLogs, {
    paginationOpts: { numItems: 20, cursor },
    action: action || undefined,
    actorUserId: actor.trim() ? (actor.trim() as Id<"users">) : undefined,
    targetUserId: target.trim() ? (target.trim() as Id<"users">) : undefined,
    from,
    to,
  });

  const clearFilters = () => {
    setAction("");
    setActor("");
    setTarget("");
    setFromDate("");
    setToDate("");
    setCursor(null);
  };
  const hasFilter = Boolean(action || actor.trim() || target.trim() || fromDate || toDate);

  return (
    <SystemAdminPageFrame
      description="管理者権限の変更と管理コンソール操作の監査履歴を確認します。"
      title="監査ログ"
    >
      <Paper sx={{ p: 2 }} variant="outlined">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            slotProps={{ inputLabel: { shrink: true } }}
            label="開始日"
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setCursor(null);
            }}
          />
          <TextField
            slotProps={{ inputLabel: { shrink: true } }}
            label="終了日"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setCursor(null);
            }}
          />
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel id="system-admin-audit-action-label">操作</InputLabel>
            <Select
              label="操作"
              labelId="system-admin-audit-action-label"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as SystemAdminAuditAction | "");
                setCursor(null);
              }}
            >
              {actionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="actor userId"
            value={actor}
            onChange={(event) => {
              setActor(event.target.value);
              setCursor(null);
            }}
          />
          <TextField
            label="target userId"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setCursor(null);
            }}
          />
          {hasFilter ? <Button onClick={clearFilters}>条件をクリア</Button> : null}
        </Stack>
      </Paper>
      {logs === undefined ? (
        <Typography aria-live="polite" role="status">
          監査ログを読み込んでいます…
        </Typography>
      ) : null}
      {logs && logs.page.length === 0 ? (
        <SystemAdminEmptyState
          message={
            hasFilter ? "条件に一致する監査ログはありません。" : "監査ログはまだありません。"
          }
        />
      ) : null}
      {logs && logs.page.length > 0 ? (
        <Stack spacing={1}>
          {logs.page.map((raw) => {
            const item = raw as SystemAdminAuditItem;
            return (
              <Paper
                key={item.id}
                onClick={() => setSelected(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(item);
                  }
                }}
                role="button"
                sx={{ cursor: "pointer", p: 2 }}
                tabIndex={0}
                variant="outlined"
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack spacing={0.25}>
                    <Typography component="h3" variant="subtitle1">
                      {formatAction(item.action)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {new Date(item.createdAt).toLocaleString("ja-JP")}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ overflowWrap: "anywhere" }}
                      variant="body2"
                    >
                      actor: {item.actorDisplayName ?? item.actorUserId ?? item.actorType}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ overflowWrap: "anywhere" }}
                      variant="body2"
                    >
                      target: {item.targetDisplayName ?? item.targetUserId ?? item.targetId ?? "-"}
                    </Typography>
                  </Stack>
                  <Chip
                    color={item.result === "success" ? "success" : "error"}
                    label={item.result}
                    size="small"
                  />
                </Stack>
              </Paper>
            );
          })}
          <Button disabled={logs.isDone} onClick={() => setCursor(logs.continueCursor)}>
            次のページ
          </Button>
        </Stack>
      ) : null}
      <Dialog fullWidth maxWidth="sm" onClose={() => setSelected(null)} open={selected !== null}>
        <DialogTitle>監査ログ詳細</DialogTitle>
        <DialogContent>
          {selected ? (
            <Stack spacing={1}>
              <Typography>操作: {formatAction(selected.action)}</Typography>
              <Typography>結果: {selected.result}</Typography>
              <Typography>日時: {new Date(selected.createdAt).toLocaleString("ja-JP")}</Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                actor: {selected.actorDisplayName ?? selected.actorUserId ?? selected.actorType}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                target:{" "}
                {selected.targetDisplayName ?? selected.targetUserId ?? selected.targetId ?? "-"}
              </Typography>
              {selected.sourceUserId ? (
                <Typography sx={{ overflowWrap: "anywhere" }}>
                  source user: {selected.sourceUserDisplayName ?? selected.sourceUserId}
                </Typography>
              ) : null}
              {selected.previousStatus || selected.newStatus ? (
                <Typography>
                  status: {selected.previousStatus ?? "-"} → {selected.newStatus ?? "-"}
                </Typography>
              ) : null}
              {selected.sourceGroupId || selected.targetGroupId ? (
                <Typography sx={{ overflowWrap: "anywhere" }}>
                  group: {selected.sourceGroupNameSnapshot ?? selected.sourceGroupId ?? "-"} →{" "}
                  {selected.targetGroupNameSnapshot ?? selected.targetGroupId ?? "-"}
                </Typography>
              ) : null}
              {selected.beforeActiveGroupId !== undefined ||
              selected.afterActiveGroupId !== undefined ? (
                <Typography sx={{ overflowWrap: "anywhere" }}>
                  activeGroupId: {selected.beforeActiveGroupId ?? "未選択"} →{" "}
                  {selected.afterActiveGroupId ?? "未選択"}
                </Typography>
              ) : null}
              {selected.beforeMembershipStatus !== undefined ||
              selected.afterMembershipStatus !== undefined ? (
                <Typography>
                  membership: {selected.beforeMembershipStatus ?? "未所属"} →{" "}
                  {selected.afterMembershipStatus ?? "未所属"}
                </Typography>
              ) : null}
              {selected.beforeOwnerCount !== undefined || selected.afterOwnerCount !== undefined ? (
                <Typography>
                  owner数: {selected.beforeOwnerCount ?? "-"} → {selected.afterOwnerCount ?? "-"}
                </Typography>
              ) : null}
              <Typography color="text.secondary" variant="caption">
                理由・検索語・token・secret・家計データは表示しません。
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </SystemAdminPageFrame>
  );
}

function formatAction(action: SystemAdminAuditAction) {
  return actionOptions.find((option) => option.value === action)?.label ?? action;
}

function parseDateBoundary(value: string, endOfDay: boolean) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

class SystemAdminAuditErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) console.error("[SystemAdminAuditLogPage] query failed", _error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SystemAdminPageFrame title="監査ログ">
          <SystemAdminErrorState onRetry={() => this.setState({ hasError: false })} />
        </SystemAdminPageFrame>
      );
    }
    return this.props.children;
  }
}
