import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useSignUp } from "@clerk/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { api } from "../../convex/_generated/api";

export function GroupInvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signUp } = useSignUp();
  const { isAuthenticated } = useConvexAuth();
  const acceptInvitation = useMutation(api.groups.acceptGroupInvitation);
  const [error, setError] = useState("");
  const hasStartedClerkInvitation = useRef(false);
  const hasAccepted = useRef(false);

  const token = searchParams.get("token");
  const clerkTicket = searchParams.get("__clerk_ticket");

  useEffect(() => {
    if (
      !isClerkLoaded ||
      !isSignedIn ||
      !token ||
      !clerkTicket ||
      hasStartedClerkInvitation.current
    ) {
      return;
    }

    hasStartedClerkInvitation.current = true;
    signOut({ redirectUrl: `${window.location.pathname}${window.location.search}` }).catch(
      (caughtError: unknown) => {
        hasStartedClerkInvitation.current = false;
        console.error(
          "[GroupInvitationAcceptPage] failed to sign out current session:",
          caughtError,
        );
        setError("招待リンクの認証を開始できませんでした。リンクを開き直して再度お試しください。");
      },
    );
  }, [clerkTicket, isClerkLoaded, isSignedIn, signOut, token]);

  useEffect(() => {
    if (
      !isClerkLoaded ||
      isSignedIn ||
      !signUp ||
      !token ||
      !clerkTicket ||
      hasStartedClerkInvitation.current
    ) {
      return;
    }

    hasStartedClerkInvitation.current = true;
    const fallbackUrl = `/group/invitations/accept?token=${encodeURIComponent(token)}`;

    signUp
      .ticket({ ticket: clerkTicket })
      .then(async ({ error: signUpError }) => {
        if (signUpError) {
          throw signUpError;
        }
        if (signUp.status !== "complete") {
          throw new Error("Clerk invitation sign-up was not completed.");
        }

        const { error: finalizeError } = await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            window.location.href = decorateUrl(fallbackUrl);
          },
        });
        if (finalizeError) {
          throw finalizeError;
        }
      })
      .catch((caughtError: unknown) => {
        hasStartedClerkInvitation.current = false;
        console.error(
          "[GroupInvitationAcceptPage] failed to consume Clerk invitation:",
          caughtError,
        );
        setError("招待リンクの認証を完了できませんでした。リンクを開き直して再度お試しください。");
      });
  }, [clerkTicket, isClerkLoaded, isSignedIn, signUp, token]);

  useEffect(() => {
    if (!isAuthenticated || hasAccepted.current || !token || clerkTicket) {
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
  }, [acceptInvitation, clerkTicket, isAuthenticated, navigate, token]);

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
