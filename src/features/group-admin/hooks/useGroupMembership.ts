import { useConvexAuth, useQuery } from "convex/react";
import { getMyGroupApi, listMyGroupsApi } from "../../../lib/repositories/groups";

export function useGroupMembership() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const group = useQuery(getMyGroupApi(), isAuthenticated ? {} : "skip");
  const groups = useQuery(listMyGroupsApi(), isAuthenticated ? {} : "skip");

  const hasGroups = Array.isArray(groups) && groups.length > 0;
  const needsSelection = Array.isArray(groups) && groups.length > 1 && group === null;

  return {
    group,
    groups,
    hasGroups,
    needsSelection,
    isLoading: isAuthLoading || (isAuthenticated && (group === undefined || groups === undefined)),
  };
}
