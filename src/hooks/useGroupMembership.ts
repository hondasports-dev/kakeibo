import { useAuth } from "@clerk/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGroupMembership() {
  const { isLoaded, isSignedIn } = useAuth();
  const group = useQuery(api.groups.getMyGroup, isLoaded && isSignedIn ? {} : "skip");

  return {
    group,
    isLoading: isLoaded && isSignedIn && group === undefined,
  };
}
