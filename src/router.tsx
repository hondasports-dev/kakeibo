import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { InputPage } from "./pages/InputPage";
import { SummaryPage } from "./pages/SummaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
