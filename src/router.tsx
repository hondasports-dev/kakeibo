import { createBrowserRouter } from "react-router-dom";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { AppLayout } from "./components/AppLayout";
import { AiExpenseQueuePanel, type AiExpenseQueueItem } from "./components/AiExpenseQueuePanel";
import { SettingsPage } from "./pages/SettingsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InputPage } from "./pages/InputPage";
import { SummaryPage } from "./pages/SummaryPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const devAiExpenseQueueItems: AiExpenseQueueItem[] = [
  {
    id: "e2e-ready-draft",
    fileName: "ready-receipt.png",
    status: "ready",
    documentType: "receipt",
    title: "スーパー北浜",
    amountYen: 4280,
  },
  {
    id: "e2e-review-draft",
    fileName: "review-payment.png",
    status: "needs_review",
    documentType: "convenience_payment",
    title: "公共料金",
    amountYen: 9120,
    reviewReasons: ["low_confidence", "missing_required_field"],
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

const devAiExpenseQueueCategories = [
  { _id: "e2e-cat-utilities", name: "水道光熱費", color: "#2563EB" },
  { _id: "e2e-cat-food", name: "食費", color: "#16A34A" },
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
  const [result, setResult] = useState<{
    registeredDraftIds: Id<"aiExpenseDrafts">[];
    createdExpenseEntryIds: Id<"expenseEntries">[];
    alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registerMutation = useMutation(api.aiExpenseDrafts.registerReadyDraftsAsExpenseEntries);

  const handleRegister = async () => {
    try {
      setError(null);
      // E2Eテスト用に既存のready状態の下書きを登録
      const res = await registerMutation({
        draftIds: ["e2e-ready-draft" as Id<"aiExpenseDrafts">],
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Issue #179 E2E Test: Register as Expense Entries</h1>
      <button onClick={handleRegister} type="button">
        下書きをexpenseEntriesに登録
      </button>
      {error && <div style={{ color: "red", marginTop: "1rem" }}>Error: {error}</div>}
      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

const appRoutes = [
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
    element: <SummaryPage />,
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

if (import.meta.env.DEV) {
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
    element: <AppLayout />,
    children: [
      ...appRoutes,
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
