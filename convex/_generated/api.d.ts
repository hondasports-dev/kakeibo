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
import type * as categories_candidate from "../categories/candidate.js";
import type * as categories_internal from "../categories/internal.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as expenseEntries_internal from "../expenseEntries/internal.js";
import type * as expenseEntries_mutations from "../expenseEntries/mutations.js";
import type * as groups_adminGuards from "../groups/adminGuards.js";
import type * as groups_auditLogs from "../groups/auditLogs.js";
import type * as groups_clerkInvitations from "../groups/clerkInvitations.js";
import type * as groups_deletion from "../groups/deletion.js";
import type * as groups_e2e from "../groups/e2e.js";
import type * as groups_invitations from "../groups/invitations.js";
import type * as groups_lib_deleteGroupPhysically from "../groups/lib/deleteGroupPhysically.js";
import type * as groups_lib_groupDeletionImpact from "../groups/lib/groupDeletionImpact.js";
import type * as groups_lib_groupEmailMatching from "../groups/lib/groupEmailMatching.js";
import type * as groups_lib_groupLifecycle from "../groups/lib/groupLifecycle.js";
import type * as groups_lib_groupName from "../groups/lib/groupName.js";
import type * as groups_lib_groupQueryHelpers from "../groups/lib/groupQueryHelpers.js";
import type * as groups_lib_groupRoleLabel from "../groups/lib/groupRoleLabel.js";
import type * as groups_lib_groupTypes from "../groups/lib/groupTypes.js";
import type * as groups_lib_managementAuditLog from "../groups/lib/managementAuditLog.js";
import type * as groups_lib_managementAuditLogModel from "../groups/lib/managementAuditLogModel.js";
import type * as groups_memberDisplay from "../groups/memberDisplay.js";
import type * as groups_members from "../groups/members.js";
import type * as groups_membership from "../groups/membership.js";
import type * as groups_mutations from "../groups/mutations.js";
import type * as groups_queries from "../groups/queries.js";
import type * as groups_validators from "../groups/validators.js";
import type * as http from "../http.js";
import type * as lib_weekDates from "../lib/weekDates.js";
import type * as receiptAnalysisJobs_actions from "../receiptAnalysisJobs/actions.js";
import type * as receiptAnalysisJobs_internal from "../receiptAnalysisJobs/internal.js";
import type * as receiptAnalysisJobs_mutations from "../receiptAnalysisJobs/mutations.js";
import type * as receiptAnalysisJobs_queries from "../receiptAnalysisJobs/queries.js";
import type * as receiptImageExtraction_extraction from "../receiptImageExtraction/extraction.js";
import type * as receipts_crud from "../receipts/crud.js";
import type * as receipts_spendingEntries from "../receipts/spendingEntries.js";
import type * as receipts_summaries from "../receipts/summaries.js";
import type * as users_auth from "../users/auth.js";
import type * as users_internal from "../users/internal.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as weekSessions_internal from "../weekSessions/internal.js";
import type * as weekSessions_mutations from "../weekSessions/mutations.js";
import type * as weekSessions_queries from "../weekSessions/queries.js";

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
  "categories/candidate": typeof categories_candidate;
  "categories/internal": typeof categories_internal;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  "expenseEntries/internal": typeof expenseEntries_internal;
  "expenseEntries/mutations": typeof expenseEntries_mutations;
  "groups/adminGuards": typeof groups_adminGuards;
  "groups/auditLogs": typeof groups_auditLogs;
  "groups/clerkInvitations": typeof groups_clerkInvitations;
  "groups/deletion": typeof groups_deletion;
  "groups/e2e": typeof groups_e2e;
  "groups/invitations": typeof groups_invitations;
  "groups/lib/deleteGroupPhysically": typeof groups_lib_deleteGroupPhysically;
  "groups/lib/groupDeletionImpact": typeof groups_lib_groupDeletionImpact;
  "groups/lib/groupEmailMatching": typeof groups_lib_groupEmailMatching;
  "groups/lib/groupLifecycle": typeof groups_lib_groupLifecycle;
  "groups/lib/groupName": typeof groups_lib_groupName;
  "groups/lib/groupQueryHelpers": typeof groups_lib_groupQueryHelpers;
  "groups/lib/groupRoleLabel": typeof groups_lib_groupRoleLabel;
  "groups/lib/groupTypes": typeof groups_lib_groupTypes;
  "groups/lib/managementAuditLog": typeof groups_lib_managementAuditLog;
  "groups/lib/managementAuditLogModel": typeof groups_lib_managementAuditLogModel;
  "groups/memberDisplay": typeof groups_memberDisplay;
  "groups/members": typeof groups_members;
  "groups/membership": typeof groups_membership;
  "groups/mutations": typeof groups_mutations;
  "groups/queries": typeof groups_queries;
  "groups/validators": typeof groups_validators;
  http: typeof http;
  "lib/weekDates": typeof lib_weekDates;
  "receiptAnalysisJobs/actions": typeof receiptAnalysisJobs_actions;
  "receiptAnalysisJobs/internal": typeof receiptAnalysisJobs_internal;
  "receiptAnalysisJobs/mutations": typeof receiptAnalysisJobs_mutations;
  "receiptAnalysisJobs/queries": typeof receiptAnalysisJobs_queries;
  "receiptImageExtraction/extraction": typeof receiptImageExtraction_extraction;
  "receipts/crud": typeof receipts_crud;
  "receipts/spendingEntries": typeof receipts_spendingEntries;
  "receipts/summaries": typeof receipts_summaries;
  "users/auth": typeof users_auth;
  "users/internal": typeof users_internal;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "weekSessions/internal": typeof weekSessions_internal;
  "weekSessions/mutations": typeof weekSessions_mutations;
  "weekSessions/queries": typeof weekSessions_queries;
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
