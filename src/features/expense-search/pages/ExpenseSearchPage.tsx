import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { listActiveApi } from "../../../lib/repositories/categories";
import { searchExpensesApi } from "../../../lib/repositories/expenseSearch";
import { SuzumemoLoadingState } from "../../ui";
import { ReceiptListCard } from "../../weekly-summary/components/ReceiptListCard";
import { ExpenseSearchFilters } from "../components/ExpenseSearchFilters";
import {
  EMPTY_EXPENSE_SEARCH_FORM,
  expenseSearchPath,
  parseExpenseSearchFormState,
  readExpenseSearchFormState,
  toExpenseSearchQueryArgs,
  type ExpenseSearchFormState,
} from "../lib/searchParams";

const PAGE_SIZE = 100;

export function ExpenseSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appliedKey = searchParams.toString();
  const applied = readExpenseSearchFormState(searchParams);
  const [draftKey, setDraftKey] = useState(appliedKey);
  const [draft, setDraft] = useState<ExpenseSearchFormState>(applied);
  const categoriesQuery = useQuery(listActiveApi());
  const categories = Array.isArray(categoriesQuery) ? categoriesQuery : [];
  const parsed = parseExpenseSearchFormState(applied);
  const queryArgs = toExpenseSearchQueryArgs(applied);
  const searchResult = useQuery(
    searchExpensesApi(),
    queryArgs.ok
      ? {
          ...queryArgs.args,
          paginationOpts: { numItems: PAGE_SIZE, cursor: null },
        }
      : "skip",
  );

  if (draftKey !== appliedKey) {
    setDraftKey(appliedKey);
    setDraft(applied);
  }

  const handleApply = (next: ExpenseSearchFormState = draft) => {
    navigate(expenseSearchPath(next));
  };

  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Typography component="h1" variant="h4">
          支出検索
        </Typography>
        <ExpenseSearchFilters
          categories={categories}
          state={draft}
          onChange={setDraft}
          onClear={() => {
            setDraft(EMPTY_EXPENSE_SEARCH_FORM);
            handleApply(EMPTY_EXPENSE_SEARCH_FORM);
          }}
          onSubmit={() => handleApply(draft)}
        />

        {!parsed.ok ? (
          <Alert severity="error" variant="outlined">
            {parsed.error}
          </Alert>
        ) : searchResult === undefined ? (
          <SuzumemoLoadingState
            label="検索結果を読み込み中"
            message="支出を検索しています…"
            variant="page"
          />
        ) : (
          <>
            {searchResult.truncated || !searchResult.isDone ? (
              <Alert severity="info" variant="outlined">
                新しい順の一部を表示しています。見つからない場合は日付や金額で絞り込んでください。
              </Alert>
            ) : null}
            <ReceiptListCard
              count={searchResult.page.length}
              emptyMessage="条件に合う支出はありません"
              heading={`検索結果（${searchResult.matchedGroupCount}件）`}
              isLoading={false}
              listAriaLabel="支出の検索結果"
              maxVisibleGroups={Number.POSITIVE_INFINITY}
              receipts={searchResult.page}
            />
          </>
        )}
      </Stack>
    </Box>
  );
}
