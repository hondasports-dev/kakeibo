import { parseExpenseSearchFilters } from "../../../../lib/domain/expenseSearch/filter";
import type { Id } from "../../../../convex/_generated/dataModel";

export type ExpenseSearchFormState = {
  shopQuery: string;
  categoryId: string;
  minAmountYen: string;
  maxAmountYen: string;
  startDate: string;
  endDate: string;
};

export const EMPTY_EXPENSE_SEARCH_FORM: ExpenseSearchFormState = {
  shopQuery: "",
  categoryId: "",
  minAmountYen: "",
  maxAmountYen: "",
  startDate: "",
  endDate: "",
};

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number.parseInt(trimmed, 10);
}

export function readExpenseSearchFormState(searchParams: URLSearchParams): ExpenseSearchFormState {
  return {
    shopQuery: searchParams.get("q") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    minAmountYen: searchParams.get("min") ?? "",
    maxAmountYen: searchParams.get("max") ?? "",
    startDate: searchParams.get("from") ?? "",
    endDate: searchParams.get("to") ?? "",
  };
}

export function expenseSearchFormToSearchParams(state: ExpenseSearchFormState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.shopQuery.trim()) params.set("q", state.shopQuery.trim());
  if (state.categoryId) params.set("categoryId", state.categoryId);
  if (state.minAmountYen.trim()) params.set("min", state.minAmountYen.trim());
  if (state.maxAmountYen.trim()) params.set("max", state.maxAmountYen.trim());
  if (state.startDate) params.set("from", state.startDate);
  if (state.endDate) params.set("to", state.endDate);
  return params;
}

export function expenseSearchPath(state: ExpenseSearchFormState): string {
  const params = expenseSearchFormToSearchParams(state);
  const query = params.toString();
  return query.length > 0 ? `/search?${query}` : "/search";
}

export function parseExpenseSearchFormState(state: ExpenseSearchFormState) {
  const minAmountYen = parseOptionalInteger(state.minAmountYen);
  const maxAmountYen = parseOptionalInteger(state.maxAmountYen);
  if (Number.isNaN(minAmountYen) || Number.isNaN(maxAmountYen)) {
    return { ok: false as const, error: "金額は0以上の整数で指定してください" };
  }

  return parseExpenseSearchFilters({
    shopQuery: state.shopQuery,
    categoryId: state.categoryId || undefined,
    minAmountYen,
    maxAmountYen,
    startDate: state.startDate || undefined,
    endDate: state.endDate || undefined,
  });
}

export function toExpenseSearchQueryArgs(state: ExpenseSearchFormState) {
  const parsed = parseExpenseSearchFormState(state);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true as const,
    args: {
      shopQuery: parsed.filters.shopQuery,
      categoryId: parsed.filters.categoryId
        ? (parsed.filters.categoryId as Id<"categories">)
        : undefined,
      minAmountYen: parsed.filters.minAmountYen,
      maxAmountYen: parsed.filters.maxAmountYen,
      startDate: parsed.filters.startDate,
      endDate: parsed.filters.endDate,
    },
  };
}
