import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../services/api";
import { isValidFriendUser } from "../utils/friendUser";
import type {
  AuthUser,
  ChatMessage,
  ChatMessageContentType,
  FriendRequest,
  FriendUser,
  GroupInvite,
  OutgoingFriendRequest,
  Room,
  RoomReadStateEntry,
} from "../types";
import {
  mergeUnreadByRoomId,
  setFriends,
  setGroupInvites,
  setIncomingRequests,
  setOutgoingRequests,
  setRooms,
  setSelectedRoomId,
} from "./chatSlice";
import type { RootState } from "./store";

export const fetchRoomsAndUnread = createAsyncThunk<void, void, { state: RootState }>(
  "chat/fetchRoomsAndUnread",
  async (_, { dispatch, getState }) => {
    const selectedRoomId = getState().chat.selectedRoomId;
    const response = await api.get("/api/rooms/my");
    const list = response.data.rooms as Room[];
    dispatch(setRooms(list));
    if (!selectedRoomId && list.length > 0) {
      const firstGroup = list.find((r) => r.type === "group");
      if (firstGroup) {
        dispatch(setSelectedRoomId(firstGroup._id));
      }
    }
    try {
      const ur = await api.get<{ counts: Record<string, number> }>("/api/rooms/unread-summary");
      const counts = ur.data.counts || {};
      if (selectedRoomId) {
        counts[selectedRoomId] = 0;
      }
      dispatch(mergeUnreadByRoomId(counts));
    } catch {
      // ignore unread summary failure; room list still useful
    }
  },
);

export const fetchFriends = createAsyncThunk<void>(
  "chat/fetchFriends",
  async (_, { dispatch }) => {
    const response = await api.get("/api/friends/list");
    const raw = response.data.friends as FriendUser[];
    dispatch(setFriends(Array.isArray(raw) ? raw.filter(isValidFriendUser) : []));
  },
);

export const fetchIncomingRequests = createAsyncThunk<void, void, { state: RootState }>(
  "chat/fetchIncomingRequests",
  async (_, { dispatch, getState }) => {
    const response = await api.get("/api/friends/requests/incoming");
    const raw = response.data.requests as FriendRequest[];
    const list = Array.isArray(raw) ? raw : [];
    const uid = getState().auth.user?._id ? String(getState().auth.user?._id) : "";
    dispatch(setIncomingRequests(uid ? list.filter((r) => r && String(r.toUserId) === uid) : []));
  },
);

export const fetchOutgoingRequests = createAsyncThunk<void, void, { state: RootState }>(
  "chat/fetchOutgoingRequests",
  async (_, { dispatch, getState }) => {
    const response = await api.get("/api/friends/requests/outgoing");
    const raw = response.data.requests as OutgoingFriendRequest[];
    const list = Array.isArray(raw) ? raw : [];
    const uid = getState().auth.user?._id ? String(getState().auth.user?._id) : "";
    dispatch(setOutgoingRequests(uid ? list.filter((r) => r && String(r.fromUserId) === uid) : []));
  },
);

export const fetchPendingGroupInvites = createAsyncThunk<void>(
  "chat/fetchPendingGroupInvites",
  async (_, { dispatch }) => {
    const { data } = await api.get<{ invites: GroupInvite[] }>("/api/rooms/group-invites/pending");
    const list = Array.isArray(data.invites) ? data.invites : [];
    dispatch(
      setGroupInvites(
        list.filter(
          (inv) =>
            inv &&
            inv._id &&
            inv.roomId &&
            inv.invitedByUserId &&
            isValidFriendUser(inv.invitedByUserId),
        ),
      ),
    );
  },
);

export const fetchRoomThread = createAsyncThunk<
  { messages: ChatMessage[]; hasMore: boolean; states: RoomReadStateEntry[] },
  { roomId: string; limit?: number }
>("chat/fetchRoomThread", async ({ roomId, limit = 50 }) => {
  const [msgRes, readRes] = await Promise.all([
    api.get(`/api/rooms/${roomId}/messages`, { params: { limit } }),
    api.get(`/api/rooms/${roomId}/read-state`),
  ]);
  return {
    messages: msgRes.data.messages as ChatMessage[],
    hasMore: Boolean(msgRes.data.hasMore),
    states: readRes.data.states as RoomReadStateEntry[],
  };
});

export const fetchOlderRoomMessages = createAsyncThunk<
  { messages: ChatMessage[]; hasMore: boolean },
  { roomId: string; beforeId: string; limit?: number }
>("chat/fetchOlderRoomMessages", async ({ roomId, beforeId, limit = 50 }) => {
  const response = await api.get(`/api/rooms/${roomId}/messages`, {
    params: { before: beforeId, limit },
  });
  return {
    messages: response.data.messages as ChatMessage[],
    hasMore: Boolean(response.data.hasMore),
  };
});

export const searchRoomThreadMessages = createAsyncThunk<
  { messages: ChatMessage[] },
  { roomId: string; query: string; limit?: number }
>("chat/searchRoomThreadMessages", async ({ roomId, query, limit = 40 }) => {
  const { data } = await api.get<{ messages: ChatMessage[] }>(
    `/api/rooms/${roomId}/messages/search`,
    { params: { q: query, limit } },
  );
  return { messages: Array.isArray(data.messages) ? data.messages : [] };
});

export const recallRoomMessage = createAsyncThunk<void, { roomId: string; messageId: string }>(
  "chat/recallRoomMessage",
  async ({ roomId, messageId }) => {
    await api.delete(`/api/rooms/${roomId}/messages/${messageId}`);
  },
);

export const toggleRoomMessageReaction = createAsyncThunk<
  { message: ChatMessage },
  { roomId: string; messageId: string; emoji: string }
>("chat/toggleRoomMessageReaction", async ({ roomId, messageId, emoji }) => {
  const { data } = await api.post<{ message: ChatMessage }>(
    `/api/rooms/${roomId}/messages/${messageId}/reaction`,
    { emoji },
  );
  return { message: data.message };
});

export const pinRoomMessage = createAsyncThunk<
  { room?: Room },
  { roomId: string; messageId: string }
>("chat/pinRoomMessage", async ({ roomId, messageId }) => {
  const { data } = await api.post<{ room?: Room }>(`/api/rooms/${roomId}/pins`, { messageId });
  return { room: data.room };
});

export const unpinRoomMessage = createAsyncThunk<
  { room?: Room },
  { roomId: string; messageId: string }
>("chat/unpinRoomMessage", async ({ roomId, messageId }) => {
  const { data } = await api.delete<{ room?: Room }>(`/api/rooms/${roomId}/pins/${messageId}`);
  return { room: data.room };
});

export const patchRoomPreferences = createAsyncThunk<
  { user: AuthUser },
  { roomId: string; muted?: boolean; sidebarPinned?: boolean }
>("chat/patchRoomPreferences", async ({ roomId, muted, sidebarPinned }) => {
  const { data } = await api.patch<{ user: AuthUser }>("/api/users/me/room-prefs", {
    roomId,
    muted,
    sidebarPinned,
  });
  return { user: data.user };
});

export const createGroupRoom = createAsyncThunk<void, { name: string }>("chat/createGroupRoom", async ({ name }) => {
  await api.post("/api/rooms", { name });
});

export const sendFriendRequestThunk = createAsyncThunk<void, { toUserId: string }>(
  "chat/sendFriendRequest",
  async ({ toUserId }) => {
    await api.post("/api/friends/request", { toUserId });
  },
);

export const handleFriendRequestThunk = createAsyncThunk<
  void,
  { requestId: string; action: "accept" | "reject" }
>("chat/handleFriendRequest", async ({ requestId, action }) => {
  await api.post(`/api/friends/request/${requestId}/${action}`);
});

export const removeFriendThunk = createAsyncThunk<void, { friendUserId: string }>(
  "chat/removeFriend",
  async ({ friendUserId }) => {
    await api.delete(`/api/friends/${friendUserId}`);
  },
);

export const openDirectRoomThunk = createAsyncThunk<{ room: Room }, { friendUserId: string }>(
  "chat/openDirectRoom",
  async ({ friendUserId }) => {
    const response = await api.post(`/api/rooms/direct/${friendUserId}`);
    return { room: response.data.room as Room };
  },
);

export const patchMemberRoleThunk = createAsyncThunk<
  void,
  { roomId: string; memberUserId: string; role: "admin" | "member" }
>("chat/patchMemberRole", async ({ roomId, memberUserId, role }) => {
  await api.patch(`/api/rooms/${roomId}/members/${memberUserId}/role`, { role });
});

export const addMemberToGroupThunk = createAsyncThunk<
  void,
  { roomId: string; memberUserId: string }
>("chat/addMemberToGroup", async ({ roomId, memberUserId }) => {
  await api.post(`/api/rooms/${roomId}/members`, { memberUserId });
});

export const acceptGroupInviteThunk = createAsyncThunk<void, { inviteId: string }>(
  "chat/acceptGroupInvite",
  async ({ inviteId }) => {
    await api.post(`/api/rooms/group-invites/${inviteId}/accept`);
  },
);

export const declineGroupInviteThunk = createAsyncThunk<void, { inviteId: string }>(
  "chat/declineGroupInvite",
  async ({ inviteId }) => {
    await api.post(`/api/rooms/group-invites/${inviteId}/decline`);
  },
);

export const removeGroupMemberThunk = createAsyncThunk<
  void,
  { roomId: string; memberUserId: string }
>("chat/removeGroupMember", async ({ roomId, memberUserId }) => {
  await api.delete(`/api/rooms/${roomId}/members/${memberUserId}`);
});

export const leaveGroupRoomThunk = createAsyncThunk<
  void,
  { roomId: string; newOwnerUserId?: string }
>("chat/leaveGroupRoom", async ({ roomId, newOwnerUserId }) => {
  await api.post(`/api/rooms/${roomId}/leave`, newOwnerUserId ? { newOwnerUserId } : {});
});

export const uploadMediaThunk = createAsyncThunk<
  { mediaUrl: string; contentType: ChatMessageContentType },
  { file: File; onUploadProgress?: (loaded: number, total?: number) => void }
>("chat/uploadMedia", async ({ file, onUploadProgress }) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ mediaUrl: string; contentType: ChatMessageContentType }>(
    "/api/messages/upload",
    formData,
    {
      onUploadProgress: (ev) => {
        onUploadProgress?.(ev.loaded, ev.total);
      },
    },
  );
  return response.data;
});
