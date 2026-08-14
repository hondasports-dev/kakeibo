export type ValidateEmailError = "empty";

export function validateEmail(
  email: string,
): { success: true; email: string } | { success: false; error: ValidateEmailError } {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) {
    return { success: false, error: "empty" };
  }
  return { success: true, email: normalized };
}

export function normalizeGmailAddress(email: string): string | null {
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

export function getInvitationEmailKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  return normalizeGmailAddress(normalized) ?? normalized;
}

export type PendingInvitationLike = {
  email: string;
  createdAt: number;
};

export function sortPendingInvitationsByCreatedAtAndEmail<T extends PendingInvitationLike>(
  invitations: T[],
): T[] {
  return [...invitations].sort((left, right) => {
    const createdAtCompare = right.createdAt - left.createdAt;
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }
    return left.email.localeCompare(right.email, "ja");
  });
}

export function dedupePendingInvitationsByEmail<T extends PendingInvitationLike>(
  invitations: T[],
): T[] {
  const sorted = sortPendingInvitationsByCreatedAtAndEmail(invitations);
  const latestByEmail = new Map<string, T>();

  for (const invitation of sorted) {
    const key = getInvitationEmailKey(invitation.email);
    if (!latestByEmail.has(key)) {
      latestByEmail.set(key, invitation);
    }
  }

  return sortPendingInvitationsByCreatedAtAndEmail([...latestByEmail.values()]);
}

export function invitationEmailsMatch(
  identityEmail: string | undefined,
  invitationEmail: string,
): boolean {
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
): boolean {
  return candidateEmails.some((email) => invitationEmailsMatch(email, invitationEmail));
}
