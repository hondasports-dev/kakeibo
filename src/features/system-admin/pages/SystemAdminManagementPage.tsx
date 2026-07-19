import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import {
  SystemAdminActionDialog,
  type SystemAdminAction,
} from "../components/SystemAdminActionDialog";
import {
  SystemAdminEmptyState,
  SystemAdminErrorState,
  SystemAdminPageFrame,
} from "./SystemAdminPageFrame";
import type { SystemAdminListItem, UserSearchItem } from "../types";

type StatusFilter = "active" | "revoked";
type SearchType = "displayName" | "email" | "userId";

const statusLabel: Record<StatusFilter, string> = { active: "active", revoked: "revoked" };

export function SystemAdminManagementPage() {
  return (
    <SystemAdminPageErrorBoundary>
      <SystemAdminManagementPageContent />
    </SystemAdminPageErrorBoundary>
  );
}

function SystemAdminManagementPageContent() {
  const context = useQuery(api.systemAdmins.getMySystemAdminContext, {});
  const status = useState<StatusFilter>("active");
  const [statusFilter, setStatusFilter] = status;
  const [cursor, setCursor] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<SearchType>("displayName");
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<UserSearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<SystemAdminListItem | UserSearchItem | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<SystemAdminAction | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const environment = context?.environment ?? "development";
  const list = useQuery(api.systemAdmins.listSystemAdmins, {
    paginationOpts: { numItems: 20, cursor },
    status: statusFilter,
  });
  const searchUsers = useAction(api.systemAdminSearch.searchUsers);
  const grant = useMutation(api.systemAdmins.grantSystemAdmin);
  const revoke = useMutation(api.systemAdmins.revokeSystemAdmin);

  const runSearch = async () => {
    const query = searchQuery.trim();
    setSearching(true);
    setSearchError(false);
    setCandidates([]);
    setHasSearched(true);
    try {
      const result = await searchUsers({
        queryType: searchType,
        query,
        paginationOpts: { numItems: 10, cursor: null },
      });
      setCandidates(result.page as UserSearchItem[]);
    } catch {
      setSearchError(true);
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  const openAction = (target: SystemAdminListItem | UserSearchItem, action: SystemAdminAction) => {
    setMutationError("");
    setSelectedTarget(target);
    setPendingAction(action);
  };

  const executeAction = async (reason: string) => {
    if (!selectedTarget || !pendingAction) return;
    setSaving(true);
    setMutationError("");
    try {
      const targetUserId =
        "targetUserId" in selectedTarget ? selectedTarget.targetUserId : selectedTarget.id;
      if (pendingAction === "revoke") {
        await revoke({ targetUserId: targetUserId as never, reason });
      } else {
        await grant({ targetUserId: targetUserId as never, reason });
      }
      setPendingAction(null);
      setSelectedTarget(null);
      setSnackbar(
        `${selectedTarget.displayName} を${pendingAction === "revoke" ? "剥奪" : pendingAction === "regrant" ? "再付与" : "付与"}しました`,
      );
      setCandidates([]);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "操作に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const isSelf = (target: SystemAdminListItem | UserSearchItem): boolean =>
    ("isSelf" in target && Boolean(target.isSelf)) ||
    Boolean(
      context?.status === "active" &&
      context.userId === ("targetUserId" in target ? target.targetUserId : target.id),
    );

  return (
    <SystemAdminPageFrame
      description="既存ユーザーを明示的に選び、管理者権限を安全に委任します。"
      title="システム管理者"
    >
      <Paper
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
        sx={{ p: 2 }}
        variant="outlined"
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ alignItems: { md: "flex-end" } }}
        >
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel id="system-admin-search-type-label">検索対象</InputLabel>
            <Select
              label="検索対象"
              labelId="system-admin-search-type-label"
              value={searchType}
              onChange={(event) => setSearchType(event.target.value as SearchType)}
            >
              <MenuItem value="displayName">表示名</MenuItem>
              <MenuItem value="email">メールアドレス</MenuItem>
              <MenuItem value="userId">userId</MenuItem>
            </Select>
          </FormControl>
          <TextField
            autoComplete="off"
            fullWidth
            helperText="未入力で検索すると新しい順の候補を表示します（最大10件）"
            label="付与対象を検索"
            name="system-admin-user-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <Button disabled={searching} type="submit" variant="contained">
            {searching ? <CircularProgress aria-label="検索中" size={20} /> : "候補を検索"}
          </Button>
        </Stack>
      </Paper>
      {searchError ? <SystemAdminErrorState onRetry={() => void runSearch()} /> : null}
      {candidates.length > 0 ? (
        <Stack aria-label="管理者付与候補" spacing={1}>
          {candidates.map((candidate) => (
            <Paper key={candidate.id} sx={{ p: 2 }} variant="outlined">
              <Typography component="h3" variant="h6">
                {candidate.displayName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {candidate.email ?? "メールアドレス未登録"}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                userId: {candidate.userId}
              </Typography>
              <Button
                disabled={isSelf(candidate)}
                onClick={() => openAction(candidate, "grant")}
                sx={{ mt: 1 }}
                variant="outlined"
              >
                {isSelf(candidate) ? "自分自身は付与できません" : "このユーザーを付与"}
              </Button>
              {isSelf(candidate) ? (
                <Typography color="text.secondary" variant="caption">
                  自分自身は操作対象にできません。
                </Typography>
              ) : null}
            </Paper>
          ))}
        </Stack>
      ) : hasSearched && !searching && !searchError ? (
        <SystemAdminEmptyState message="一致するユーザーはありません。検索条件を確認してください。" />
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" } }}
      >
        <Typography component="h3" variant="h5">
          管理者一覧
        </Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="system-admin-status-label">状態</InputLabel>
          <Select
            label="状態"
            labelId="system-admin-status-label"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setCursor(null);
            }}
          >
            <MenuItem value="active">active</MenuItem>
            <MenuItem value="revoked">revoked</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {list === undefined ? (
        <Typography aria-live="polite" role="status">
          管理者一覧を読み込んでいます…
        </Typography>
      ) : null}
      {list && list.page.length === 0 ? (
        <SystemAdminEmptyState message={`${statusLabel[statusFilter]} の管理者はいません。`} />
      ) : null}
      {list && list.page.length > 0 ? (
        <Stack spacing={1}>
          {list.page.map((item) => {
            const admin = item as SystemAdminListItem & { isSelf?: boolean };
            const self = Boolean(admin.isSelf) || isSelf(admin);
            const hasAnotherActiveAdmin =
              (list as { hasAnotherActiveAdmin?: boolean }).hasAnotherActiveAdmin ?? false;
            return (
              <Paper key={admin.id} sx={{ p: 2 }} variant="outlined">
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between" }}
                >
                  <BoxText item={admin} />
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Chip
                      color={admin.status === "active" ? "success" : "default"}
                      label={admin.status}
                      size="small"
                    />
                    {admin.status === "active" ? (
                      <Button
                        color="error"
                        disabled={self || !hasAnotherActiveAdmin}
                        onClick={() => openAction(admin, "revoke")}
                        size="small"
                        variant="outlined"
                      >
                        剥奪
                      </Button>
                    ) : (
                      <Button
                        onClick={() => openAction(admin, "regrant")}
                        size="small"
                        variant="outlined"
                      >
                        再付与
                      </Button>
                    )}
                  </Stack>
                </Stack>
                {self ? (
                  <Typography color="text.secondary" variant="caption">
                    自分自身は剥奪できません。
                  </Typography>
                ) : null}
                {!self && admin.status === "active" && !hasAnotherActiveAdmin ? (
                  <Typography color="text.secondary" variant="caption">
                    最後のactive管理者のため剥奪できません。
                  </Typography>
                ) : null}
              </Paper>
            );
          })}
          {!list.isDone ? (
            <Button onClick={() => setCursor(list.continueCursor)}>次のページ</Button>
          ) : null}
        </Stack>
      ) : null}
      <Alert severity="info" variant="outlined">
        付与・剥奪の理由は監査ログに保存されます。家計データは表示されません。
      </Alert>
      <SystemAdminActionDialog
        action={pendingAction ?? "grant"}
        confirming={saving}
        environment={environment}
        error={mutationError}
        onCancel={() => {
          if (!saving) {
            setPendingAction(null);
            setSelectedTarget(null);
          }
        }}
        onConfirm={(reason) => void executeAction(reason)}
        open={pendingAction !== null}
        target={selectedTarget}
      />
      <Snackbar
        autoHideDuration={4000}
        message={snackbar}
        onClose={() => setSnackbar("")}
        open={Boolean(snackbar)}
      />
    </SystemAdminPageFrame>
  );
}

function BoxText({ item }: { item: SystemAdminListItem }) {
  return (
    <Stack spacing={0.25}>
      <Typography component="h4" variant="h6">
        {item.displayName}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {item.email ?? "メールアドレス未登録"}
      </Typography>
      <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="body2">
        userId: {item.targetUserId}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        付与: {new Date(item.grantedAt).toLocaleString("ja-JP")}
      </Typography>
      {item.revokedAt ? (
        <Typography color="text.secondary" variant="caption">
          剥奪: {new Date(item.revokedAt).toLocaleString("ja-JP")}
        </Typography>
      ) : null}
    </Stack>
  );
}

class SystemAdminPageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) console.error("[SystemAdminManagementPage] query failed", _error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SystemAdminPageFrame title="システム管理者">
          <SystemAdminErrorState onRetry={() => this.setState({ hasError: false })} />
        </SystemAdminPageFrame>
      );
    }
    return this.props.children;
  }
}
