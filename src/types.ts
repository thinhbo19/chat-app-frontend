export type AuthUser = {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  status?: "offline" | "online";
  lastSeenAt?: string;
};

export type Room = {
  _id: string;
  name: string;
  type: "group" | "direct";
  members: Array<{
    userId: AuthUser;
    role: "owner" | "admin" | "member";
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export type FriendUser = AuthUser;

export type ChatMessageContentType = "text" | "image" | "video" | "audio";

export type ChatMessage = {
  id: string;
  roomId: string;
  contentType: ChatMessageContentType;
  text: string;
  mediaUrl: string;
  createdAt: string;
  deleted?: boolean;
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
