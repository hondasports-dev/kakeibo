type ClerkProfileForDisplayName = {
  fullName?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
};

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getClerkUserFriendlyDisplayName(
  user: ClerkProfileForDisplayName | null | undefined,
) {
  if (!user) {
    return null;
  }

  const joinedName = [user.firstName, user.lastName]
    .map((name) => trimOrNull(name))
    .filter(Boolean)
    .join(" ");

  return (
    trimOrNull(user.fullName) ??
    trimOrNull(user.username) ??
    trimOrNull(joinedName) ??
    trimOrNull(user.primaryEmailAddress?.emailAddress) ??
    null
  );
}
