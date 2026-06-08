/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiExpenseDrafts from "../aiExpenseDrafts.js";
import type * as aiExpenseDraftsModel from "../aiExpenseDraftsModel.js";
import type * as categories from "../categories.js";
import type * as categoryCandidate from "../categoryCandidate.js";
import type * as expenseEntries from "../expenseEntries.js";
import type * as http from "../http.js";
import type * as receiptAnalysisJobs from "../receiptAnalysisJobs.js";
import type * as receiptImageExtraction from "../receiptImageExtraction.js";
import type * as receipts from "../receipts.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as weekSessions from "../weekSessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiExpenseDrafts: typeof aiExpenseDrafts;
  aiExpenseDraftsModel: typeof aiExpenseDraftsModel;
  categories: typeof categories;
  categoryCandidate: typeof categoryCandidate;
  expenseEntries: typeof expenseEntries;
  http: typeof http;
  receiptAnalysisJobs: typeof receiptAnalysisJobs;
  receiptImageExtraction: typeof receiptImageExtraction;
  receipts: typeof receipts;
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
