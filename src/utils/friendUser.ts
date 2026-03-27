import type { FriendUser } from "../types";

export function isValidFriendUser(f: FriendUser | null | undefined): f is FriendUser {
  return (
    f != null &&
    typeof f === "object" &&
    typeof f._id === "string" &&
    f._id.length > 0
  );
}
