import { useState } from "react";
import { Box, Button, Stack, TextField } from "@mui/material";
import { useAuth } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import type { RouteObject } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { AiExpenseQueuePanel, AiExpenseQueuePanelProvider } from "../features/ai-expense-queue";
import {
  QueuePanelActive,
  QueuePanelDialogs,
  QueuePanelHeader,
  QueuePanelRegistered,
} from "../features/ai-expense-queue/components/QueuePanelSlots";
import {
  devAiExpenseQueueCategories,
  devAiExpenseQueueItems,
  devAiExpenseReviewDraftItems,
  devAiExpenseReviewDrafts,
} from "./e2eFixtures";

export function shouldEnableE2eRoutes() {
  // E2E 専用ルートは Vite 開発サーバー上でのみ有効。
  // Preview / Production ではホスト名・パスに関わらず無効化する。
  return import.meta.env.DEV;
}

function E2eAiExpenseQueuePage() {
  const [items, setItems] = useState(devAiExpenseQueueItems);
  const includesReviewItems = new URLSearchParams(window.location.search).get("withItems") === "1";

  return (
    <AiExpenseQueuePanel
      categories={devAiExpenseQueueCategories}
      initialItems={items}
      initialReviewDrafts={devAiExpenseReviewDrafts}
      initialReviewDraftItems={includesReviewItems ? devAiExpenseReviewDraftItems : {}}
      onReviewSubmit={(draftId, values, registerAfterUpdate) => {
        setItems((current) =>
          current.map((item) =>
            item.id === draftId
              ? {
                  ...item,
                  status: registerAfterUpdate ? "registered" : "ready",
                  documentType: values.documentType,
                  title: values.shopName,
                  amountYen: values.amountYen,
                  reviewReasons: [],
                }
              : item,
          ),
        );
        return {
          status: registerAfterUpdate ? "registered" : "ready",
          reviewReasons: [],
        };
      }}
    />
  );
}

/** Issue #400 / #401 E2E: 入力ワークベンチの DOM/CSS 契約を検証する */
function E2eInputWorkbenchPage() {
  return (
    <Box className="app-main" sx={{ minWidth: 0, maxWidth: "100%" }}>
      <AiExpenseQueuePanelProvider
        categories={devAiExpenseQueueCategories}
        initialItems={devAiExpenseQueueItems}
      >
        <Box className="input-workbench input-workbench--expense">
          <QueuePanelHeader
            className="input-workbench-queue-header ai-expense-queue"
            component="section"
          />
          <QueuePanelActive className="input-workbench-queue-active input-workbench-queue-block" />
          <form
            className="input-workbench-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <Stack spacing={2} sx={{ maxWidth: "100%", minWidth: 0 }}>
              <TextField autoComplete="off" label="店舗名 / 支払先" name="shopName" />
              <Button type="submit" variant="contained">
                保存して次へ
              </Button>
            </Stack>
          </form>
          <QueuePanelRegistered className="input-workbench-queue-registered input-workbench-queue-block" />
          <QueuePanelDialogs categories={devAiExpenseQueueCategories} />
        </Box>
      </AiExpenseQueuePanelProvider>
    </Box>
  );
}

/**
 * Issue #179 E2Eテスト用ページ
 * registerReadyDraftsAsExpenseEntries を使ってexpenseEntriesに登録するテスト用
 */
function E2eRegisterAsExpenseEntriesPage() {
  const draftId = new URLSearchParams(window.location.search).get("draftId");
  const { isLoaded, isSignedIn } = useAuth();
  const categories = useQuery(
    api.categories.queries.listActive,
    isLoaded && isSignedIn ? {} : "skip",
  );
  const group = useQuery(api.groups.queries.getMyGroup, isLoaded && isSignedIn ? {} : "skip");
  const authenticatedUserId = useQuery(
    api.users.queries.getAuthenticatedUserId,
    isLoaded && isSignedIn ? {} : "skip",
  );
  const [result, setResult] = useState<{
    registeredDraftIds: Id<"aiExpenseDrafts">[];
    createdExpenseEntryIds: Id<"expenseEntries">[];
    alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const registerMutation = useMutation(
    api.aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries,
  );
  const isAuthReady = isLoaded && isSignedIn;
  const isConvexReady =
    categories !== undefined && group !== undefined && authenticatedUserId !== undefined;
  const isReady = isAuthReady && isConvexReady;

  const handleRegister = async () => {
    if (!isReady) {
      setError("authentication or convex connection is not ready yet");
      return;
    }
    if (!draftId) {
      setError("draftId query param is required");
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      const res = await registerMutation({
        draftIds: [draftId as Id<"aiExpenseDrafts">],
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Issue #179 E2E Test: Register as Expense Entries</h1>
      <p data-testid="auth-status">{isAuthReady ? "ready" : "loading"}</p>
      <p data-testid="convex-status">{isConvexReady ? "ready" : "loading"}</p>
      <p data-testid="current-user-id">{authenticatedUserId ?? ""}</p>
      <p data-testid="current-group-id">{group?._id ?? ""}</p>
      <p data-testid="draft-id">{draftId ?? ""}</p>
      <button onClick={handleRegister} type="button" disabled={isLoading || !isReady}>
        {isLoading ? "登録中..." : "下書きをexpenseEntriesに登録"}
      </button>
      {error && (
        <div style={{ color: "#B85A4C", marginTop: "1rem" }} data-testid="error">
          Error: {error}
        </div>
      )}
      {result && (
        <div style={{ marginTop: "1rem" }} data-testid="result">
          <h2>Result:</h2>
          <dl>
            <dt>registeredDraftCount</dt>
            <dd data-testid="registered-draft-count">{result.registeredDraftIds.length}</dd>
            <dt>createdExpenseEntryCount</dt>
            <dd data-testid="created-entry-count">{result.createdExpenseEntryIds.length}</dd>
            <dt>createdExpenseEntryIds</dt>
            <dd data-testid="created-entry-ids">{result.createdExpenseEntryIds.join(",")}</dd>
          </dl>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export const e2eRoutes: RouteObject[] = [
  {
    path: "/__e2e__/ai-expense-queue",
    element: <E2eAiExpenseQueuePage />,
  },
  {
    path: "/__e2e__/input-workbench",
    element: <E2eInputWorkbenchPage />,
  },
  {
    path: "/__e2e__/ai-expense-queue-expense-entries",
    element: <E2eRegisterAsExpenseEntriesPage />,
  },
];
