import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGroupMembership() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const group = useQuery(api.groups.getMyGroup, isAuthenticated ? {} : "skip");
  const groups = useQuery(api.groups.listMyGroups, isAuthenticated ? {} : "skip");

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
