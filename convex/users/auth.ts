import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx, "auth">;

export type AuthState =
  | {
      isAuthenticated: false;
      userId: null;
    }
  | {
      isAuthenticated: true;
      userId: string;
    };

export function getIdentityDisplayName(identity: UserIdentity, existingDisplayName?: string) {
  const identityName = identity.name?.trim();
  if (identityName) {
    return identityName;
  }
  if (existingDisplayName && existingDisplayName !== "ユーザー") {
    return existingDisplayName;
  }
  return identity.email ?? existingDisplayName ?? "ユーザー";
}

export function getAuthStateFromIdentity(identity: UserIdentity | null): AuthState {
  if (identity === null) {
    return {
      isAuthenticated: false,
      userId: null,
    };
  }

  return {
    isAuthenticated: true,
    userId: identity.tokenIdentifier,
  };
}

export async function requireAuthenticatedUserId(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new ConvexError("Not authenticated");
  }

  return identity.tokenIdentifier;
}
