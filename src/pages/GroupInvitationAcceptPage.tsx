import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../convex/_generated/api";

export function GroupInvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const acceptInvitation = useMutation(api.groups.acceptGroupInvitation);
  const [error, setError] = useState("");
  const hasAccepted = useRef(false);

  const token = searchParams.get("token");
  const clerkTicket = searchParams.get("__clerk_ticket");

  useEffect(() => {
    if (!isAuthenticated || hasAccepted.current || !token) {
      return;
    }

    hasAccepted.current = true;
    acceptInvitation({ token })
      .then(() => {
        navigate("/", { replace: true });
      })
      .catch((caughtError: unknown) => {
        hasAccepted.current = false;
        console.error("[GroupInvitationAcceptPage] failed to accept invitation:", caughtError);
        setError(
          "招待を処理できませんでした。招待リンクを確認し、時間を置いて再度お試しください。",
        );
      });
  }, [acceptInvitation, isAuthenticated, navigate, token]);

  if (!token) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Alert severity="error" variant="outlined">
            招待トークンが見つかりませんでした。
          </Alert>
        </Paper>
      </Box>
    );
  }

  const encodedToken = encodeURIComponent(token);

  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <CircularProgress aria-label="招待を処理中" />
          <Box>
            <Typography component="h1" variant="h5">
              グループ招待を処理中
            </Typography>
            <Typography color="text.secondary" variant="body2">
              招待を受け取り次第、家計簿画面へ進みます。
            </Typography>
          </Box>

          {clerkTicket ? (
            <AuthenticateWithRedirectCallback
              signInFallbackRedirectUrl={`/group/invitations/accept?token=${encodedToken}`}
              signUpFallbackRedirectUrl={`/group/invitations/accept?token=${encodedToken}`}
            />
          ) : null}

          {error ? (
            <Alert severity="error" variant="outlined" sx={{ width: "100%" }}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
