/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiExpenseDrafts_actions from "../aiExpenseDrafts/actions.js";
import type * as aiExpenseDrafts_internal from "../aiExpenseDrafts/internal.js";
import type * as aiExpenseDrafts_model from "../aiExpenseDrafts/model.js";
import type * as aiExpenseDrafts_mutations from "../aiExpenseDrafts/mutations.js";
import type * as aiExpenseDrafts_queries from "../aiExpenseDrafts/queries.js";
import type * as categories from "../categories.js";
import type * as categoryCandidate from "../categoryCandidate.js";
import type * as expenseEntries from "../expenseEntries.js";
import type * as groups_adminGuards from "../groups/adminGuards.js";
import type * as groups_clerkInvitations from "../groups/clerkInvitations.js";
import type * as groups_deletion from "../groups/deletion.js";
import type * as groups_e2e from "../groups/e2e.js";
import type * as groups_invitations from "../groups/invitations.js";
import type * as groups_memberDisplay from "../groups/memberDisplay.js";
import type * as groups_members from "../groups/members.js";
import type * as groups_membership from "../groups/membership.js";
import type * as groups_mutations from "../groups/mutations.js";
import type * as groups_queries from "../groups/queries.js";
import type * as groups_validators from "../groups/validators.js";
import type * as http from "../http.js";
import type * as lib_deleteGroupPhysically from "../lib/deleteGroupPhysically.js";
import type * as lib_groupDeletionImpact from "../lib/groupDeletionImpact.js";
import type * as lib_groupEmailMatching from "../lib/groupEmailMatching.js";
import type * as lib_groupLifecycle from "../lib/groupLifecycle.js";
import type * as lib_groupName from "../lib/groupName.js";
import type * as lib_groupQueryHelpers from "../lib/groupQueryHelpers.js";
import type * as lib_groupRoleLabel from "../lib/groupRoleLabel.js";
import type * as lib_groupTypes from "../lib/groupTypes.js";
import type * as lib_managementAuditLog from "../lib/managementAuditLog.js";
import type * as lib_managementAuditLogModel from "../lib/managementAuditLogModel.js";
import type * as managementAuditLogs from "../managementAuditLogs.js";
import type * as receiptAnalysisJobs_actions from "../receiptAnalysisJobs/actions.js";
import type * as receiptAnalysisJobs_internal from "../receiptAnalysisJobs/internal.js";
import type * as receiptAnalysisJobs_mutations from "../receiptAnalysisJobs/mutations.js";
import type * as receiptAnalysisJobs_queries from "../receiptAnalysisJobs/queries.js";
import type * as receiptImageExtraction_extraction from "../receiptImageExtraction/extraction.js";
import type * as receipts_crud from "../receipts/crud.js";
import type * as receipts_spendingEntries from "../receipts/spendingEntries.js";
import type * as receipts_summaries from "../receipts/summaries.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as weekSessions from "../weekSessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "aiExpenseDrafts/actions": typeof aiExpenseDrafts_actions;
  "aiExpenseDrafts/internal": typeof aiExpenseDrafts_internal;
  "aiExpenseDrafts/model": typeof aiExpenseDrafts_model;
  "aiExpenseDrafts/mutations": typeof aiExpenseDrafts_mutations;
  "aiExpenseDrafts/queries": typeof aiExpenseDrafts_queries;
  categories: typeof categories;
  categoryCandidate: typeof categoryCandidate;
  expenseEntries: typeof expenseEntries;
  "groups/adminGuards": typeof groups_adminGuards;
  "groups/clerkInvitations": typeof groups_clerkInvitations;
  "groups/deletion": typeof groups_deletion;
  "groups/e2e": typeof groups_e2e;
  "groups/invitations": typeof groups_invitations;
  "groups/memberDisplay": typeof groups_memberDisplay;
  "groups/members": typeof groups_members;
  "groups/membership": typeof groups_membership;
  "groups/mutations": typeof groups_mutations;
  "groups/queries": typeof groups_queries;
  "groups/validators": typeof groups_validators;
  http: typeof http;
  "lib/deleteGroupPhysically": typeof lib_deleteGroupPhysically;
  "lib/groupDeletionImpact": typeof lib_groupDeletionImpact;
  "lib/groupEmailMatching": typeof lib_groupEmailMatching;
  "lib/groupLifecycle": typeof lib_groupLifecycle;
  "lib/groupName": typeof lib_groupName;
  "lib/groupQueryHelpers": typeof lib_groupQueryHelpers;
  "lib/groupRoleLabel": typeof lib_groupRoleLabel;
  "lib/groupTypes": typeof lib_groupTypes;
  "lib/managementAuditLog": typeof lib_managementAuditLog;
  "lib/managementAuditLogModel": typeof lib_managementAuditLogModel;
  managementAuditLogs: typeof managementAuditLogs;
  "receiptAnalysisJobs/actions": typeof receiptAnalysisJobs_actions;
  "receiptAnalysisJobs/internal": typeof receiptAnalysisJobs_internal;
  "receiptAnalysisJobs/mutations": typeof receiptAnalysisJobs_mutations;
  "receiptAnalysisJobs/queries": typeof receiptAnalysisJobs_queries;
  "receiptImageExtraction/extraction": typeof receiptImageExtraction_extraction;
  "receipts/crud": typeof receipts_crud;
  "receipts/spendingEntries": typeof receipts_spendingEntries;
  "receipts/summaries": typeof receipts_summaries;
  users: typeof users;
  utils: typeof utils;
  weekSessions: typeof weekSessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
