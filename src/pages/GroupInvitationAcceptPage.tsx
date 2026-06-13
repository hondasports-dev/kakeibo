import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useSignUp } from "@clerk/react";
import { useConvexAuth, useMutation } from "convex/react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../convex/_generated/api";

type ClerkSignUpResult = {
  error?: unknown;
  missingFields?: string[];
  status?: string | null;
};

type ClerkSignUp = ClerkSignUpResult & {
  authenticateWithRedirect: (params: {
    continueSignUp: boolean;
    redirectUrl: string;
    redirectUrlComplete: string;
    strategy: "oauth_google";
  }) => Promise<void>;
  finalize: (params: {
    navigate: (params: { decorateUrl: (url: string) => string }) => void;
  }) => Promise<{ error?: unknown }>;
  ticket: (params: { ticket: string }) => Promise<ClerkSignUpResult>;
  update: (params: { firstName?: string; lastName?: string }) => Promise<ClerkSignUpResult>;
};

const OAUTH_CALLBACK_PATH = "/sso-callback";
const firstNameFieldNames = new Set(["firstName", "first_name"]);
const lastNameFieldNames = new Set(["lastName", "last_name"]);
const passwordFieldNames = new Set(["password"]);

function getMissingFields(signUpResult: ClerkSignUpResult | undefined, signUp: ClerkSignUpResult) {
  return signUpResult?.missingFields ?? signUp.missingFields ?? [];
}

function hasSupportedProfileFields(fields: string[]) {
  return fields.some((field) => firstNameFieldNames.has(field) || lastNameFieldNames.has(field));
}

function hasPasswordField(fields: string[]) {
  return fields.some((field) => passwordFieldNames.has(field));
}

export function GroupInvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signUp: rawSignUp } = useSignUp();
  const signUp = rawSignUp as unknown as ClerkSignUp | undefined;
  const { isAuthenticated } = useConvexAuth();
  const acceptInvitation = useMutation(api.groups.acceptGroupInvitation);
  const [error, setError] = useState("");
  const [needsProfileDetails, setNeedsProfileDetails] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isCompletingInvitation, setIsCompletingInvitation] = useState(false);
  const hasStartedClerkInvitation = useRef(false);
  const hasAccepted = useRef(false);

  const token = searchParams.get("token");
  const clerkTicket = searchParams.get("__clerk_ticket");
  const fallbackUrl = token
    ? `/group/invitations/accept?token=${encodeURIComponent(token)}`
    : "/group/invitations/accept";

  const finalizeInvitation = useCallback(async () => {
    if (!signUp || signUp.status !== "complete") {
      return false;
    }

    const { error: finalizeError } = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(fallbackUrl);
      },
    });
    if (finalizeError) {
      throw finalizeError;
    }
    return true;
  }, [fallbackUrl, signUp]);

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
    setIsCompletingInvitation(true);

    signUp
      .ticket({ ticket: clerkTicket })
      .then(async (signUpResult: ClerkSignUpResult) => {
        if (signUpResult.error) {
          throw signUpResult.error;
        }

        const finalized = await finalizeInvitation();
        if (!finalized) {
          const missingFields = getMissingFields(signUpResult, signUp);
          setMissingProfileFields(missingFields);

          if (hasPasswordField(missingFields)) {
            await signUp.authenticateWithRedirect({
              continueSignUp: true,
              redirectUrl: OAUTH_CALLBACK_PATH,
              redirectUrlComplete: fallbackUrl,
              strategy: "oauth_google",
            });
            return;
          }

          if (hasSupportedProfileFields(missingFields)) {
            setNeedsProfileDetails(true);
            return;
          }

          console.error(
            "[GroupInvitationAcceptPage] unsupported Clerk invitation requirements:",
            missingFields,
          );
          setError(
            "招待の認証に追加の設定が必要です。Clerkのサインアップ必須項目を確認してください。",
          );
        }
      })
      .catch((caughtError: unknown) => {
        hasStartedClerkInvitation.current = false;
        console.error(
          "[GroupInvitationAcceptPage] failed to consume Clerk invitation:",
          caughtError,
        );
        setError("招待リンクの認証を完了できませんでした。リンクを開き直して再度お試しください。");
      })
      .finally(() => {
        setIsCompletingInvitation(false);
      });
  }, [clerkTicket, fallbackUrl, finalizeInvitation, isClerkLoaded, isSignedIn, signUp, token]);

  const handleProfileDetailsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp) {
      return;
    }

    setError("");
    setIsCompletingInvitation(true);
    try {
      const updateParams: { firstName?: string; lastName?: string } = {};
      if (missingProfileFields.some((field) => firstNameFieldNames.has(field))) {
        updateParams.firstName = firstName.trim();
      }
      if (missingProfileFields.some((field) => lastNameFieldNames.has(field))) {
        updateParams.lastName = lastName.trim();
      }

      const updateResult: ClerkSignUpResult = await signUp.update(updateParams);
      if (updateResult.error) {
        throw updateResult.error;
      }

      const finalized = await finalizeInvitation();
      if (!finalized) {
        setError("招待の認証に必要な情報を完了できませんでした。入力内容を確認してください。");
      }
    } catch (caughtError: unknown) {
      console.error(
        "[GroupInvitationAcceptPage] failed to complete invitation profile:",
        caughtError,
      );
      setError("招待の認証に必要な情報を保存できませんでした。入力内容を確認してください。");
    } finally {
      setIsCompletingInvitation(false);
    }
  };

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
          {isCompletingInvitation ? <CircularProgress aria-label="招待を処理中" /> : null}
          <Box>
            <Typography component="h1" variant="h5">
              {needsProfileDetails ? "招待を完了する" : "グループ招待を処理中"}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {needsProfileDetails
                ? "招待を受け入れるため、名前を入力してください。"
                : "招待を受け取り次第、家計簿画面へ進みます。"}
            </Typography>
          </Box>
          <Box id="clerk-captcha" sx={{ minHeight: 1 }} />

          {needsProfileDetails ? (
            <Box component="form" onSubmit={handleProfileDetailsSubmit} sx={{ width: "100%" }}>
              <Stack spacing={2}>
                <TextField
                  autoComplete="given-name"
                  disabled={isCompletingInvitation}
                  fullWidth
                  label="名"
                  onChange={(event) => setFirstName(event.target.value)}
                  required={missingProfileFields.some((field) => firstNameFieldNames.has(field))}
                  value={firstName}
                />
                <TextField
                  autoComplete="family-name"
                  disabled={isCompletingInvitation}
                  fullWidth
                  label="姓"
                  onChange={(event) => setLastName(event.target.value)}
                  required={missingProfileFields.some((field) => lastNameFieldNames.has(field))}
                  value={lastName}
                />
                <Button
                  disabled={isCompletingInvitation}
                  size="large"
                  type="submit"
                  variant="contained"
                >
                  招待を完了する
                </Button>
              </Stack>
            </Box>
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
