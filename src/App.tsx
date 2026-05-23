import { useState } from "react";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { RouterProvider } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useInitializeUser } from "./hooks/useInitializeUser";
import { router } from "./router";
import "./App.css";

const OAUTH_CALLBACK_PATH = "/sso-callback";

function getClerkErrorMessage(error: unknown, fallbackMessage: string) {
  const clerkError = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
  };
  return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? fallbackMessage;
}

function App() {
  if (window.location.pathname === OAUTH_CALLBACK_PATH) {
    return <AuthCallbackScreen />;
  }
  return <AuthenticatedApp />;
}

function AuthCallbackScreen() {
  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <CircularProgress aria-label="Googleログイン処理中" />
          <Box>
            <Typography component="h1" variant="h5">
              Googleログインを処理中
            </Typography>
            <Typography color="text.secondary" variant="body2">
              認証が完了したら家計簿画面に戻ります。
            </Typography>
          </Box>
          <AuthenticateWithRedirectCallback
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          />
        </Stack>
      </Paper>
    </Box>
  );
}

function AuthenticatedApp() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } =
    useConvexAuth();

  useInitializeUser();

  if (!isLoaded) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
            <CircularProgress aria-label="ログイン状態を確認中" />
            <Typography color="text.secondary">ログイン状態を確認しています。</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!isSignedIn) {
    return <SignedOutScreen />;
  }

  if (isConvexAuthLoading) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
            <CircularProgress aria-label="Convex認証状態を確認中" />
            <Typography color="text.secondary">データ同期の認証状態を確認しています。</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!isConvexAuthenticated) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Alert severity="error" variant="outlined">
            Clerkログインは完了していますが、Convexで認証できませんでした。
            ClerkのConvex連携とCLERK_JWT_ISSUER_DOMAINを確認してください。
          </Alert>
        </Paper>
      </Box>
    );
  }

  return <RouterProvider router={router} />;
}

function SignedOutScreen() {
  const { isLoaded, signIn } = useSignIn();
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;
    setError("");
    setIsRedirecting(true);
    try {
      await signIn.authenticateWithRedirect({
        redirectUrl: OAUTH_CALLBACK_PATH,
        redirectUrlComplete: "/",
        strategy: "oauth_google",
      });
    } catch (caughtError) {
      setError(
        getClerkErrorMessage(
          caughtError,
          "Googleログインを開始できませんでした。Clerk DashboardのGoogle OAuth設定を確認してください。",
        ),
      );
      setIsRedirecting(false);
    }
  };

  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              家計簿にログイン
            </Typography>
            <Typography color="text.secondary">
              実在するGoogleアカウントでログインすると、レシート入力画面を確認できます。
            </Typography>
          </Box>

          <Alert severity="info" variant="outlined">
            Clerkの開発用テストユーザーではGoogle OAuthにログインできません。
            Googleの認証画面では、実際に使えるGoogleアカウントを入力してください。
          </Alert>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Button
            disabled={!isLoaded || isRedirecting}
            onClick={handleGoogleSignIn}
            size="large"
            variant="contained"
          >
            {isRedirecting ? "Googleへ移動しています" : "Googleでログイン"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default App;
