import { httpRouter } from "convex/server";
import { resendWebhookHandler } from "./email/webhooks/resendWebhook";
import { e2eCleanupHandler } from "./e2eHttp/e2eCleanup";
import { e2eCleanupAuthCheckHandler } from "./e2eHttp/e2eAuth";
import {
  cleanupSystemAdminMembershipHandler,
  seedSystemAdminMembershipHandler,
} from "./e2eHttp/e2eSystemAdminMembership";
import {
  cleanupSystemAdminSearchHandler,
  seedSystemAdminSearchHandler,
} from "./e2eHttp/e2eSystemAdminSearch";
import {
  e2eSeedAiExpenseDraftHandler,
  e2eSeedPendingGroupInvitationHandler,
  e2eSeedTaxReviewDraftHandler,
  e2eSeedTaxSummaryConflictDraftHandler,
} from "./e2eHttp/e2eSeedDraft";

const http = httpRouter();

http.route({
  path: "/e2e/cleanup-auth-check",
  method: "POST",
  handler: e2eCleanupAuthCheckHandler,
});
http.route({
  path: "/e2e/cleanup",
  method: "POST",
  handler: e2eCleanupHandler,
});
http.route({
  path: "/e2e/seed-system-admin-membership",
  method: "POST",
  handler: seedSystemAdminMembershipHandler,
});
http.route({
  path: "/e2e/cleanup-system-admin-membership",
  method: "POST",
  handler: cleanupSystemAdminMembershipHandler,
});
http.route({
  path: "/e2e/seed-system-admin-search",
  method: "POST",
  handler: seedSystemAdminSearchHandler,
});
http.route({
  path: "/e2e/cleanup-system-admin-search",
  method: "POST",
  handler: cleanupSystemAdminSearchHandler,
});
http.route({
  path: "/e2e/seed-ai-expense-draft",
  method: "POST",
  handler: e2eSeedAiExpenseDraftHandler,
});
http.route({
  path: "/e2e/seed-tax-review-draft",
  method: "POST",
  handler: e2eSeedTaxReviewDraftHandler,
});
http.route({
  path: "/e2e/seed-tax-summary-conflict-draft",
  method: "POST",
  handler: e2eSeedTaxSummaryConflictDraftHandler,
});
http.route({
  path: "/e2e/seed-pending-group-invitation",
  method: "POST",
  handler: e2eSeedPendingGroupInvitationHandler,
});
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: resendWebhookHandler,
});

export default http;
