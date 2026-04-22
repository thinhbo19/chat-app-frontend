import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ChatMessage,
  FriendRequest,
  FriendUser,
  GroupInvite,
  OutgoingFriendRequest,
  Room,
  RoomReadStateEntry,
} from "../types";

type ThreadSearchState = {
  open: boolean;
  query: string;
  loading: boolean;
  hits: ChatMessage[];
};

type ChatState = {
  rooms: Room[];
  selectedRoomId: string;
  messages: ChatMessage[];
  readStates: RoomReadStateEntry[];
  messagesHasMore: boolean;
  chatThreadLoading: boolean;
  unreadByRoomId: Record<string, number>;
  friends: FriendUser[];
  incomingRequests: FriendRequest[];
  outgoingRequests: OutgoingFriendRequest[];
  groupInvites: GroupInvite[];
  threadSearch: ThreadSearchState;
};

const initialState: ChatState = {
  rooms: [],
  selectedRoomId: "",
  messages: [],
  readStates: [],
  messagesHasMore: false,
  chatThreadLoading: false,
  unreadByRoomId: {},
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  groupInvites: [],
  threadSearch: {
    open: false,
    query: "",
    loading: false,
    hits: [],
  },
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setRooms(state, action: PayloadAction<Room[]>) {
      state.rooms = action.payload;
    },
    setSelectedRoomId(state, action: PayloadAction<string>) {
      state.selectedRoomId = action.payload;
    },
    setMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload;
    },
    appendMessage(state, action: PayloadAction<ChatMessage>) {
      if (!state.messages.some((m) => m.id === action.payload.id)) {
        state.messages.push(action.payload);
      }
    },
    replaceMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages = state.messages.map((m) => (m.id === action.payload.id ? action.payload : m));
    },
    setReadStates(state, action: PayloadAction<RoomReadStateEntry[]>) {
      state.readStates = action.payload;
    },
    mergeReadReceipt(
      state,
      action: PayloadAction<{
        userId: string;
        messageId: string;
        lastReadAt?: string;
      }>,
    ) {
      const i = state.readStates.findIndex((s) => s.userId === action.payload.userId);
      const next: RoomReadStateEntry = {
        userId: action.payload.userId,
        lastReadMessageId: action.payload.messageId,
        lastReadAt: action.payload.lastReadAt,
      };
      if (i === -1) {
        state.readStates.push(next);
      } else {
        state.readStates[i] = { ...state.readStates[i], ...next };
      }
    },
    setMessagesHasMore(state, action: PayloadAction<boolean>) {
      state.messagesHasMore = action.payload;
    },
    setChatThreadLoading(state, action: PayloadAction<boolean>) {
      state.chatThreadLoading = action.payload;
    },
    setUnreadByRoomId(state, action: PayloadAction<Record<string, number>>) {
      state.unreadByRoomId = action.payload;
    },
    mergeUnreadByRoomId(state, action: PayloadAction<Record<string, number>>) {
      state.unreadByRoomId = { ...state.unreadByRoomId, ...action.payload };
    },
    incrementUnread(state, action: PayloadAction<string>) {
      const roomId = action.payload;
      state.unreadByRoomId[roomId] = (state.unreadByRoomId[roomId] || 0) + 1;
    },
    clearUnreadForRoom(state, action: PayloadAction<string>) {
      state.unreadByRoomId[action.payload] = 0;
    },
    resetCurrentThread(state) {
      state.messages = [];
      state.readStates = [];
      state.messagesHasMore = false;
      state.chatThreadLoading = false;
    },
    setFriends(state, action: PayloadAction<FriendUser[]>) {
      state.friends = action.payload;
    },
    setIncomingRequests(state, action: PayloadAction<FriendRequest[]>) {
      state.incomingRequests = action.payload;
    },
    setOutgoingRequests(state, action: PayloadAction<OutgoingFriendRequest[]>) {
      state.outgoingRequests = action.payload;
    },
    setGroupInvites(state, action: PayloadAction<GroupInvite[]>) {
      state.groupInvites = action.payload;
    },
    setThreadSearchOpen(state, action: PayloadAction<boolean>) {
      state.threadSearch.open = action.payload;
    },
    setThreadSearchQuery(state, action: PayloadAction<string>) {
      state.threadSearch.query = action.payload;
    },
    setThreadSearchLoading(state, action: PayloadAction<boolean>) {
      state.threadSearch.loading = action.payload;
    },
    setThreadSearchHits(state, action: PayloadAction<ChatMessage[]>) {
      state.threadSearch.hits = action.payload;
    },
  },
});

export const {
  setRooms,
  setSelectedRoomId,
  setMessages,
  appendMessage,
  replaceMessage,
  setReadStates,
  mergeReadReceipt,
  setMessagesHasMore,
  setChatThreadLoading,
  setUnreadByRoomId,
  mergeUnreadByRoomId,
  incrementUnread,
  clearUnreadForRoom,
  resetCurrentThread,
  setFriends,
  setIncomingRequests,
  setOutgoingRequests,
  setGroupInvites,
  setThreadSearchOpen,
  setThreadSearchQuery,
  setThreadSearchLoading,
  setThreadSearchHits,
} = chatSlice.actions;

export default chatSlice.reducer;
