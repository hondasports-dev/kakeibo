import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import {
  AppLayout,
  MaintenancePage,
  NotFoundPage,
  PrivacyPolicyPage,
  TermsPage,
} from "./features/app-shell";
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
import { e2eRoutes, shouldEnableE2eRoutes } from "./routing/e2eRoutes";

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
  appRoutes.push(...e2eRoutes);
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
