import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatComposeRow, type ChatComposeRowHandle } from "../components/chat/ChatComposeRow";
import { io, Socket } from "socket.io-client";
import {
  FiCamera,
  FiCheck,
  FiClock,
  FiInbox,
  FiInfo,
  FiLogOut,
  FiHash,
  FiMenu,
  FiMessageCircle,
  FiPhone,
  FiSearch,
  FiSettings,
  FiUpload,
  FiUserMinus,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
  message,
  notification,
} from "antd";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN_REFRESHED_EVENT, api, getAccessToken } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AvatarWithStatus } from "../components/AvatarWithStatus";
import { PersonalProfileModal } from "../components/profile/PersonalProfileModal";

const ChatSidebarBody = lazy(() =>
  import("../components/chat/ChatSidebarBody").then((m) => ({ default: m.ChatSidebarBody })),
);
const ChatMessageList = lazy(() =>
  import("../components/chat/ChatMessageList").then((m) => ({ default: m.ChatMessageList })),
);
import { useChatSettings } from "../context/ChatSettingsContext";
import { getApiErrorMessage } from "../utils/apiError";
import { formatChatHeaderPresence } from "../utils/formatPresence";
import { playMessageBeep, unlockMessageAudio } from "../utils/messageSound";
import { vi } from "../strings/vi";
import { isValidFriendUser } from "../utils/friendUser";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { isRoomMemberPopulated } from "../utils/roomMember";
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

const API_BASE_URL = import.meta.env.VITE_API_URL;

const BROWSE_PAGE_SIZE = 40;
const UPLOAD_MAX_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB) || 25;
const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;

const { Title, Text } = Typography;

function getRoomDisplayName(room: Room, myUserId: string) {
  if (room.type !== "direct") {
    return room.name;
  }
  const counterpart = room.members.find(
    (member) => isRoomMemberPopulated(member) && member.userId._id !== myUserId,
  )?.userId;
  return counterpart?.username ? `${counterpart.username}` : vi.chat.directFallback;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout, updateCurrentUser, loadProfile } = useAuth();
  const {
    theme,
    setTheme,
    desktopNotify,
    setDesktopNotify,
    soundNotify,
    setSoundNotify,
    requestNotificationPermission,
  } = useChatSettings();
  /** Desktop rail: một panel trái tại một thời điểm (tìm kiếm / chờ / lời mời). */
  const [railPanel, setRailPanel] = useState<null | "search" | "outgoing" | "incoming">(null);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const composeRef = useRef<ChatComposeRowHandle>(null);
  const [roomName, setRoomName] = useState("");

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingFriendRequest[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupInviteActionId, setGroupInviteActionId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [discoveryList, setDiscoveryList] = useState<FriendUser[]>([]);
  const [discoveryMode, setDiscoveryMode] = useState<"browse" | "search">("browse");
  const [browseNextCursor, setBrowseNextCursor] = useState<string | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false);
  const discoveryListScrollRef = useRef<HTMLDivElement>(null);
  const discoveryModeRef = useRef<"browse" | "search">("browse");
  const browseNextCursorRef = useRef<string | null>(null);
  const browseMoreLockRef = useRef(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(
    null,
  );
  const [pendingImageModalOpen, setPendingImageModalOpen] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  /** Mobile (narrow): single left drawer = sidebar + cài đặt/tìm kiếm. Desktop: chỉ dùng cho drawer phụ. */
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [readStates, setReadStates] = useState<RoomReadStateEntry[]>([]);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatThreadLoading, setChatThreadLoading] = useState(false);
  const [groupAvatarSaving, setGroupAvatarSaving] = useState(false);
  const groupAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [leaveGroupLoading, setLeaveGroupLoading] = useState(false);
  const [leaveOwnerModalOpen, setLeaveOwnerModalOpen] = useState(false);
  const [leaveTransferUserId, setLeaveTransferUserId] = useState<string>("");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRoomIdRef = useRef("");
  const settingsRef = useRef({
    soundNotify: true,
    desktopNotify: false,
  });
  const markReadTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [unreadByRoomId, setUnreadByRoomId] = useState<Record<string, number>>({});
  const [presenceClock, setPresenceClock] = useState(0);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [threadSearchLoading, setThreadSearchLoading] = useState(false);
  const [threadSearchHits, setThreadSearchHits] = useState<ChatMessage[]>([]);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const id = window.setInterval(() => setPresenceClock((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    setHighlightMessageId(null);
    setPendingScrollMessageId(null);
  }, [selectedRoomId]);

  useEffect(() => {
    settingsRef.current = { soundNotify, desktopNotify };
  }, [soundNotify, desktopNotify]);

  useEffect(() => {
    const onGesture = () => {
      unlockMessageAudio();
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 992px)");
    const sync = () => setIsNarrowLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isNarrowLayout) {
      setMobileLeftOpen(false);
    }
  }, [isNarrowLayout]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setSocket(null);
      return;
    }

    const nextSocket = io(API_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
    setSocket(nextSocket);
    nextSocket.connect();

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const onTokenRefreshed = () => {
      const s = socketRef.current;
      if (!s) return;
      const t = getAccessToken();
      if (!t) return;
      s.auth = { token: t };
      if (s.connected) {
        s.disconnect();
      }
      s.connect();
    };
    window.addEventListener(ACCESS_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
    return () => window.removeEventListener(ACCESS_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
  }, []);

  const loadRooms = useCallback(async () => {
    const response = await api.get("/api/rooms/my");
    const list = response.data.rooms as Room[];
    let nextSelectedId = selectedRoomId;
    if (!nextSelectedId && list.length > 0) {
      const firstGroup = list.find((r) => r.type === "group");
      if (firstGroup) {
        nextSelectedId = firstGroup._id;
        setSelectedRoomId(firstGroup._id);
      }
    }
    setRooms(list);
    try {
      const ur = await api.get<{ counts: Record<string, number> }>("/api/rooms/unread-summary");
      const counts = ur.data.counts || {};
      setUnreadByRoomId((prev) => {
        const next = { ...prev, ...counts };
        if (nextSelectedId) next[nextSelectedId] = 0;
        return next;
      });
    } catch {
      /* ignore */
    }
  }, [selectedRoomId]);

  const loadFriends = useCallback(async () => {
    const response = await api.get("/api/friends/list");
    const raw = response.data.friends as FriendUser[];
    setFriends(Array.isArray(raw) ? raw.filter(isValidFriendUser) : []);
  }, []);

  const handleProfileUserUpdated = useCallback(
    (u: AuthUser) => {
      updateCurrentUser(u);
      void loadRooms();
      void loadFriends();
    },
    [updateCurrentUser, loadRooms, loadFriends],
  );

  const loadIncomingRequests = useCallback(async () => {
    const response = await api.get("/api/friends/requests/incoming");
    const raw = response.data.requests as FriendRequest[];
    const list = Array.isArray(raw) ? raw : [];
    const uid = user?._id ? String(user._id) : "";
    setIncomingRequests(
      uid ? list.filter((r) => r && String(r.toUserId) === uid) : [],
    );
  }, [user?._id]);

  const loadOutgoingRequests = useCallback(async () => {
    const response = await api.get("/api/friends/requests/outgoing");
    const raw = response.data.requests as OutgoingFriendRequest[];
    const list = Array.isArray(raw) ? raw : [];
    const uid = user?._id ? String(user._id) : "";
    setOutgoingRequests(
      uid ? list.filter((r) => r && String(r.fromUserId) === uid) : [],
    );
  }, [user?._id]);

  const loadPendingGroupInvites = useCallback(async () => {
    try {
      const { data } = await api.get<{ invites: GroupInvite[] }>(
        "/api/rooms/group-invites/pending",
      );
      const list = Array.isArray(data.invites) ? data.invites : [];
      setGroupInvites(
        list.filter(
          (inv) =>
            inv &&
            inv._id &&
            inv.roomId &&
            inv.invitedByUserId &&
            isValidFriendUser(inv.invitedByUserId),
        ),
      );
    } catch {
      message.error(vi.errors.loadGroupInvites);
      setGroupInvites([]);
    }
  }, []);

  useEffect(() => {
    discoveryModeRef.current = discoveryMode;
  }, [discoveryMode]);

  useEffect(() => {
    browseNextCursorRef.current = browseNextCursor;
  }, [browseNextCursor]);

  const fetchBrowse = useCallback(async (after?: string | null) => {
    const params: Record<string, string | number> = { limit: BROWSE_PAGE_SIZE };
    if (after) params.after = after;
    const { data } = await api.get<{ users: FriendUser[]; nextCursor: string | null }>(
      "/api/users/browse",
      { params },
    );
    return data;
  }, []);

  const loadBrowseFirstPage = useCallback(async () => {
    setDiscoveryMode("browse");
    setBrowseNextCursor(null);
    browseNextCursorRef.current = null;
    setBrowseLoading(true);
    try {
      const data = await fetchBrowse();
      setDiscoveryList(data.users);
      setBrowseNextCursor(data.nextCursor);
    } catch {
      message.error(vi.errors.loadUserBrowse);
      setDiscoveryList([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [fetchBrowse]);

  const loadBrowseMore = useCallback(async () => {
    if (discoveryModeRef.current !== "browse") return;
    const after = browseNextCursorRef.current;
    if (after == null || browseMoreLockRef.current) return;
    browseMoreLockRef.current = true;
    setBrowseLoadingMore(true);
    try {
      const data = await fetchBrowse(after);
      setDiscoveryList((prev) => {
        const seen = new Set(prev.map((u) => u._id));
        const extra = data.users.filter((u) => !seen.has(u._id));
        return [...prev, ...extra];
      });
      setBrowseNextCursor(data.nextCursor);
    } catch {
      message.error(vi.errors.loadUserBrowse);
    } finally {
      setBrowseLoadingMore(false);
      browseMoreLockRef.current = false;
    }
  }, [fetchBrowse]);

  useEffect(() => {
    if (railPanel !== "search") return;
    setSearchText("");
    void loadBrowseFirstPage();
  }, [railPanel, loadBrowseFirstPage]);

  const loadOlderMessages = useCallback(
    async (beforeId: string) => {
      if (!selectedRoomId || !messagesHasMore || loadingOlder) return;
      const wrap = messagesScrollRef.current;
      const prevScrollHeight = wrap?.scrollHeight ?? 0;
      setLoadingOlder(true);
      try {
        const r = await api.get(`/api/rooms/${selectedRoomId}/messages`, {
          params: { before: beforeId, limit: 50 },
        });
        const older = r.data.messages as ChatMessage[];
        setMessages((m) => {
          const ids = new Set(m.map((x) => x.id));
          const prep = older.filter((x) => !ids.has(x.id));
          return [...prep, ...m];
        });
        setMessagesHasMore(r.data.hasMore);
        requestAnimationFrame(() => {
          const el = messagesScrollRef.current;
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      } catch {
        message.error(vi.errors.loadOlder);
      } finally {
        setLoadingOlder(false);
      }
    },
    [selectedRoomId, messagesHasMore, loadingOlder],
  );

  useEffect(() => {
    if (!pendingScrollMessageId || !selectedRoomId) return;
    const found = messages.some((m) => m.id === pendingScrollMessageId);
    if (found) {
      setHighlightMessageId(pendingScrollMessageId);
      setPendingScrollMessageId(null);
      setThreadSearchOpen(false);
      return;
    }
    if (loadingOlder) return;
    if (!messagesHasMore) {
      message.info(vi.chat.scrollToMessageFail);
      setPendingScrollMessageId(null);
      return;
    }
    const first = messages[0];
    if (!first) {
      message.info(vi.chat.scrollToMessageFail);
      setPendingScrollMessageId(null);
      return;
    }
    void loadOlderMessages(first.id);
  }, [
    pendingScrollMessageId,
    messages,
    messagesHasMore,
    loadingOlder,
    selectedRoomId,
    loadOlderMessages,
  ]);

  useEffect(() => {
    loadRooms().catch(() => message.error(vi.errors.loadRooms));
    loadFriends().catch(() => message.error(vi.errors.loadFriends));
    loadIncomingRequests().catch(() => message.error(vi.errors.loadIncoming));
    loadOutgoingRequests().catch(() => message.error(vi.errors.loadOutgoing));
    loadPendingGroupInvites().catch(() => null);
  }, [
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
    loadRooms,
  ]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      void loadRooms();
      void loadPendingGroupInvites();
    };
    const handleConnectError = (error: Error) => {
      const latestToken = getAccessToken();
      if (latestToken) {
        socket.auth = { token: latestToken };
      }
      message.error(vi.errors.socket(error.message));
    };

    function previewIncoming(m: ChatMessage) {
      if (m.deleted) return vi.preview.recalled;
      if (m.contentType === "image") return vi.preview.image;
      if (m.contentType === "video") return vi.preview.video;
      if (m.contentType === "audio") return vi.preview.audio;
      return (m.text || "").slice(0, 120) || vi.preview.message;
    }

    const handleNewMessage = (incoming: ChatMessage) => {
      const roomId = selectedRoomIdRef.current;
      const incomingRoomId = String(incoming.roomId);
      if (incomingRoomId === roomId) {
        setMessages((prev) => {
          if (prev.some((p) => p.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      }
      const myId = user?._id ? String(user._id) : "";
      const senderId = String(incoming.sender.id || "");
      const fromOther = Boolean(myId && senderId && senderId !== myId);
      if (fromOther && incomingRoomId !== roomId) {
        setUnreadByRoomId((prev) => ({
          ...prev,
          [incomingRoomId]: (prev[incomingRoomId] || 0) + 1,
        }));
      }
      if (!fromOther) return;
      const prefs = userRef.current?.chatRoomPrefs;
      const mutedRoom = Boolean(prefs?.find((x) => x.roomId === incomingRoomId)?.muted);
      const { soundNotify: snd, desktopNotify: dsk } = settingsRef.current;
      const isCurrentRoom = incomingRoomId === roomId;
      if (!mutedRoom) {
        if (!isCurrentRoom) {
          if (document.visibilityState === "visible") {
            notification.info({
              key: `incoming-${incomingRoomId}`,
              message: incoming.sender.username,
              description: previewIncoming(incoming),
              placement: "topRight",
              duration: 4.5,
            });
          } else if (
            dsk &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(incoming.sender.username, {
              body: previewIncoming(incoming),
              tag: incoming.id,
            });
          }
        }
        if (snd && (!isCurrentRoom || document.visibilityState === "hidden")) {
          playMessageBeep();
        }
      }
    };

    const handleMessageUpdated = (updated: ChatMessage) => {
      setMessages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    };

    const handleReadReceipt = (payload: {
      roomId: string;
      userId: string;
      messageId: string;
      lastReadAt?: string;
    }) => {
      if (payload.roomId !== selectedRoomIdRef.current) return;
      setReadStates((prev) => {
        const i = prev.findIndex((s) => s.userId === payload.userId);
        const next: RoomReadStateEntry = {
          userId: payload.userId,
          lastReadMessageId: payload.messageId,
          lastReadAt: payload.lastReadAt,
        };
        if (i === -1) return [...prev, next];
        const copy = [...prev];
        copy[i] = { ...copy[i], ...next };
        return copy;
      });
    };

    const handleUserStatus = (payload: {
      userId: string;
      status: "online" | "offline";
      lastSeenAt?: string;
    }) => {
      setFriends((prev) =>
        prev
          .filter(isValidFriendUser)
          .map((f) => {
            if (f._id !== payload.userId) return f;
            const next: FriendUser = { ...f, status: payload.status };
            if (payload.lastSeenAt) {
              next.lastSeenAt = payload.lastSeenAt;
            }
            return next;
          }),
      );
      setRooms((prev) =>
        prev.map((room) => ({
          ...room,
          members: room.members.map((mem) => {
            if (!isRoomMemberPopulated(mem) || mem.userId._id !== payload.userId) return mem;
            const u = { ...mem.userId, status: payload.status };
            if (payload.lastSeenAt) {
              u.lastSeenAt = payload.lastSeenAt;
            }
            return { ...mem, userId: u };
          }),
        })),
      );
    };

    const handleSystemMessage = () => null;
    const handleFriendRequestReceived = () => {
      loadIncomingRequests().catch(() => null);
      message.info(vi.notify.friendRequest);
    };
    const handleGroupInviteReceived = () => {
      loadPendingGroupInvites().catch(() => null);
    };
    const handleFriendshipUpdated = () => {
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      message.success(vi.notify.friendsUpdated);
    };
    const handleFriendRequestUpdated = () => {
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
    };
    const handleFriendshipRemoved = () => {
      loadFriends().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      message.info(vi.notify.friendshipRemoved);
    };
    const handleFriendDataChanged = () => {
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      loadPendingGroupInvites().catch(() => null);
    };
    const handleRoomListChanged = () => {
      loadRooms().catch(() => null);
    };
    const handleRoomPinsUpdated = (payload: { roomId: string; pinnedMessageIds: string[] }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r._id === payload.roomId ? { ...r, pinnedMessageIds: payload.pinnedMessageIds } : r,
        ),
      );
    };
    const handleDirectRoomRemoved = (payload: { roomId?: string }) => {
      if (payload?.roomId && payload.roomId === selectedRoomIdRef.current) {
        setSelectedRoomId("");
        setMessages([]);
        setReadStates([]);
        setMessagesHasMore(false);
      }
      loadRooms().catch(() => null);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("receive_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("read_receipt", handleReadReceipt);
    socket.on("user_status", handleUserStatus);
    socket.on("system_message", handleSystemMessage);
    socket.on("friend_request_received", handleFriendRequestReceived);
    socket.on("group_invite_received", handleGroupInviteReceived);
    socket.on("friendship_updated", handleFriendshipUpdated);
    socket.on("friend_request_updated", handleFriendRequestUpdated);
    socket.on("friendship_removed", handleFriendshipRemoved);
    socket.on("friend_data_changed", handleFriendDataChanged);
    socket.on("room_list_changed", handleRoomListChanged);
    socket.on("room_pins_updated", handleRoomPinsUpdated);
    socket.on("direct_room_removed", handleDirectRoomRemoved);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("receive_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("read_receipt", handleReadReceipt);
      socket.off("user_status", handleUserStatus);
      socket.off("system_message", handleSystemMessage);
      socket.off("friend_request_received", handleFriendRequestReceived);
      socket.off("group_invite_received", handleGroupInviteReceived);
      socket.off("friendship_updated", handleFriendshipUpdated);
      socket.off("friend_request_updated", handleFriendRequestUpdated);
      socket.off("friendship_removed", handleFriendshipRemoved);
      socket.off("friend_data_changed", handleFriendDataChanged);
      socket.off("room_list_changed", handleRoomListChanged);
      socket.off("room_pins_updated", handleRoomPinsUpdated);
      socket.off("direct_room_removed", handleDirectRoomRemoved);
    };
  }, [
    socket,
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
    loadRooms,
    user?._id,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      loadPendingGroupInvites().catch(() => null);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadFriends, loadIncomingRequests, loadOutgoingRequests, loadPendingGroupInvites]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadRooms().catch(() => null);
    }, 25_000);
    return () => window.clearInterval(interval);
  }, [loadRooms]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        loadRooms().catch(() => null);
        loadPendingGroupInvites().catch(() => null);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadRooms, loadPendingGroupInvites]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setReadStates([]);
      setMessagesHasMore(false);
      setChatThreadLoading(false);
      return;
    }

    setChatThreadLoading(true);
    setMessages([]);

    let cancelled = false;
    void (async () => {
      try {
        const [msgRes, readRes] = await Promise.all([
          api.get(`/api/rooms/${selectedRoomId}/messages`, { params: { limit: 50 } }),
          api.get(`/api/rooms/${selectedRoomId}/read-state`),
        ]);
        if (cancelled) return;
        setMessages(msgRes.data.messages);
        setMessagesHasMore(Boolean(msgRes.data.hasMore));
        setReadStates(readRes.data.states);
        setUnreadByRoomId((prev) => ({ ...prev, [selectedRoomId]: 0 }));
      } catch {
        if (!cancelled) message.error(vi.errors.loadHistory);
      } finally {
        if (!cancelled) setChatThreadLoading(false);
      }
    })();

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit(
        "join_room",
        { roomId: selectedRoomId },
        (response: { ok: boolean; error?: string }) => {
          if (!response?.ok && !cancelled) {
            message.error(response?.error || vi.errors.joinRoom);
          }
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [socket, selectedRoomId]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  useEffect(() => {
    if (!selectedRoomId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (markReadTimerRef.current) window.clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = window.setTimeout(() => {
      const roomId = selectedRoomId;
      const messageId = last.id;
      const s = socketRef.current;
      if (s?.connected) {
        s.emit(
          "mark_room_read",
          { roomId, messageId },
          (res: { ok?: boolean }) => {
            if (!res?.ok) {
              api.post(`/api/rooms/${roomId}/read`, { messageId }).catch(() => null);
            }
          },
        );
      } else {
        api.post(`/api/rooms/${roomId}/read`, { messageId }).catch(() => null);
      }
    }, 500);
    return () => {
      if (markReadTimerRef.current) window.clearTimeout(markReadTimerRef.current);
    };
  }, [selectedRoomId, messages]);

  useEffect(() => {
    composeRef.current?.clear();
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [selectedRoomId]);

  function clearPendingImage() {
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function recallMessage(messageId: string) {
    if (!selectedRoomId) return;
    try {
      await api.delete(`/api/rooms/${selectedRoomId}/messages/${messageId}`);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.recall));
    }
  }

  async function toggleMessageReaction(messageId: string, emoji: string) {
    if (!selectedRoomId) return;
    try {
      const { data } = await api.post<{ message: ChatMessage }>(
        `/api/rooms/${selectedRoomId}/messages/${messageId}/reaction`,
        { emoji },
      );
      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.reactionFail));
    }
  }

  async function pinThreadMessage(messageId: string) {
    if (!selectedRoomId) return;
    try {
      const { data } = await api.post<{ room: Room; pinnedMessageIds: string[] }>(
        `/api/rooms/${selectedRoomId}/pins`,
        { messageId },
      );
      message.success(vi.chat.pinOk);
      if (data?.room) {
        setRooms((prev) =>
          prev.map((r) => (r._id === selectedRoomId ? { ...(data.room as Room) } : r)),
        );
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.pinMessageFail));
    }
  }

  async function unpinThreadMessage(messageId: string) {
    if (!selectedRoomId) return;
    try {
      const { data } = await api.delete<{ room: Room; pinnedMessageIds: string[] }>(
        `/api/rooms/${selectedRoomId}/pins/${messageId}`,
      );
      message.success(vi.chat.unpinOk);
      if (data?.room) {
        setRooms((prev) =>
          prev.map((r) => (r._id === selectedRoomId ? { ...(data.room as Room) } : r)),
        );
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.unpinMessageFail));
    }
  }

  async function patchRoomPrefs(partial: { muted?: boolean; sidebarPinned?: boolean }) {
    if (!selectedRoom?._id) return;
    try {
      const { data } = await api.patch<{ user: AuthUser }>(`/api/users/me/room-prefs`, {
        roomId: selectedRoom._id,
        ...partial,
      });
      updateCurrentUser(data.user);
      if (partial.muted !== undefined) {
        message.success(vi.chat.muteOk);
      } else if (partial.sidebarPinned !== undefined) {
        message.success(vi.chat.pinRoomTopOk);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.roomPrefsFail));
    }
  }

  async function runThreadSearch() {
    const q = threadSearchQuery.trim();
    if (!selectedRoomId || !q) {
      setThreadSearchHits([]);
      return;
    }
    setThreadSearchLoading(true);
    try {
      const { data } = await api.get<{ messages: ChatMessage[] }>(
        `/api/rooms/${selectedRoomId}/messages/search`,
        { params: { q, limit: 40 } },
      );
      setThreadSearchHits(Array.isArray(data.messages) ? data.messages : []);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.searchThreadFail));
      setThreadSearchHits([]);
    } finally {
      setThreadSearchLoading(false);
    }
  }

  async function createRoom() {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    try {
      await api.post("/api/rooms", { name: trimmed });
      setRoomName("");
      await loadRooms();
      message.success(vi.errors.createRoomOk);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.createRoomFail));
    }
  }

  async function submitComposer() {
    if (!selectedRoomId || !socket) return;

    if (pendingImage) {
      if (pendingImage.file.size > UPLOAD_MAX_BYTES) {
        message.error(vi.errors.uploadTooLarge(UPLOAD_MAX_MB));
        return;
      }
      const formData = new FormData();
      formData.append("file", pendingImage.file);
      setUploadingMedia(true);
      setUploadProgress(0);
      try {
        const response = await api.post<{ mediaUrl: string; contentType: ChatMessageContentType }>(
          "/api/messages/upload",
          formData,
          {
            onUploadProgress: (ev) => {
              if (!ev.total) return;
              setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
            },
          },
        );
        const caption = composeRef.current?.getText().trim() ?? "";
        socket.emit(
          "send_message",
          {
            roomId: selectedRoomId,
            contentType: response.data.contentType,
            mediaUrl: response.data.mediaUrl,
            text: caption,
          },
          (res: { ok: boolean; error?: string }) => {
            if (!res?.ok) {
              message.error(res?.error || vi.errors.sendImageFail);
              return;
            }
            composeRef.current?.clear();
            clearPendingImage();
          },
        );
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.uploadImageFail));
      } finally {
        setUploadingMedia(false);
        setUploadProgress(null);
      }
      return;
    }

    const trimmed = composeRef.current?.getText().trim() ?? "";
    if (!trimmed) {
      message.warning(vi.errors.needTextOrMedia);
      return;
    }

    socket.emit(
      "send_message",
      { roomId: selectedRoomId, contentType: "text" as const, text: trimmed, mediaUrl: "" },
      (response: { ok: boolean; error?: string }) => {
        if (!response?.ok) {
          message.error(response?.error || vi.errors.sendTextFail);
          return;
        }
        composeRef.current?.clear();
      },
    );
  }

  async function uploadAndEmitMedia(file: File) {
    if (!selectedRoomId || !socket) {
      message.warning(vi.errors.pickRoom);
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      message.error(vi.errors.uploadTooLarge(UPLOAD_MAX_MB));
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploadingMedia(true);
    setUploadProgress(0);
    try {
      const response = await api.post<{ mediaUrl: string; contentType: ChatMessageContentType }>(
        "/api/messages/upload",
        formData,
        {
          onUploadProgress: (ev) => {
            if (!ev.total) return;
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          },
        },
      );
      const caption = composeRef.current?.getText().trim() ?? "";
      socket.emit(
        "send_message",
        {
          roomId: selectedRoomId,
          contentType: response.data.contentType,
          mediaUrl: response.data.mediaUrl,
          text: caption,
        },
        (res: { ok: boolean; error?: string }) => {
          if (!res?.ok) {
            message.error(res?.error || vi.errors.sendFileFail);
            return;
          }
          composeRef.current?.clear();
        },
      );
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.uploadFileFail));
    } finally {
      setUploadingMedia(false);
      setUploadProgress(null);
    }
  }

  function onImageFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.warning(vi.errors.pickImageFile);
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      message.error(vi.errors.uploadTooLarge(UPLOAD_MAX_MB));
      return;
    }
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }

  function onVideoOrAudioFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      message.error(vi.errors.uploadTooLarge(UPLOAD_MAX_MB));
      return;
    }
    void uploadAndEmitMedia(file);
  }

  async function searchUsers() {
    const q = searchText.trim();
    if (!q) {
      await loadBrowseFirstPage();
      return;
    }
    setDiscoveryMode("search");
    setBrowseNextCursor(null);
    browseNextCursorRef.current = null;
    setBrowseLoading(true);
    try {
      const response = await api.get("/api/users/search", {
        params: { q },
      });
      setDiscoveryList(response.data.users);
    } catch (_error) {
      message.error(vi.errors.userNotFound);
      setDiscoveryList([]);
    } finally {
      setBrowseLoading(false);
    }
  }

  async function sendFriendRequest(toUserId: string) {
    try {
      await api.post("/api/friends/request", { toUserId });
      message.success(vi.errors.inviteSent);
      setDiscoveryList((prev) => prev.filter((item) => item._id !== toUserId));
      await loadIncomingRequests();
      await loadFriends();
      await loadOutgoingRequests();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.inviteFail));
    }
  }

  async function handleRequest(requestId: string, action: "accept" | "reject") {
    try {
      await api.post(`/api/friends/request/${requestId}/${action}`);
      message.success(action === "accept" ? vi.errors.accepted : vi.errors.rejected);
      await loadIncomingRequests();
      await loadFriends();
    } catch (_error) {
      message.error(vi.errors.requestUpdateFail);
    }
  }

  async function removeFriend(friendUserId: string) {
    try {
      await api.delete(`/api/friends/${friendUserId}`);
      message.success(vi.errors.unfriendOk);
      await loadFriends();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.unfriendFail));
    }
  }

  async function openDirectRoom(friendUserId: string) {
    setChatThreadLoading(true);
    try {
      const response = await api.post(`/api/rooms/direct/${friendUserId}`);
      const room = response.data.room as Room;
      await loadRooms();
      setSelectedRoomId(room._id);
      if (isNarrowLayout) {
        setMobileLeftOpen(false);
      }
    } catch (error: unknown) {
      setChatThreadLoading(false);
      message.error(getApiErrorMessage(error, vi.errors.openDirectFail));
    }
  }

  async function onGroupAvatarFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedRoom || selectedRoom.type !== "group") return;
    if (!file.type.startsWith("image/")) {
      message.warning(vi.errors.pickImageFile);
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      message.error(vi.errors.uploadTooLarge(UPLOAD_MAX_MB));
      return;
    }
    try {
      setGroupAvatarSaving(true);
      const formData = new FormData();
      formData.append("file", file);
      const up = await api.post<{ mediaUrl: string; contentType: string }>(
        "/api/messages/upload",
        formData,
      );
      if (up.data.contentType !== "image") {
        message.warning(vi.errors.pickImageFile);
        return;
      }
      await api.patch(`/api/rooms/${selectedRoom._id}`, { avatar: up.data.mediaUrl });
      message.success(vi.chat.roomAvatarSaved);
      await loadRooms();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.roomAvatarUploadFail));
    } finally {
      setGroupAvatarSaving(false);
    }
  }

  async function patchMemberRole(memberUserId: string, role: "admin" | "member") {
    if (!selectedRoom?._id) return;
    try {
      await api.patch(`/api/rooms/${selectedRoom._id}/members/${memberUserId}/role`, { role });
      await loadRooms();
      message.success(vi.chat.roleUpdated);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.roleUpdateFail));
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function addMemberToGroup(memberUserId: string) {
    if (!selectedRoom || selectedRoom.type !== "group") {
      return;
    }
    try {
      setAddingMemberId(memberUserId);
      await api.post(`/api/rooms/${selectedRoom._id}/members`, { memberUserId });
      message.success(vi.errors.groupInviteSent);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.memberAddFail));
    } finally {
      setAddingMemberId("");
    }
  }

  async function acceptGroupInviteAction(inviteId: string) {
    try {
      setGroupInviteActionId(inviteId);
      await api.post(`/api/rooms/group-invites/${inviteId}/accept`);
      message.success(vi.errors.groupInviteAcceptOk);
      await loadPendingGroupInvites();
      await loadRooms();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.groupInviteAcceptFail));
    } finally {
      setGroupInviteActionId("");
    }
  }

  async function declineGroupInviteAction(inviteId: string) {
    try {
      setGroupInviteActionId(inviteId);
      await api.post(`/api/rooms/group-invites/${inviteId}/decline`);
      message.success(vi.errors.groupInviteDeclineOk);
      await loadPendingGroupInvites();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.groupInviteDeclineFail));
    } finally {
      setGroupInviteActionId("");
    }
  }

  const selectedRoom = rooms.find((room) => room._id === selectedRoomId);
  const currentRoomName = selectedRoom
    ? getRoomDisplayName(selectedRoom, user?._id || "")
    : vi.chat.noRoom;
  const currentUserId = user?._id || "";
  const myRailAvatarSrc = useMemo(() => {
    const a = user?.avatar?.trim();
    if (!a) return undefined;
    return resolveMediaUrl(a, API_BASE_URL) || undefined;
  }, [user?.avatar]);

  const directCounterpart = useMemo(() => {
    if (!selectedRoom || selectedRoom.type !== "direct") {
      return null;
    }
    return (
      selectedRoom.members.find(
        (member) => isRoomMemberPopulated(member) && member.userId._id !== currentUserId,
      )?.userId || null
    );
  }, [selectedRoom, currentUserId]);

  const directHeaderPresence = useMemo(
    () =>
      formatChatHeaderPresence(directCounterpart?.status, directCounterpart?.lastSeenAt),
    [directCounterpart?.status, directCounterpart?.lastSeenAt, presenceClock],
  );
  const groupMembers = useMemo(() => {
    if (!selectedRoom || selectedRoom.type !== "group") {
      return [];
    }
    return selectedRoom.members.filter(isRoomMemberPopulated);
  }, [selectedRoom]);
  const groupMemberIdSet = useMemo(
    () => new Set(groupMembers.map((member) => member.userId._id)),
    [groupMembers],
  );
  const friendsSafe = useMemo(() => friends.filter(isValidFriendUser), [friends]);
  const addableFriendsForGroup = useMemo(
    () => friendsSafe.filter((friend) => !groupMemberIdSet.has(friend._id)),
    [friendsSafe, groupMemberIdSet],
  );
  const friendIdSet = useMemo(
    () => new Set(friendsSafe.map((item) => item._id)),
    [friendsSafe],
  );
  const outgoingIdSet = useMemo(
    () =>
      new Set(
        outgoingRequests
          .map((item) => item.toUserId?._id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    [outgoingRequests],
  );
  const visibleDiscoveryResults = useMemo(
    () =>
      discoveryList.filter(
        (item) => !friendIdSet.has(item._id) && !outgoingIdSet.has(item._id),
      ),
    [discoveryList, friendIdSet, outgoingIdSet],
  );

  const sortedGroupRooms = useMemo(() => {
    const pinIds = new Set(
      (user?.chatRoomPrefs || [])
        .filter((p) => p.sidebarPinned)
        .map((p) => p.roomId),
    );
    const list = rooms.filter((room) => room.type === "group");
    return [...list].sort((a, b) => {
      const ap = pinIds.has(a._id) ? 1 : 0;
      const bp = pinIds.has(b._id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [rooms, user?.chatRoomPrefs]);

  const unreadByFriendId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const room of rooms) {
      if (room.type !== "direct") continue;
      const other = room.members.find(
        (m) => isRoomMemberPopulated(m) && m.userId._id !== currentUserId,
      )?.userId;
      if (other) {
        out[other._id] = unreadByRoomId[room._id] ?? 0;
      }
    }
    return out;
  }, [rooms, unreadByRoomId, currentUserId]);

  const myRoomRole = useMemo(() => {
    if (!selectedRoom) return null;
    const me = selectedRoom.members.find(
      (m) => isRoomMemberPopulated(m) && m.userId._id === currentUserId,
    );
    return me?.role ?? null;
  }, [selectedRoom, currentUserId]);

  const canAddGroupMembers =
    selectedRoom?.type === "group" && myRoomRole != null && ["owner", "admin"].includes(myRoomRole);

  const isRoomOwner = myRoomRole === "owner";

  const roomPref = useMemo(() => {
    if (!selectedRoomId || !user?.chatRoomPrefs) return null;
    return user.chatRoomPrefs.find((p) => p.roomId === selectedRoomId) ?? null;
  }, [selectedRoomId, user?.chatRoomPrefs]);

  const canPinMessagesInThread = useMemo(() => {
    if (!selectedRoom) return false;
    if (selectedRoom.type === "direct") return true;
    return myRoomRole != null && ["owner", "admin"].includes(myRoomRole);
  }, [selectedRoom, myRoomRole]);

  function roleLabel(role: string) {
    if (role === "owner") return vi.chat.roleOwner;
    if (role === "admin") return vi.chat.roleAdmin;
    return vi.chat.roleMember;
  }

  function canRemoveGroupMember(targetRole: string, targetUserId: string): boolean {
    if (!selectedRoom || selectedRoom.type !== "group") return false;
    if (!myRoomRole || !["owner", "admin"].includes(myRoomRole)) return false;
    if (targetUserId === currentUserId) return false;
    if (targetRole === "owner") return false;
    if (myRoomRole === "admin" && targetRole === "admin") return false;
    return true;
  }

  async function removeGroupMember(memberUserId: string) {
    if (!selectedRoom || selectedRoom.type !== "group") return;
    try {
      setRemovingMemberId(memberUserId);
      await api.delete(`/api/rooms/${selectedRoom._id}/members/${memberUserId}`);
      message.success(vi.chat.memberRemovedOk);
      await loadRooms();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.memberRemoveFail));
    } finally {
      setRemovingMemberId("");
    }
  }

  async function leaveGroupRoom(newOwnerUserId?: string) {
    if (!selectedRoom || selectedRoom.type !== "group") return;
    const roomId = selectedRoom._id;
    try {
      setLeaveGroupLoading(true);
      await api.post(`/api/rooms/${roomId}/leave`, newOwnerUserId ? { newOwnerUserId } : {});
      message.success(vi.chat.leaveGroupOk);
      await loadRooms();
      setSelectedRoomId((cur) => (cur === roomId ? "" : cur));
      setIsRoomInfoOpen(false);
      setLeaveOwnerModalOpen(false);
      setLeaveTransferUserId("");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.leaveGroupFail));
      throw error;
    } finally {
      setLeaveGroupLoading(false);
    }
  }

  const sidebarBody = (
    <Suspense
      fallback={
        <div className="chat-sidebar-suspense" role="status" aria-live="polite">
          <Spin tip={vi.chat.loadingSidebar} />
        </div>
      }
    >
      <ChatSidebarBody
        roomName={roomName}
        onRoomNameChange={setRoomName}
        onCreateRoom={() => void createRoom()}
        groupRoomsOnly={sortedGroupRooms}
        selectedRoomId={selectedRoomId}
        onSelectRoom={(roomId) => {
          setChatThreadLoading(true);
          setSelectedRoomId(roomId);
          if (isNarrowLayout) {
            setMobileLeftOpen(false);
          }
        }}
        myUserId={user?._id || ""}
        getRoomDisplayName={getRoomDisplayName}
        friends={friendsSafe}
        onOpenDirectRoom={(id) => void openDirectRoom(id)}
        onRemoveFriend={(id) => void removeFriend(id)}
        unreadByRoomId={unreadByRoomId}
        unreadByFriendId={unreadByFriendId}
        apiBaseUrl={API_BASE_URL}
      />
    </Suspense>
  );

  const sidebarCardTitle = vi.chat.greeting(user?.username || "");

  const settingsDrawerContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.themeDark}</Text>
        <Switch
          checked={theme === "dark"}
          onChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
      </Flex>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.desktopNotify}</Text>
        <Switch
          checked={desktopNotify}
          onChange={async (checked) => {
            if (checked) {
              const p = await requestNotificationPermission();
              if (p !== "granted") {
                message.warning(vi.chat.notifyDenied);
                return;
              }
            }
            setDesktopNotify(checked);
          }}
        />
      </Flex>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.soundNotify}</Text>
        <Switch checked={soundNotify} onChange={setSoundNotify} />
      </Flex>
      <Text type="secondary">{vi.chat.languageNote}</Text>
    </Space>
  );

  const searchPanelContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Text strong>{vi.chat.searchUsersTitle}</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {vi.chat.userDiscoveryHint}
      </Text>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder={vi.chat.searchPlaceholder}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onPressEnter={() => void searchUsers()}
        />
        <Button onClick={() => void searchUsers()}>{vi.chat.search}</Button>
      </Space.Compact>
      <div
        ref={discoveryListScrollRef}
        className="chat-discovery-scroll"
        onScroll={(event) => {
          const el = event.currentTarget;
          if (discoveryMode !== "browse" || browseNextCursor === null) return;
          if (browseLoadingMore || browseLoading) return;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 72) {
            void loadBrowseMore();
          }
        }}
      >
        {browseLoading && discoveryList.length === 0 ? (
          <Flex justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : (
          <>
            <List
              className="chat-rail-panel-list"
              size="small"
              split={false}
              dataSource={visibleDiscoveryResults}
              locale={{ emptyText: vi.chat.noSearch }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="add"
                      type="primary"
                      size="middle"
                      className="chat-discovery-add-btn"
                      icon={<FiUserPlus />}
                      onClick={() => sendFriendRequest(item._id)}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar>{item.username.charAt(0).toUpperCase()}</Avatar>}
                    title={item.username}
                  />
                </List.Item>
              )}
            />
            {discoveryMode === "browse" && browseLoadingMore ? (
              <Flex justify="center" style={{ padding: 8 }}>
                <Spin size="small" />
              </Flex>
            ) : null}
          </>
        )}
      </div>
    </Space>
  );

  const incomingNoticeCount = incomingRequests.length + groupInvites.length;

  const outgoingPanelContent = (
    <List
      className="chat-rail-panel-list"
      size="small"
      split={false}
      dataSource={outgoingRequests}
      locale={{ emptyText: vi.chat.outgoingEmpty }}
      renderItem={(request) => (
        <List.Item>
          <List.Item.Meta
            avatar={<Avatar>{request.toUserId.username.charAt(0).toUpperCase()}</Avatar>}
            title={request.toUserId.username}
            description={vi.chat.waitingAccept}
          />
        </List.Item>
      )}
    />
  );

  const incomingPanelContent = (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <div>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {vi.chat.groupInvitesSection}
        </Text>
        <List
          className="chat-rail-panel-list"
          size="small"
          split={false}
          dataSource={groupInvites}
          locale={{ emptyText: vi.chat.groupInvitesEmpty }}
          renderItem={(inv) => {
            const inviter = inv.invitedByUserId!;
            const roomLabel = inv.roomId?.name?.trim() || "Nhóm";
            return (
              <List.Item
                className="chat-incoming-request-item"
                actions={[
                  <Button
                    key="accept-g"
                    type="primary"
                    size="middle"
                    className="chat-friend-request-btn chat-friend-request-btn--accept"
                    icon={<FiCheck size={18} />}
                    loading={groupInviteActionId === inv._id}
                    onClick={() => void acceptGroupInviteAction(inv._id)}
                  >
                    {vi.chat.acceptGroupInvite}
                  </Button>,
                  <Button
                    key="decline-g"
                    size="middle"
                    danger
                    className="chat-friend-request-btn chat-friend-request-btn--reject"
                    icon={<FiX size={18} />}
                    loading={groupInviteActionId === inv._id}
                    onClick={() => void declineGroupInviteAction(inv._id)}
                  >
                    {vi.chat.declineGroupInvite}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar>{inviter.username.charAt(0).toUpperCase()}</Avatar>}
                  title={inviter.username}
                  description={vi.chat.groupInviteIntoRoom(roomLabel)}
                />
              </List.Item>
            );
          }}
        />
      </div>
      <Divider style={{ margin: 0 }} />
      <div>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {vi.chat.friendInviteSection}
        </Text>
        <List
          className="chat-rail-panel-list"
          size="small"
          split={false}
          dataSource={incomingRequests}
          locale={{ emptyText: vi.chat.incomingEmpty }}
          renderItem={(request) => (
            <List.Item
              className="chat-incoming-request-item"
              actions={[
                <Button
                  key="accept"
                  type="primary"
                  size="middle"
                  className="chat-friend-request-btn chat-friend-request-btn--accept"
                  icon={<FiCheck size={18} />}
                  onClick={() => handleRequest(request._id, "accept")}
                >
                  {vi.chat.acceptRequest}
                </Button>,
                <Button
                  key="reject"
                  size="middle"
                  danger
                  className="chat-friend-request-btn chat-friend-request-btn--reject"
                  icon={<FiX size={18} />}
                  onClick={() => handleRequest(request._id, "reject")}
                >
                  {vi.chat.rejectRequest}
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar>{request.fromUserId.username.charAt(0).toUpperCase()}</Avatar>}
                title={request.fromUserId.username}
              />
            </List.Item>
          )}
        />
      </div>
    </Space>
  );

  function toggleRailPanel(panel: "search" | "outgoing" | "incoming") {
    setSettingsDrawerOpen(false);
    if (isNarrowLayout) {
      setMobileLeftOpen(false);
    }
    setRailPanel((cur) => (cur === panel ? null : panel));
  }

  function toggleSettingsFromRail() {
    setRailPanel(null);
    if (isNarrowLayout) {
      setMobileLeftOpen(false);
    }
    setSettingsDrawerOpen((s) => !s);
  }

  function toggleMobileSidebar() {
    setRailPanel(null);
    setSettingsDrawerOpen(false);
    setMobileLeftOpen((open) => !open);
  }

  return (
    <Flex
      className={`chat-layout${!isNarrowLayout ? " chat-layout--with-rail" : ""}`}
      vertical={isNarrowLayout}
      gap={isNarrowLayout ? 12 : 16}
    >
      {!isNarrowLayout ? (
        <aside className="chat-rail">
          <div className="chat-rail-stack chat-rail-stack--top">
            <button
              type="button"
              className="chat-rail-avatar-btn"
              onClick={() => setProfileModalOpen(true)}
              aria-label={vi.profile.openBtn}
            >
              <Avatar size={44} src={myRailAvatarSrc}>
                {(user?.username || "?").charAt(0).toUpperCase()}
              </Avatar>
            </button>
            <span className="chat-rail-btn chat-rail-btn--active">
              <FiMessageCircle aria-hidden />
            </span>
            <button
              type="button"
              className={`chat-rail-btn${railPanel === "search" ? " chat-rail-btn--active" : ""}`}
              onClick={() => toggleRailPanel("search")}
              aria-pressed={railPanel === "search"}
            >
              <FiSearch />
            </button>
            <Badge count={outgoingRequests.length} size="small" offset={[-2, 2]}>
              <button
                type="button"
                className={`chat-rail-btn${railPanel === "outgoing" ? " chat-rail-btn--active" : ""}`}
                onClick={() => toggleRailPanel("outgoing")}
                aria-pressed={railPanel === "outgoing"}
              >
                <FiClock />
              </button>
            </Badge>
            <Badge count={incomingNoticeCount} size="small" offset={[-2, 2]}>
              <button
                type="button"
                className={`chat-rail-btn${railPanel === "incoming" ? " chat-rail-btn--active" : ""}`}
                onClick={() => toggleRailPanel("incoming")}
                aria-pressed={railPanel === "incoming"}
              >
                <FiInbox />
              </button>
            </Badge>
          </div>
          <div className="chat-rail-stack chat-rail-stack--bottom">
            <button
              type="button"
              className={`chat-rail-btn${settingsDrawerOpen ? " chat-rail-btn--active" : ""}`}
              onClick={toggleSettingsFromRail}
              aria-pressed={settingsDrawerOpen}
            >
              <FiSettings />
            </button>
            <button
              type="button"
              className="chat-rail-btn chat-rail-btn--danger"
              onClick={() => void handleLogout()}
            >
              <FiLogOut />
            </button>
          </div>
        </aside>
      ) : null}

      {!isNarrowLayout ? (
        <Card className="chat-sidebar" title={sidebarCardTitle}>
          {sidebarBody}
        </Card>
      ) : null}

      {isNarrowLayout ? (
        <Drawer
          className="chat-sidebar-drawer"
          title={sidebarCardTitle}
          placement="left"
          width="min(100vw - 16px, 360px)"
          open={mobileLeftOpen}
          onClose={() => setMobileLeftOpen(false)}
          styles={{ body: { padding: 12 } }}
        >
          <div className="chat-sidebar-drawer-inner">{sidebarBody}</div>
        </Drawer>
      ) : null}

      <Drawer
        title={vi.chat.searchUsersTitle}
        placement="left"
        width="min(100vw - 16px, 360px)"
        open={railPanel === "search"}
        onClose={() => setRailPanel(null)}
        className="chat-rail-drawer"
      >
        {searchPanelContent}
      </Drawer>
      <Drawer
        title={vi.chat.outgoing(outgoingRequests.length)}
        placement="left"
        width="min(100vw - 16px, 360px)"
        open={railPanel === "outgoing"}
        onClose={() => setRailPanel(null)}
        className="chat-rail-drawer"
      >
        {outgoingPanelContent}
      </Drawer>
      <Drawer
        title={vi.chat.incoming(incomingNoticeCount)}
        placement="left"
        width="min(100vw - 16px, 360px)"
        open={railPanel === "incoming"}
        onClose={() => setRailPanel(null)}
        className="chat-rail-drawer"
      >
        {incomingPanelContent}
      </Drawer>

      <Drawer
        className="chat-settings-drawer"
        title={vi.chat.settings}
        placement="right"
        width="min(100vw - 16px, 360px)"
        open={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
      >
        {settingsDrawerContent}
      </Drawer>

      {isNarrowLayout ? (
        <nav className="chat-mobile-top-nav">
          <div className="chat-mobile-top-nav-inner">
            <div className="chat-mobile-top-nav-group">
              <button
                type="button"
                className="chat-mobile-top-nav-avatar"
                onClick={() => setProfileModalOpen(true)}
                aria-label={vi.profile.openBtn}
              >
                <Avatar size={36} src={myRailAvatarSrc}>
                  {(user?.username || "?").charAt(0).toUpperCase()}
                </Avatar>
              </button>
              <button
                type="button"
                className={`chat-mobile-top-nav-btn${mobileLeftOpen ? " chat-mobile-top-nav-btn--active" : ""}`}
                onClick={toggleMobileSidebar}
                aria-pressed={mobileLeftOpen}
              >
                <FiMenu aria-hidden />
              </button>
              <button
                type="button"
                className={`chat-mobile-top-nav-btn${railPanel === "search" ? " chat-mobile-top-nav-btn--active" : ""}`}
                onClick={() => toggleRailPanel("search")}
                aria-pressed={railPanel === "search"}
              >
                <FiSearch aria-hidden />
              </button>
              <Badge count={outgoingRequests.length} size="small" offset={[-2, 2]}>
                <button
                  type="button"
                  className={`chat-mobile-top-nav-btn${railPanel === "outgoing" ? " chat-mobile-top-nav-btn--active" : ""}`}
                  onClick={() => toggleRailPanel("outgoing")}
                  aria-pressed={railPanel === "outgoing"}
                >
                  <FiClock aria-hidden />
                </button>
              </Badge>
              <Badge count={incomingNoticeCount} size="small" offset={[-2, 2]}>
                <button
                  type="button"
                  className={`chat-mobile-top-nav-btn${railPanel === "incoming" ? " chat-mobile-top-nav-btn--active" : ""}`}
                  onClick={() => toggleRailPanel("incoming")}
                  aria-pressed={railPanel === "incoming"}
                >
                  <FiInbox aria-hidden />
                </button>
              </Badge>
            </div>
            <div className="chat-mobile-top-nav-group chat-mobile-top-nav-group--end">
              <button
                type="button"
                className={`chat-mobile-top-nav-btn${settingsDrawerOpen ? " chat-mobile-top-nav-btn--active" : ""}`}
                onClick={toggleSettingsFromRail}
                aria-pressed={settingsDrawerOpen}
              >
                <FiSettings aria-hidden />
              </button>
              <button
                type="button"
                className="chat-mobile-top-nav-btn chat-mobile-top-nav-btn--danger"
                onClick={() => void handleLogout()}
              >
                <FiLogOut aria-hidden />
              </button>
            </div>
          </div>
        </nav>
      ) : null}

      <Card className="chat-main">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-hidden
          onChange={onImageFileSelected}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          hidden
          aria-hidden
          onChange={onVideoOrAudioFileSelected}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          hidden
          aria-hidden
          onChange={onVideoOrAudioFileSelected}
        />
        <Flex vertical gap={16} className="chat-main-stack">
          <Flex justify="space-between" align="center" gap={8} wrap="wrap" flex="none">
            <Flex align="center" gap={10} style={{ flex: "1 1 160px", minWidth: 0 }}>
              {selectedRoom?.type === "group" ? (
                <Avatar
                  size={40}
                  src={
                    selectedRoom.avatar?.trim()
                      ? resolveMediaUrl(selectedRoom.avatar.trim(), API_BASE_URL)
                      : undefined
                  }
                  className="chat-main-header-room-avatar"
                >
                  {(() => {
                    const ch = currentRoomName.trim().charAt(0).toUpperCase() || "#";
                    return ch === "#" ? <FiHash /> : ch;
                  })()}
                </Avatar>
              ) : selectedRoom?.type === "direct" && directCounterpart ? (
                <Avatar
                  size={40}
                  src={
                    directCounterpart.avatar?.trim()
                      ? resolveMediaUrl(directCounterpart.avatar.trim(), API_BASE_URL)
                      : undefined
                  }
                  className="chat-main-header-room-avatar"
                >
                  {directCounterpart.username.charAt(0).toUpperCase()}
                </Avatar>
              ) : null}
              <Flex vertical gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Title level={4} style={{ margin: 0 }} ellipsis>
                  {currentRoomName}
                </Title>
                {selectedRoom?.type === "direct" && directCounterpart ? (
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {directHeaderPresence}
                  </Text>
                ) : null}
              </Flex>
            </Flex>
            <Space size={8} wrap className="chat-header-actions">
              <Button
                className="chat-header-icon-btn"
                shape="circle"
                icon={<FiSearch />}
                aria-label={vi.chat.searchInThread}
                disabled={!selectedRoomId}
                onClick={() => {
                  setThreadSearchOpen(true);
                  setThreadSearchQuery("");
                  setThreadSearchHits([]);
                }}
              />
              <Button
                className="chat-header-icon-btn"
                shape="circle"
                icon={<FiPhone />}
              />
              <Button
                className="chat-header-icon-btn"
                shape="circle"
                icon={<FiCamera />}
              />
              <Button
                className="chat-header-icon-btn"
                shape="circle"
                icon={<FiInfo />}
                onClick={() => setIsRoomInfoOpen(true)}
                disabled={!selectedRoom}
              />
            </Space>
          </Flex>

          <Suspense
            fallback={
              <Flex
                align="center"
                justify="center"
                style={{ flex: "1 1 0%", minHeight: 160 }}
              >
                <Spin size="large" />
              </Flex>
            }
          >
            <Flex
              className="chat-messages-column"
              style={{ flex: "1 1 0%", minHeight: 0, minWidth: 0, overflow: "hidden" }}
              vertical
            >
              {selectedRoom &&
              Array.isArray(selectedRoom.pinnedMessageIds) &&
              selectedRoom.pinnedMessageIds.length > 0 ? (
                <Flex gap={8} className="chat-pinned-banner" align="center">
                  <Text type="secondary" style={{ flex: "none", fontSize: 12 }}>
                    {vi.chat.pinnedMessages}:
                  </Text>
                  <Space size={4} wrap style={{ flex: 1, minWidth: 0 }}>
                    {selectedRoom.pinnedMessageIds.map((pid) => {
                      const hit = messages.find((m) => m.id === pid);
                      const label = hit
                        ? hit.deleted
                          ? vi.preview.recalled
                          : (hit.text || "").trim().slice(0, 48) ||
                            (hit.contentType !== "text" ? vi.preview[hit.contentType] : "…")
                        : "…";
                      return (
                        <Button
                          key={pid}
                          type="link"
                          size="small"
                          className="chat-pinned-chip"
                          onClick={() => setPendingScrollMessageId(pid)}
                        >
                          {label || "…"}
                        </Button>
                      );
                    })}
                  </Space>
                </Flex>
              ) : null}
              <ChatMessageList
                messages={messages}
                currentUserId={currentUserId}
                selectedRoom={selectedRoom}
                apiBaseUrl={API_BASE_URL}
                hasMore={messagesHasMore}
                loadingOlder={loadingOlder}
                initialLoading={chatThreadLoading}
                onLoadOlder={(beforeId) => void loadOlderMessages(beforeId)}
                onRecall={(id) => void recallMessage(id)}
                onToggleReaction={(mid, emoji) => void toggleMessageReaction(mid, emoji)}
                onPinMessage={(mid) => void pinThreadMessage(mid)}
                onUnpinMessage={(mid) => void unpinThreadMessage(mid)}
                canPinMessages={canPinMessagesInThread}
                pinnedMessageIds={selectedRoom?.pinnedMessageIds ?? []}
                highlightMessageId={highlightMessageId}
                readStates={readStates}
                listEndRef={endOfMessagesRef}
                listScrollRef={messagesScrollRef}
              />
            </Flex>

            <Flex vertical gap={8} className="chat-compose-outer" flex="none">
              <ChatComposeRow
                ref={composeRef}
                onSubmit={() => void submitComposer()}
                selectedRoomId={selectedRoomId}
                uploadingMedia={uploadingMedia}
                uploadProgress={uploadProgress}
                emojiOpen={emojiOpen}
                onEmojiOpenChange={setEmojiOpen}
                pendingImage={pendingImage}
                onClearPendingImage={clearPendingImage}
                onOpenPendingModal={() => setPendingImageModalOpen(true)}
                onPickImage={() => imageInputRef.current?.click()}
                onPickVideo={() => videoInputRef.current?.click()}
                onPickAudio={() => audioInputRef.current?.click()}
                parentSendBlocked={!selectedRoomId || uploadingMedia}
              />
            </Flex>
          </Suspense>
        </Flex>
      </Card>

      <Modal
        title={vi.chat.previewTitle}
        open={pendingImageModalOpen}
        footer={null}
        onCancel={() => setPendingImageModalOpen(false)}
        width="min(92vw, 720px)"
        centered
        destroyOnClose
      >
        {pendingImage ? (
          <img
            src={pendingImage.previewUrl}
            alt=""
            style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
          />
        ) : null}
      </Modal>

      <Modal
        title={vi.chat.searchInThreadTitle}
        open={threadSearchOpen}
        onCancel={() => setThreadSearchOpen(false)}
        footer={null}
        destroyOnClose
        centered
        width="min(92vw, 440px)"
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder={vi.chat.searchInThreadPlaceholder}
              value={threadSearchQuery}
              onChange={(e) => setThreadSearchQuery(e.target.value)}
              onPressEnter={() => void runThreadSearch()}
              allowClear
            />
            <Button type="primary" loading={threadSearchLoading} onClick={() => void runThreadSearch()}>
              {vi.chat.search}
            </Button>
          </Space.Compact>
          <List
            size="small"
            dataSource={threadSearchHits}
            locale={{ emptyText: vi.chat.searchInThreadEmpty }}
            loading={threadSearchLoading}
            renderItem={(hit) => (
              <List.Item
                style={{ cursor: "pointer" }}
                onClick={() => setPendingScrollMessageId(hit.id)}
              >
                <List.Item.Meta
                  title={
                    <Text ellipsis style={{ maxWidth: "100%" }}>
                      {vi.chat.searchInThreadHit(hit.text || "")}
                    </Text>
                  }
                  description={`${hit.sender.username} · ${new Date(hit.createdAt).toLocaleString("vi-VN")}`}
                />
              </List.Item>
            )}
          />
        </Space>
      </Modal>

      <PersonalProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        apiBaseUrl={API_BASE_URL}
        uploadMaxMb={UPLOAD_MAX_MB}
        uploadMaxBytes={UPLOAD_MAX_BYTES}
        onUserUpdated={handleProfileUserUpdated}
      />

      <Modal
        title={vi.chat.leaveGroupOwnerTitle}
        open={leaveOwnerModalOpen}
        onCancel={() => {
          setLeaveOwnerModalOpen(false);
          setLeaveTransferUserId("");
        }}
        okText={vi.chat.leaveGroupConfirmOwner}
        okButtonProps={{ disabled: !leaveTransferUserId, loading: leaveGroupLoading }}
        onOk={() => leaveGroupRoom(leaveTransferUserId)}
        destroyOnClose
        centered
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {vi.chat.leaveGroupTransferHint}
        </Text>
        <Select
          style={{ width: "100%" }}
          placeholder={vi.chat.leaveGroupTransferPlaceholder}
          value={leaveTransferUserId || undefined}
          onChange={(v) => setLeaveTransferUserId(v)}
          options={groupMembers
            .filter((m) => m.userId._id !== currentUserId)
            .map((m) => ({
              value: m.userId._id,
              label: m.userId.username,
            }))}
        />
      </Modal>

      <Drawer
        title={selectedRoom?.type === "direct" ? vi.chat.roomInfoDirect : vi.chat.roomInfoGroup}
        placement="right"
        width="min(100vw - 16px, 340px)"
        open={isRoomInfoOpen}
        onClose={() => {
          setIsRoomInfoOpen(false);
          setIsAddMemberOpen(false);
          setLeaveOwnerModalOpen(false);
          setLeaveTransferUserId("");
        }}
      >
        {!selectedRoom ? (
          <Text type="secondary">{vi.chat.noRoomInfo}</Text>
        ) : selectedRoom.type === "direct" ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Flex align="center" gap={12}>
              <AvatarWithStatus
                size={52}
                online={directCounterpart?.status === "online"}
                src={
                  directCounterpart?.avatar?.trim()
                    ? resolveMediaUrl(directCounterpart.avatar.trim(), API_BASE_URL)
                    : undefined
                }
              >
                {(directCounterpart?.username || "?").charAt(0).toUpperCase()}
              </AvatarWithStatus>
              <Space direction="vertical" size={2}>
                <Text strong>{directCounterpart?.username || vi.chat.noName}</Text>
                <Text type="secondary">{directCounterpart?.email || vi.chat.noEmail}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {directHeaderPresence}
                </Text>
              </Space>
            </Flex>
            <Divider style={{ margin: "6px 0" }} />
            <Text type="secondary">{vi.chat.chatTypeDirect}</Text>
            <Text type="secondary">
              {vi.chat.roomId}: {selectedRoom._id}
            </Text>
            <Divider style={{ margin: "8px 0" }} />
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text>{vi.chat.muteRoom}</Text>
              <Switch
                checked={Boolean(roomPref?.muted)}
                onChange={(checked) => void patchRoomPrefs({ muted: checked })}
              />
            </Flex>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Flex align="center" gap={12}>
              <Avatar
                size={52}
                src={
                  selectedRoom.avatar?.trim()
                    ? resolveMediaUrl(selectedRoom.avatar.trim(), API_BASE_URL)
                    : undefined
                }
                className="chat-room-info-avatar"
              >
                {(() => {
                  const t = getRoomDisplayName(selectedRoom, currentUserId).trim();
                  const ch = t.charAt(0).toUpperCase() || "#";
                  return ch === "#" ? <FiHash /> : ch;
                })()}
              </Avatar>
              <Text strong style={{ fontSize: 16 }}>
                {getRoomDisplayName(selectedRoom, currentUserId)}
              </Text>
            </Flex>
            <Divider style={{ margin: "6px 0" }} />
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text>{vi.chat.muteRoom}</Text>
              <Switch
                checked={Boolean(roomPref?.muted)}
                onChange={(checked) => void patchRoomPrefs({ muted: checked })}
              />
            </Flex>
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text>{vi.chat.pinRoomTop}</Text>
              <Switch
                checked={Boolean(roomPref?.sidebarPinned)}
                onChange={(checked) => void patchRoomPrefs({ sidebarPinned: checked })}
              />
            </Flex>
            <>
              <Divider style={{ margin: "4px 0" }} />
              <input
                ref={groupAvatarFileInputRef}
                type="file"
                accept="image/*"
                className="chat-hidden-file-input"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => void onGroupAvatarFileSelected(e)}
              />
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                {vi.chat.roomAvatarHint(UPLOAD_MAX_MB)}
              </Text>
              <Button
                type="primary"
                icon={<FiUpload aria-hidden />}
                loading={groupAvatarSaving}
                onClick={() => groupAvatarFileInputRef.current?.click()}
              >
                {vi.chat.roomAvatarPick}
              </Button>
            </>
            <Divider style={{ margin: "8px 0" }} />
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text strong>{vi.chat.memberCount(groupMembers.length)}</Text>
              {canAddGroupMembers ? (
                <Button type="primary" size="small" onClick={() => setIsAddMemberOpen(true)}>
                  {vi.chat.addMemberBtn}
                </Button>
              ) : null}
            </Flex>
            <List
              size="small"
              dataSource={groupMembers}
              locale={{ emptyText: vi.chat.noMembers }}
              renderItem={(member) => (
                <List.Item
                  actions={
                    canRemoveGroupMember(member.role, member.userId._id)
                      ? [
                          <Popconfirm
                            key="remove"
                            title={vi.chat.memberRemoveConfirm}
                            okText={vi.sidebar.delete}
                            cancelText={vi.sidebar.cancel}
                            onConfirm={() => void removeGroupMember(member.userId._id)}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<FiUserMinus />}
                              loading={removingMemberId === member.userId._id}
                              aria-label={vi.chat.memberRemoveConfirm}
                            />
                          </Popconfirm>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <AvatarWithStatus
                        online={member.userId.status === "online"}
                        src={
                          member.userId.avatar?.trim()
                            ? resolveMediaUrl(member.userId.avatar.trim(), API_BASE_URL)
                            : undefined
                        }
                      >
                        {member.userId.username.charAt(0).toUpperCase()}
                      </AvatarWithStatus>
                    }
                    title={member.userId.username}
                    description={
                      isRoomOwner &&
                      member.role !== "owner" &&
                      member.userId._id !== currentUserId ? (
                        <Select
                          size="small"
                          className="chat-member-role-select"
                          value={member.role}
                          style={{ minWidth: 148, marginTop: 4 }}
                          options={[
                            { value: "admin", label: vi.chat.roleAdmin },
                            { value: "member", label: vi.chat.roleMember },
                          ]}
                          onChange={(v) => void patchMemberRole(member.userId._id, v)}
                        />
                      ) : (
                        <Text type="secondary">{roleLabel(member.role)}</Text>
                      )
                    }
                  />
                </List.Item>
              )}
            />
            <Divider style={{ margin: "8px 0" }} />
            {isRoomOwner ? (
              <Button
                danger
                block
                onClick={() => {
                  setLeaveTransferUserId("");
                  setLeaveOwnerModalOpen(true);
                }}
              >
                {vi.chat.leaveGroup}
              </Button>
            ) : (
              <Popconfirm
                title={vi.chat.leaveGroupConfirm}
                okText={vi.sidebar.delete}
                cancelText={vi.sidebar.cancel}
                onConfirm={() => leaveGroupRoom()}
              >
                <Button danger block loading={leaveGroupLoading}>
                  {vi.chat.leaveGroup}
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}
      </Drawer>

      <Drawer
        title={vi.chat.addMemberTitle}
        placement="right"
        width="min(100vw - 16px, 340px)"
        open={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
      >
        {selectedRoom?.type !== "group" ? (
          <Text type="secondary">{vi.chat.addMemberOnlyGroup}</Text>
        ) : (
          <List
            size="small"
            dataSource={addableFriendsForGroup}
            locale={{ emptyText: vi.chat.allFriendsInGroup }}
            renderItem={(friend) => (
              <List.Item
                actions={[
                  <Button
                    key="add-to-group"
                    type="text"
                    size="small"
                    icon={<FiUserPlus />}
                    loading={addingMemberId === friend._id}
                    onClick={() => addMemberToGroup(friend._id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <AvatarWithStatus
                      online={friend.status === "online"}
                      src={
                        friend.avatar?.trim()
                          ? resolveMediaUrl(friend.avatar.trim(), API_BASE_URL)
                          : undefined
                      }
                    >
                      {friend.username.charAt(0).toUpperCase()}
                    </AvatarWithStatus>
                  }
                  title={friend.username}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Flex>
  );
}
