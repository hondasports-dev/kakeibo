export type ClerkEmailAddress = {
  id: string;
  emailAddress: string;
  verification: { status?: string } | null;
};

export type ClerkUserWithEmails = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: ClerkEmailAddress[];
  primaryEmailAddressId?: string | null;
};

export function getVerifiedClerkEmailAddresses(user: ClerkUserWithEmails) {
  return (user.emailAddresses ?? [])
    .filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

export function getClerkUserDisplayName(user: ClerkUserWithEmails, fallbackEmail?: string) {
  const username = user.username?.trim();
  const displayName = [user.firstName, user.lastName]
    .map((name) => name?.trim())
    .filter(Boolean)
    .join(" ");
  return username || displayName || fallbackEmail || "ユーザー";
}

export function getPrimaryVerifiedClerkEmailAddress(user: ClerkUserWithEmails) {
  const verifiedEmails = getVerifiedClerkEmailAddresses(user);
  const primaryEmail = (user.emailAddresses ?? []).find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (
    primaryEmail?.verification?.status === "verified" &&
    primaryEmail.emailAddress.trim().length > 0
  ) {
    return primaryEmail.emailAddress.trim().toLowerCase();
  }
  return verifiedEmails[0];
}
