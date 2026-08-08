/**
 * Clerk ユーザー情報から profile を導出する Convex アダプタ。
 * 純粋なドメインルールは lib/domain/users/clerkProfile.ts に委ねる。
 */
export {
  getClerkUserDisplayName,
  getPrimaryVerifiedClerkEmailAddress,
  getVerifiedClerkEmailAddresses,
  type ClerkEmailAddress,
  type ClerkUserWithEmails,
} from "../../../lib/domain/users/clerkProfile";
