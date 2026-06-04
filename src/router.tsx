import { createBrowserRouter } from "react-router-dom";
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
    element: <AiExpenseQueuePanel initialItems={devAiExpenseQueueItems} />,
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
