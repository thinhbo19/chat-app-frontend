import type { AuthUser, Room } from "../types";

export type RoomMemberPopulated = {
  userId: AuthUser;
  role: Room["members"][number]["role"];
};

/** `populate('members.userId')` có thể trả null nếu user đã xóa / tham chiếu hỏng. */
export function isRoomMemberPopulated(
  m: Room["members"][number],
): m is RoomMemberPopulated {
  const u = m.userId;
  return u != null && typeof u === "object" && typeof (u as AuthUser)._id === "string";
}
