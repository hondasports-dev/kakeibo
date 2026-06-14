import type { Id } from "../../../convex/_generated/dataModel";

export type ExpenseEntryCategory = {
  _id: Id<"categories">;
  name: string;
  color: string;
};

export type ExpenseEntryItem = {
  categoryId: string;
  amountYen: string;
  title: string;
  memo: string;
};

export type ExpenseEntryItemErrors = {
  categoryId?: string;
  amountYen?: string;
  title?: string;
  memo?: string;
};
