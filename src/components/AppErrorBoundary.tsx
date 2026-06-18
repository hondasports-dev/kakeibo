import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.error) {
      const showDetails = import.meta.env.DEV;

      return (
        <Box className="auth-screen" component="main" role="alert">
          <Box className="app-main" sx={{ maxWidth: 480 }}>
            <Stack spacing={2.5}>
              <Typography component="h1" variant="h5">
                問題が発生しました
              </Typography>
              <Typography color="text.secondary" variant="body2">
                画面の表示中にエラーが発生しました。しばらくしてから再読み込みしてください。
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <Button onClick={this.handleReload} variant="contained">
                  再読み込み
                </Button>
                <Button onClick={this.handleGoHome} variant="outlined">
                  ホームへ戻る
                </Button>
              </Stack>
              {showDetails ? (
                <Typography
                  component="pre"
                  sx={{ fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap" }}
                  variant="body2"
                >
                  {this.state.error.message}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
