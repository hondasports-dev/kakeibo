import { query } from "../_generated/server";
import { v } from "convex/values";

export {
  insertReceiptForGroup,
  createReceiptHandler,
  type CreateReceiptArgs,
} from "../../lib/convex/receipts/insert";
export {
  getReceiptsByWeekHandler,
  getReceiptsByDateHandler,
} from "../../lib/convex/receipts/queries";
export {
  updateReceiptHandler,
  deleteReceiptHandler,
  deleteReceiptsByUserHandler,
  createReceipt,
  updateReceipt,
  deleteReceipt,
  deleteReceiptsByUser,
} from "./mutations";

import {
  getReceiptsByWeekHandler,
  getReceiptsByDateHandler,
} from "../../lib/convex/receipts/queries";

export const getReceiptsByWeek = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getReceiptsByWeekHandler,
});

export const getReceiptsByDate = query({
  args: {
    date: v.string(),
  },
  handler: getReceiptsByDateHandler,
});
