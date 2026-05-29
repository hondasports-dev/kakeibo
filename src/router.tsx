import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InputPage } from "./pages/InputPage";
import { SummaryPage } from "./pages/SummaryPage";
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
        path: "/categories",
        element: <CategoriesPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
