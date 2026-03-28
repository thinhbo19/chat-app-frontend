export type ChatRoomPref = {
  roomId: string;
  muted: boolean;
  sidebarPinned: boolean;
};

export type AuthUser = {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  phone?: string;
  status?: "offline" | "online";
  lastSeenAt?: string;
  chatRoomPrefs?: ChatRoomPref[];
};

export type Room = {
  _id: string;
  name: string;
  /** URL ảnh đại diện nhóm; rỗng = hiển thị chữ cái / icon mặc định */
  avatar?: string;
  type: "group" | "direct";
  members: Array<{
    userId: AuthUser | null;
    role: "owner" | "admin" | "member";
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pinnedMessageIds?: string[];
};

export type FriendRequest = {
  _id: string;
  fromUserId: AuthUser;
  toUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
};

export type OutgoingFriendRequest = {
  _id: string;
  fromUserId: string;
  toUserId: AuthUser;
  status: "pending";
  createdAt: string;
  updatedAt: string;
};

/** Lời mời vào nhóm (chờ người được mời chấp nhận). */
export type GroupInvite = {
  _id: string;
  roomId: { _id: string; name: string; avatar?: string; type: string } | null;
  invitedByUserId: AuthUser | null;
  status: string;
  createdAt: string;
};

export type FriendUser = AuthUser;

export type ChatMessageContentType = "text" | "image" | "video" | "audio";

export type MessageReaction = {
  userId: string;
  username: string;
  emoji: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  contentType: ChatMessageContentType;
  text: string;
  mediaUrl: string;
  createdAt: string;
  deleted?: boolean;
  reactions?: MessageReaction[];
  sender: {
    id: string;
    username: string;
  };
};

export type RoomReadStateEntry = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt?: string;
};
