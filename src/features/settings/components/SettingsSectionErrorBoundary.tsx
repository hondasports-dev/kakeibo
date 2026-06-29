import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Stack } from "@mui/material";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class SettingsSectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SettingsSectionErrorBoundary caught an error", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Stack spacing={1.5}>
          <Alert severity="error" variant="outlined">
            この設定を読み込めませんでした。
          </Alert>
          <Button onClick={this.handleRetry} sx={{ alignSelf: "flex-start" }} variant="outlined">
            再試行
          </Button>
        </Stack>
      );
    }

    return this.props.children;
  }
}
