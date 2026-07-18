import { Component, type ErrorInfo, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../../../convex/_generated/api";
import { SuzumemoLoadingState } from "../../ui";
import { SystemAdminLayout } from "./SystemAdminLayout";

export function SystemAdminRouteGuard() {
  return (
    <SystemAdminGuardErrorBoundary>
      <SystemAdminRouteGuardContent />
    </SystemAdminGuardErrorBoundary>
  );
}

function SystemAdminRouteGuardContent() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexLoading, isAuthenticated } = useConvexAuth();
  const context = useQuery(
    api.systemAdmins.getMySystemAdminContext,
    isClerkLoaded && isSignedIn && isAuthenticated ? {} : "skip",
  );

  if (
    !isClerkLoaded ||
    isConvexLoading ||
    (isSignedIn && isAuthenticated && context === undefined)
  ) {
    return (
      <SuzumemoLoadingState
        label="管理者権限を確認中"
        message="システム管理者権限を確認しています。"
        variant="fullscreen"
      />
    );
  }

  if (!isSignedIn || !isAuthenticated || context?.status !== "active") {
    return <SystemAdminForbiddenState />;
  }

  return <SystemAdminLayout environment={context.environment} />;
}

class SystemAdminGuardErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // 認可エラーの詳細を画面へ出さず、開発者向けログだけに留める。
    if (import.meta.env.DEV) console.error("[SystemAdminRouteGuard] context query failed", _error);
  }

  render() {
    if (this.state.hasError) return <SystemAdminContextErrorState />;
    return this.props.children;
  }
}

function SystemAdminContextErrorState() {
  return (
    <Box
      className="auth-screen"
      sx={{ alignItems: "center", display: "flex", minHeight: "100vh", p: 2 }}
    >
      <Paper
        className="auth-panel paper-panel"
        elevation={0}
        sx={{ mx: "auto", maxWidth: 520, p: 4, width: "100%" }}
      >
        <Stack spacing={2}>
          <Alert severity="error" variant="outlined">
            管理者権限を確認できませんでした。
          </Alert>
          <Typography component="h1" variant="h5">
            管理画面を利用できません
          </Typography>
          <Button onClick={() => window.location.reload()} variant="contained">
            再読み込み
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function SystemAdminForbiddenState() {
  return (
    <Box
      className="auth-screen"
      sx={{ alignItems: "center", display: "flex", minHeight: "100vh", p: 2 }}
    >
      <Paper
        className="auth-panel paper-panel"
        elevation={0}
        sx={{ mx: "auto", maxWidth: 520, p: 4, width: "100%" }}
      >
        <Stack spacing={2}>
          <Alert severity="warning" variant="outlined">
            管理画面へのアクセス権限を確認できませんでした。
          </Alert>
          <Typography component="h1" variant="h5">
            管理画面を利用できません
          </Typography>
          <Typography color="text.secondary">
            システム管理者権限が必要です。権限の状態は表示せず、安全に通常の画面へ戻ります。
          </Typography>
          <Button component={RouterLink} to="/" variant="contained">
            通常の画面へ戻る
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
