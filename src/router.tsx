import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  AppLayout,
  MaintenancePage,
  NotFoundPage,
  PrivacyPolicyPage,
  TermsPage,
} from "./features/app-shell";
import { AiExpenseQueuePanel, type AiExpenseQueueItem } from "./features/ai-expense-queue";
import { DashboardPage } from "./features/dashboard";
import { InputPage } from "./features/expense-entry";
import {
  GroupInvitationAcceptPage,
  GroupSelectPage,
  GroupSetupPage,
  useGroupMembership,
} from "./features/group-admin";
import { SettingsPage } from "./features/settings";
import { SuzumemoLoadingState } from "./features/ui";

const devAiExpenseQueueItems: AiExpenseQueueItem[] = [
  {
    id: "e2e-ready-draft",
    fileName: "ready-receipt.png",
    status: "ready",
    documentType: "receipt",
    title: "スーパー北浜",
    amountYen: 4280,
    date: "2026-06-08",
    categoryName: "食費",
  },
  {
    id: "e2e-review-draft",
    fileName: "review-payment.png",
    status: "needs_review",
    documentType: "convenience_payment",
    title: "公共料金",
    amountYen: 9120,
    reviewReasons: ["low_confidence", "missing_required_field"],
    date: "2026-06-01",
    categoryName: "水道光熱費",
  },
  {
    id: "e2e-failed-draft",
    fileName: "failed-receipt.png",
    status: "failed",
    documentType: "unknown",
    title: "読み取り失敗",
    reviewReasons: ["parse_failed"],
  },
];

function shouldEnableE2eRoutes() {
  if (import.meta.env.DEV) {
    return true;
  }

  const { hostname, pathname } = window.location;
  const isLocalPreview = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercelPreview = hostname.endsWith(".vercel.app");
  const isE2ePath = pathname.startsWith("/__e2e__/");

  return isE2ePath && (isLocalPreview || isVercelPreview);
}

const devAiExpenseQueueCategories = [
  { _id: "e2e-cat-utilities", name: "水道光熱費", color: "#AAB7C4" },
  { _id: "e2e-cat-food", name: "食費", color: "#A6B28B" },
];

const devAiExpenseReviewDrafts = {
  "e2e-review-draft": {
    _id: "e2e-review-draft",
    status: "needs_review" as const,
    documentType: "convenience_payment" as const,
    shopName: "",
    paymentPlace: "セブンイレブン北浜店",
    payeeName: "大阪市水道局",
    paymentPurpose: "",
    date: "2026-06-01",
    amountYen: 9120,
    categoryId: "e2e-cat-utilities",
    reviewReasons: ["low_confidence", "missing_required_field"],
    warnings: ["支払内容の印字が薄いため確認してください"],
  },
};

function E2eAiExpenseQueuePage() {
  const [items, setItems] = useState(devAiExpenseQueueItems);

  return (
    <AiExpenseQueuePanel
      categories={devAiExpenseQueueCategories}
      initialItems={items}
      initialReviewDrafts={devAiExpenseReviewDrafts}
      onReviewSubmit={(draftId, values, registerAfterUpdate) => {
        setItems((current) =>
          current.map((item) =>
            item.id === draftId
              ? {
                  ...item,
                  status: registerAfterUpdate ? "registered" : "ready",
                  documentType: values.documentType,
                  title: values.shopName || values.payeeName || values.paymentPlace,
                  amountYen: values.amountYen,
                  reviewReasons: [],
                }
              : item,
          ),
        );
      }}
    />
  );
}

/**
 * Issue #179 E2Eテスト用ページ
 * registerReadyDraftsAsExpenseEntries を使ってexpenseEntriesに登録するテスト用
 */
function E2eRegisterAsExpenseEntriesPage() {
  const draftId = new URLSearchParams(window.location.search).get("draftId");
  const { isLoaded, isSignedIn } = useAuth();
  const categories = useQuery(api.categories.listActive, isLoaded && isSignedIn ? {} : "skip");
  const group = useQuery(api.groups.getMyGroup, isLoaded && isSignedIn ? {} : "skip");
  const authenticatedUserId = useQuery(
    api.users.getAuthenticatedUserId,
    isLoaded && isSignedIn ? {} : "skip",
  );
  const [result, setResult] = useState<{
    registeredDraftIds: Id<"aiExpenseDrafts">[];
    createdExpenseEntryIds: Id<"expenseEntries">[];
    alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const registerMutation = useMutation(api.aiExpenseDrafts.registerReadyDraftsAsExpenseEntries);
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
          </dl>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function GroupRouteGuard() {
  const { hasGroups, needsSelection, isLoading } = useGroupMembership();

  if (isLoading) {
    return (
      <SuzumemoLoadingState
        label="グループ情報を確認中"
        message="グループ情報を確認しています。"
        variant="fullscreen"
      />
    );
  }

  if (!hasGroups) {
    return <Navigate to="/group/setup" replace />;
  }

  if (needsSelection) {
    return <Navigate to="/group/select" replace />;
  }

  return <AppLayout />;
}

function SummaryRouteFallback() {
  return (
    <SuzumemoLoadingState
      label="週次サマリーを読み込み中"
      message="週次サマリーを読み込んでいます…"
      variant="page"
    />
  );
}

const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <DashboardPage />,
  },
  {
    path: "/weeks/current/input",
    element: <InputPage />,
  },
  {
    path: "/weeks/:weekStartDate",
    HydrateFallback: SummaryRouteFallback,
    lazy: async () => {
      const { SummaryPage } = await import("./features/weekly-summary/pages/SummaryPage");
      return { Component: SummaryPage };
    },
  },
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  {
    path: "/categories",
    element: <SettingsPage />,
  },
];

if (shouldEnableE2eRoutes()) {
  appRoutes.push({
    path: "/__e2e__/ai-expense-queue",
    element: <E2eAiExpenseQueuePage />,
  });
  appRoutes.push({
    path: "/__e2e__/ai-expense-queue-expense-entries",
    element: <E2eRegisterAsExpenseEntriesPage />,
  });
}

export const router = createBrowserRouter([
  {
    path: "/privacy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/terms",
    element: <TermsPage />,
  },
  {
    path: "/maintenance",
    element: <MaintenancePage />,
  },
  {
    path: "/group/setup",
    element: <GroupSetupPage />,
  },
  {
    path: "/group/select",
    element: <GroupSelectPage />,
  },
  {
    path: "/group/invitations/accept",
    element: <GroupInvitationAcceptPage />,
  },
  {
    element: <GroupRouteGuard />,
    children: appRoutes,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
