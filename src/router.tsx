import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import {
  AppLayout,
  GuidePage,
  MaintenancePage,
  NotFoundPage,
  PrivacyPolicyPage,
  TermsPage,
  UpdatesPage,
} from "./features/app-shell";
import { DashboardPage } from "./features/dashboard";
import { InputPage } from "./features/expense-entry";
import {
  GroupInvitationAcceptPage,
  GroupDeletionStatusPage,
  GroupSelectPage,
  GroupSetupPage,
  useGroupMembership,
} from "./features/group-admin";
import { SettingsPage } from "./features/settings";
import { LineLinkCallbackPage } from "./features/settings/pages/LineLinkCallbackPage";
import { AccountDeletionPage, AccountDeletionStatusPage } from "./features/account-deletion";
import { SuzumemoLoadingState } from "./features/ui";
import { e2eRoutes, shouldEnableE2eRoutes } from "./routing/e2eRoutes";
import { useConvexAuth, useQuery } from "convex/react";
import { getMyAccountDeletionStatusApi } from "./lib/repositories/accountDeletion";
import {
  SystemAdminGroupDetailPage,
  SystemAdminGroupDeletionPage,
  SystemAdminGroupSearchPage,
  SystemAdminHomePage,
  SystemAdminAuditLogPage,
  SystemAdminManagementPage,
  SystemAdminRouteGuard,
  SystemAdminUserDetailPage,
  SystemAdminUserSearchPage,
} from "./features/system-admin";

function GroupRouteGuard() {
  const { hasGroups, needsSelection, isLoading } = useGroupMembership();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const deletionStatus = useQuery(getMyAccountDeletionStatusApi(), isAuthenticated ? {} : "skip");

  if (isAuthLoading || isLoading || (isAuthenticated && deletionStatus === undefined)) {
    return (
      <SuzumemoLoadingState
        label="グループ情報を確認中"
        message="グループ情報を確認しています。"
        variant="fullscreen"
      />
    );
  }

  if (deletionStatus !== null) {
    return <Navigate to="/settings/account/delete/status" replace />;
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
    path: "/settings/line/callback",
    element: <LineLinkCallbackPage />,
  },
  {
    path: "/guide",
    element: <GuidePage />,
  },
  {
    path: "/settings/account/delete",
    element: <AccountDeletionPage />,
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
    path: "/updates",
    element: <UpdatesPage />,
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
    path: "/settings/account/delete/status",
    element: <AccountDeletionStatusPage />,
  },
  {
    path: "/group/delete/status/:jobId",
    element: <GroupDeletionStatusPage />,
  },
  {
    path: "/admin",
    element: <SystemAdminRouteGuard />,
    children: [
      { index: true, element: <SystemAdminHomePage /> },
      { path: "users", element: <SystemAdminUserSearchPage /> },
      { path: "users/:userId", element: <SystemAdminUserDetailPage /> },
      { path: "groups", element: <SystemAdminGroupSearchPage /> },
      { path: "groups/:groupId", element: <SystemAdminGroupDetailPage /> },
      { path: "audit-logs", element: <SystemAdminAuditLogPage /> },
      { path: "system-admins", element: <SystemAdminManagementPage /> },
      { path: "group-deletion", element: <SystemAdminGroupDeletionPage /> },
    ],
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
