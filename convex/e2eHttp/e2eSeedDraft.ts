import { httpAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { invalidJsonResponse, requireE2eSecret } from "./e2eAuth";

async function resolveUserId(
  ctx: ActionCtx,
  body: { userId?: string; email?: string },
): Promise<string | null> {
  if (body.email) {
    const userId = await ctx.runQuery(internal.users.internal.getUserIdByEmail, {
      email: body.email,
    });
    if (userId) return userId;
  }
  return body.userId ?? null;
}

async function resolveGroupId(
  ctx: ActionCtx,
  body: { userId?: string; email?: string; groupId?: string },
): Promise<Id<"groups"> | null> {
  if (body.groupId) {
    return await ctx.runQuery(internal.groups.e2e.normalizeGroupId, { groupId: body.groupId });
  }
  const resolvedUserId = await resolveUserId(ctx, body);
  if (!resolvedUserId) return null;
  return await ctx.runQuery(internal.groups.e2e.getGroupIdByUserId, { userId: resolvedUserId });
}

export const e2eSeedAiExpenseDraftHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E seeding is not enabled in this environment.");
  if (authError) {
    return authError;
  }

  let body: { userId?: string; email?: string; groupId?: string };
  try {
    body = (await req.json()) as { userId?: string; email?: string; groupId?: string };
  } catch {
    return invalidJsonResponse();
  }

  const resolvedGroupId = await resolveGroupId(ctx, body);
  if (!resolvedGroupId) {
    return new Response(JSON.stringify({ error: "groupId is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const categoryId = await ctx.runMutation(internal.categories.internal.ensureE2eCategoryByUser, {
    groupId: resolvedGroupId,
    name: "E2Eカテゴリ-食費-Issue322",
    color: "#AAB7C4",
  });
  const secondaryCategoryId = await ctx.runMutation(
    internal.categories.internal.ensureE2eCategoryByUser,
    {
      groupId: resolvedGroupId,
      name: "E2Eカテゴリ-日用品-Issue322",
      color: "#A6B28B",
    },
  );
  const draftId = await ctx.runMutation(
    internal.aiExpenseDrafts.internal.createE2eReadyDraftForUser,
    {
      groupId: resolvedGroupId,
      categoryId,
      secondaryCategoryId,
    },
  );

  return new Response(JSON.stringify({ draftId, categoryId, secondaryCategoryId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const e2eSeedTaxReviewDraftHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E seeding is not enabled in this environment.");
  if (authError) {
    return authError;
  }

  let body: { userId?: string; email?: string; groupId?: string };
  try {
    body = (await req.json()) as { userId?: string; email?: string; groupId?: string };
  } catch {
    return invalidJsonResponse();
  }

  const resolvedGroupId = await resolveGroupId(ctx, body);
  if (!resolvedGroupId) {
    return new Response(JSON.stringify({ error: "groupId is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const categoryId = await ctx.runMutation(internal.categories.internal.ensureE2eCategoryByUser, {
    groupId: resolvedGroupId,
    name: "E2Eカテゴリ-食費-税レビュー",
    color: "#AAB7C4",
  });
  const draftId = await ctx.runMutation(
    internal.aiExpenseDrafts.internal.createE2eTaxReviewDraftForUser,
    {
      groupId: resolvedGroupId,
      categoryId,
    },
  );

  return new Response(JSON.stringify({ draftId, categoryId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const e2eSeedTaxSummaryConflictDraftHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E seeding is not enabled in this environment.");
  if (authError) {
    return authError;
  }

  let body: { userId?: string; email?: string; groupId?: string };
  try {
    body = (await req.json()) as { userId?: string; email?: string; groupId?: string };
  } catch {
    return invalidJsonResponse();
  }

  const resolvedGroupId = await resolveGroupId(ctx, body);
  if (!resolvedGroupId) {
    return new Response(JSON.stringify({ error: "groupId is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const categoryId = await ctx.runMutation(internal.categories.internal.ensureE2eCategoryByUser, {
    groupId: resolvedGroupId,
    name: "E2Eカテゴリ-食費-税summary",
    color: "#AAB7C4",
  });
  const draftId = await ctx.runMutation(
    internal.aiExpenseDrafts.internal.createE2eTaxSummaryConflictDraftForUser,
    {
      groupId: resolvedGroupId,
      categoryId,
    },
  );

  return new Response(JSON.stringify({ draftId, categoryId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const e2eSeedPendingGroupInvitationHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E seeding is not enabled in this environment.");
  if (authError) {
    return authError;
  }

  let body: { userId?: string; email?: string; groupId?: string; invitationEmail?: string };
  try {
    body = (await req.json()) as {
      userId?: string;
      email?: string;
      groupId?: string;
      invitationEmail?: string;
    };
  } catch {
    return invalidJsonResponse();
  }

  const [resolvedUserId, resolvedGroupId] = await Promise.all([
    resolveUserId(ctx, body),
    resolveGroupId(ctx, body),
  ]);

  if (!resolvedGroupId || !resolvedUserId) {
    return new Response(JSON.stringify({ error: "groupId and userId are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const invitationEmail = body.invitationEmail?.trim().toLowerCase();
  if (!invitationEmail) {
    return new Response(JSON.stringify({ error: "invitationEmail is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const invitationId = await ctx.runMutation(internal.groups.e2e.seedPendingGroupInvitationForE2e, {
    groupId: resolvedGroupId,
    email: invitationEmail,
    invitedByUserId: resolvedUserId,
  });

  return new Response(JSON.stringify({ invitationId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
