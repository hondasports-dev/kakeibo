import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  isAllowedRedirectOrigin as isAllowedRedirectOriginDomain,
  buildInvitationRedirectUrl as buildInvitationRedirectUrlDomain,
  buildClerkInvitationParams as buildClerkInvitationParamsDomain,
  getInvitationRedirectErrorMessage,
  parseAllowedRedirectOrigins,
} from "../../../domain/groups/clerkInvitations";

export { INVITATION_ACCEPT_PATH } from "../../../domain/groups/clerkInvitations";

export function getConfiguredRedirectOrigins() {
  const raw = process.env.INVITATION_REDIRECT_ORIGINS ?? "";
  try {
    return parseAllowedRedirectOrigins(raw);
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid redirect origins");
  }
}

export function isAllowedRedirectOrigin(url: URL) {
  return isAllowedRedirectOriginDomain(url, getConfiguredRedirectOrigins());
}

export function buildInvitationRedirectUrl(rawRedirectUrl: string, token: string) {
  const result = buildInvitationRedirectUrlDomain(
    rawRedirectUrl,
    token,
    getConfiguredRedirectOrigins(),
  );
  if (!result.success) {
    throw new ConvexError(getInvitationRedirectErrorMessage(result.error));
  }
  return result.redirectUrl;
}

export function buildClerkInvitationParams(
  emailAddress: string,
  redirectUrl: string,
  groupId: Id<"groups">,
  token: string,
) {
  return buildClerkInvitationParamsDomain(emailAddress, redirectUrl, groupId, token);
}
