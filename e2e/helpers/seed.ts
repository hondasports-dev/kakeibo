function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim().replace(/^["']+|["']+$/g, "");
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export async function seedAiExpenseDraftForExpenseEntriesByUser(userId: string): Promise<{
  draftId: string;
}> {
  const siteUrl = getRequiredEnv("VITE_CONVEX_SITE_URL");
  const secret = getRequiredEnv("E2E_CLEANUP_SECRET");
  const res = await fetch(`${siteUrl}/e2e/seed-ai-expense-draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-E2E-Cleanup-Secret": secret,
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI expense draft seed に失敗しました: ${res.status} ${text}`);
  }

  return (await res.json()) as { draftId: string };
}

export async function seedPendingGroupInvitationForUser(
  userId: string,
  invitationEmail: string,
): Promise<{ invitationId: string }> {
  const siteUrl = getRequiredEnv("VITE_CONVEX_SITE_URL");
  const secret = getRequiredEnv("E2E_CLEANUP_SECRET");
  const res = await fetch(`${siteUrl}/e2e/seed-pending-group-invitation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-E2E-Cleanup-Secret": secret,
    },
    body: JSON.stringify({ userId, invitationEmail }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`pending 招待 seed に失敗しました: ${res.status} ${text}`);
  }

  return (await res.json()) as { invitationId: string };
}

export async function seedGroupMemberForUser(
  userId: string,
  memberDisplayName: string,
  memberEmail: string,
): Promise<{ memberUserId: string }> {
  const siteUrl = getRequiredEnv("VITE_CONVEX_SITE_URL");
  const secret = getRequiredEnv("E2E_CLEANUP_SECRET");
  const res = await fetch(`${siteUrl}/e2e/seed-group-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-E2E-Cleanup-Secret": secret,
    },
    body: JSON.stringify({ userId, memberDisplayName, memberEmail }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`グループメンバー seed に失敗しました: ${res.status} ${text}`);
  }

  return (await res.json()) as { memberUserId: string };
}
