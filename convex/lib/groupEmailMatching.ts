import { ConvexError } from "convex/values";
import type { GroupPendingInvitationListItem } from "./groupTypes";

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return normalized;
}

function normalizeGmailAddress(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return null;
  }

  const normalizedDomain = domain === "googlemail.com" ? "gmail.com" : domain;
  if (normalizedDomain !== "gmail.com") {
    return null;
  }

  const canonicalLocalPart = localPart.split("+")[0].replaceAll(".", "");
  return `${canonicalLocalPart}@${normalizedDomain}`;
}

export function getInvitationEmailKey(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalizeGmailAddress(normalized) ?? normalized;
}

export function sortPendingGroupInvitationsForDisplay(
  invitations: GroupPendingInvitationListItem[],
) {
  return [...invitations].sort((left, right) => {
    const createdAtCompare = right.createdAt - left.createdAt;
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }

    return left.email.localeCompare(right.email, "ja");
  });
}

/** 同一メール（Gmail alias 含む）の pending は最新 1 件だけを表示する */
export function dedupePendingGroupInvitationsByEmail(
  invitations: GroupPendingInvitationListItem[],
) {
  const sorted = sortPendingGroupInvitationsForDisplay(invitations);
  const latestByEmail = new Map<string, GroupPendingInvitationListItem>();

  for (const invitation of sorted) {
    const key = getInvitationEmailKey(invitation.email);
    if (!latestByEmail.has(key)) {
      latestByEmail.set(key, invitation);
    }
  }

  return sortPendingGroupInvitationsForDisplay([...latestByEmail.values()]);
}

export function invitationEmailsMatch(identityEmail: string | undefined, invitationEmail: string) {
  const normalizedIdentityEmail = identityEmail?.trim().toLowerCase();
  const normalizedInvitationEmail = invitationEmail.trim().toLowerCase();
  if (!normalizedIdentityEmail) {
    return false;
  }
  if (normalizedIdentityEmail === normalizedInvitationEmail) {
    return true;
  }

  const canonicalIdentityEmail = normalizeGmailAddress(normalizedIdentityEmail);
  const canonicalInvitationEmail = normalizeGmailAddress(normalizedInvitationEmail);
  return canonicalIdentityEmail !== null && canonicalIdentityEmail === canonicalInvitationEmail;
}

export function invitationEmailsMatchAny(
  candidateEmails: Array<string | undefined>,
  invitationEmail: string,
) {
  return candidateEmails.some((email) => invitationEmailsMatch(email, invitationEmail));
}
