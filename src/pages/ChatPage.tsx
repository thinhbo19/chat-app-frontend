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
  FiMenu,
  FiMessageCircle,
  FiPhone,
  FiSearch,
  FiSettings,
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
  Space,
  Spin,
  Switch,
  Tooltip,
  Typography,
  message,
  notification,
} from "antd";
import { useNavigate } from "react-router-dom";
import { api, getAccessToken } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AvatarWithStatus } from "../components/AvatarWithStatus";

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
import type {
  ChatMessage,
  ChatMessageContentType,
  FriendRequest,
  FriendUser,
  OutgoingFriendRequest,
  Room,
  RoomReadStateEntry,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const { Title, Text } = Typography;

function getRoomDisplayName(room: Room, myUserId: string) {
  if (room.type !== "direct") {
    return room.name;
  }
  const counterpart = room.members.find((member) => member.userId._id !== myUserId)?.userId;
  return counterpart?.username ? `${counterpart.username}` : vi.chat.directFallback;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
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
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  /** Mobile (narrow): single left drawer = sidebar + cài đặt/tìm kiếm. Desktop: chỉ dùng cho drawer phụ. */
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [readStates, setReadStates] = useState<RoomReadStateEntry[]>([]);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRoomIdRef = useRef("");
  const settingsRef = useRef({
    soundNotify: true,
    desktopNotify: false,
  });
  const markReadTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [unreadByRoomId, setUnreadByRoomId] = useState<Record<string, number>>({});
  const [presenceClock, setPresenceClock] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPresenceClock((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
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
    setFriends(response.data.friends);
  }, []);

  const loadIncomingRequests = useCallback(async () => {
    const response = await api.get("/api/friends/requests/incoming");
    setIncomingRequests(response.data.requests);
  }, []);

  const loadOutgoingRequests = useCallback(async () => {
    const response = await api.get("/api/friends/requests/outgoing");
    setOutgoingRequests(response.data.requests);
  }, []);

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
    loadRooms().catch(() => message.error(vi.errors.loadRooms));
    loadFriends().catch(() => message.error(vi.errors.loadFriends));
    loadIncomingRequests().catch(() => message.error(vi.errors.loadIncoming));
    loadOutgoingRequests().catch(() => message.error(vi.errors.loadOutgoing));
  }, [loadFriends, loadIncomingRequests, loadOutgoingRequests, loadRooms]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      void loadRooms();
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
      const { soundNotify: snd, desktopNotify: dsk } = settingsRef.current;
      const isCurrentRoom = incomingRoomId === roomId;
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
        prev.map((f) => {
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
            if (mem.userId._id !== payload.userId) return mem;
            const u: typeof mem.userId = { ...mem.userId, status: payload.status };
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
    };
    const handleRoomListChanged = () => {
      loadRooms().catch(() => null);
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
    socket.on("friendship_updated", handleFriendshipUpdated);
    socket.on("friend_request_updated", handleFriendRequestUpdated);
    socket.on("friendship_removed", handleFriendshipRemoved);
    socket.on("friend_data_changed", handleFriendDataChanged);
    socket.on("room_list_changed", handleRoomListChanged);
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
      socket.off("friendship_updated", handleFriendshipUpdated);
      socket.off("friend_request_updated", handleFriendRequestUpdated);
      socket.off("friendship_removed", handleFriendshipRemoved);
      socket.off("friend_data_changed", handleFriendDataChanged);
      socket.off("room_list_changed", handleRoomListChanged);
      socket.off("direct_room_removed", handleDirectRoomRemoved);
    };
  }, [socket, loadFriends, loadIncomingRequests, loadOutgoingRequests, loadRooms, user?._id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadFriends, loadIncomingRequests, loadOutgoingRequests]);

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
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setReadStates([]);
      setMessagesHasMore(false);
      return;
    }

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
      api.post(`/api/rooms/${selectedRoomId}/read`, { messageId: last.id }).catch(() => null);
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
      const formData = new FormData();
      formData.append("file", pendingImage.file);
      setUploadingMedia(true);
      try {
        const response = await api.post<{ mediaUrl: string; contentType: ChatMessageContentType }>(
          "/api/messages/upload",
          formData,
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
      } catch (_error) {
        message.error(vi.errors.uploadImageFail);
      } finally {
        setUploadingMedia(false);
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
    const formData = new FormData();
    formData.append("file", file);
    setUploadingMedia(true);
    try {
      const response = await api.post<{ mediaUrl: string; contentType: ChatMessageContentType }>(
        "/api/messages/upload",
        formData,
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
    } catch (_error) {
      message.error(vi.errors.uploadFileFail);
    } finally {
      setUploadingMedia(false);
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
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }

  function onVideoOrAudioFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadAndEmitMedia(file);
  }

  async function searchUsers() {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await api.get("/api/users/search", {
        params: { q: searchText.trim() },
      });
      setSearchResults(response.data.users);
    } catch (_error) {
      message.error(vi.errors.userNotFound);
    }
  }

  async function sendFriendRequest(toUserId: string) {
    try {
      await api.post("/api/friends/request", { toUserId });
      message.success(vi.errors.inviteSent);
      setSearchResults((prev) => prev.filter((item) => item._id !== toUserId));
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
    try {
      const response = await api.post(`/api/rooms/direct/${friendUserId}`);
      const room = response.data.room as Room;
      await loadRooms();
      setSelectedRoomId(room._id);
      if (isNarrowLayout) {
        setMobileLeftOpen(false);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.openDirectFail));
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
      message.success(vi.errors.memberAdded);
      await loadRooms();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.memberAddFail));
    } finally {
      setAddingMemberId("");
    }
  }

  const selectedRoom = rooms.find((room) => room._id === selectedRoomId);
  const currentRoomName = selectedRoom
    ? getRoomDisplayName(selectedRoom, user?._id || "")
    : vi.chat.noRoom;
  const currentUserId = user?._id || "";
  const directCounterpart = useMemo(() => {
    if (!selectedRoom || selectedRoom.type !== "direct") {
      return null;
    }
    return selectedRoom.members.find((member) => member.userId._id !== currentUserId)?.userId || null;
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
    return selectedRoom.members;
  }, [selectedRoom]);
  const groupMemberIdSet = useMemo(
    () => new Set(groupMembers.map((member) => member.userId._id)),
    [groupMembers],
  );
  const addableFriendsForGroup = useMemo(
    () => friends.filter((friend) => !groupMemberIdSet.has(friend._id)),
    [friends, groupMemberIdSet],
  );
  const friendIdSet = useMemo(() => new Set(friends.map((item) => item._id)), [friends]);
  const outgoingIdSet = useMemo(
    () => new Set(outgoingRequests.map((item) => item.toUserId._id)),
    [outgoingRequests],
  );
  const visibleSearchResults = useMemo(
    () =>
      searchResults.filter(
        (item) => !friendIdSet.has(item._id) && !outgoingIdSet.has(item._id),
      ),
    [searchResults, friendIdSet, outgoingIdSet],
  );

  const groupRoomsOnly = useMemo(
    () => rooms.filter((room) => room.type === "group"),
    [rooms],
  );

  const unreadByFriendId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const room of rooms) {
      if (room.type !== "direct") continue;
      const other = room.members.find((m) => m.userId._id !== currentUserId)?.userId;
      if (other) {
        out[other._id] = unreadByRoomId[room._id] ?? 0;
      }
    }
    return out;
  }, [rooms, unreadByRoomId, currentUserId]);

  const myRoomRole = useMemo(() => {
    if (!selectedRoom) return null;
    const me = selectedRoom.members.find((m) => m.userId._id === currentUserId);
    return me?.role ?? null;
  }, [selectedRoom, currentUserId]);

  const canAddGroupMembers =
    selectedRoom?.type === "group" && myRoomRole != null && ["owner", "admin"].includes(myRoomRole);

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
        groupRoomsOnly={groupRoomsOnly}
        selectedRoomId={selectedRoomId}
        onSelectRoom={(roomId) => {
          setSelectedRoomId(roomId);
          if (isNarrowLayout) {
            setMobileLeftOpen(false);
          }
        }}
        myUserId={user?._id || ""}
        getRoomDisplayName={getRoomDisplayName}
        friends={friends}
        onOpenDirectRoom={(id) => void openDirectRoom(id)}
        onRemoveFriend={(id) => void removeFriend(id)}
        unreadByRoomId={unreadByRoomId}
        unreadByFriendId={unreadByFriendId}
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
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder={vi.chat.searchPlaceholder}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onPressEnter={searchUsers}
        />
        <Button onClick={searchUsers}>{vi.chat.search}</Button>
      </Space.Compact>
      <List
        size="small"
        dataSource={visibleSearchResults}
        locale={{ emptyText: vi.chat.noSearch }}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Tooltip key="add" title={vi.chat.addFriend}>
                <Button
                  type="text"
                  size="small"
                  icon={<FiUserPlus />}
                  onClick={() => sendFriendRequest(item._id)}
                  aria-label={vi.chat.addFriend}
                />
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar>{item.username.charAt(0).toUpperCase()}</Avatar>}
              title={item.username}
            />
          </List.Item>
        )}
      />
    </Space>
  );

  const outgoingPanelContent = (
    <List
      size="small"
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
    <List
      size="small"
      dataSource={incomingRequests}
      locale={{ emptyText: vi.chat.incomingEmpty }}
      renderItem={(request) => (
        <List.Item
          actions={[
            <Tooltip key="accept" title={vi.chat.accept}>
              <Button
                size="small"
                type="text"
                icon={<FiCheck />}
                onClick={() => handleRequest(request._id, "accept")}
                aria-label={vi.chat.accept}
              />
            </Tooltip>,
            <Tooltip key="reject" title={vi.chat.reject}>
              <Button
                size="small"
                type="text"
                danger
                icon={<FiX />}
                onClick={() => handleRequest(request._id, "reject")}
                aria-label={vi.chat.reject}
              />
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar>{request.fromUserId.username.charAt(0).toUpperCase()}</Avatar>}
            title={request.fromUserId.username}
          />
        </List.Item>
      )}
    />
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
        <aside className="chat-rail" aria-label={vi.chat.railNav}>
          <div className="chat-rail-stack chat-rail-stack--top">
            <Tooltip title={vi.chat.railChat}>
              <span
                className="chat-rail-btn chat-rail-btn--active"
                aria-label={vi.chat.railChat}
              >
                <FiMessageCircle aria-hidden />
              </span>
            </Tooltip>
            <Tooltip title={vi.chat.railOpenSearch}>
              <button
                type="button"
                className={`chat-rail-btn${railPanel === "search" ? " chat-rail-btn--active" : ""}`}
                onClick={() => toggleRailPanel("search")}
                aria-label={vi.chat.railOpenSearch}
                aria-pressed={railPanel === "search"}
              >
                <FiSearch />
              </button>
            </Tooltip>
            <Tooltip title={vi.chat.railOpenOutgoing}>
              <Badge count={outgoingRequests.length} size="small" offset={[-2, 2]}>
                <button
                  type="button"
                  className={`chat-rail-btn${railPanel === "outgoing" ? " chat-rail-btn--active" : ""}`}
                  onClick={() => toggleRailPanel("outgoing")}
                  aria-label={vi.chat.railOpenOutgoing}
                  aria-pressed={railPanel === "outgoing"}
                >
                  <FiClock />
                </button>
              </Badge>
            </Tooltip>
            <Tooltip title={vi.chat.railOpenIncoming}>
              <Badge count={incomingRequests.length} size="small" offset={[-2, 2]}>
                <button
                  type="button"
                  className={`chat-rail-btn${railPanel === "incoming" ? " chat-rail-btn--active" : ""}`}
                  onClick={() => toggleRailPanel("incoming")}
                  aria-label={vi.chat.railOpenIncoming}
                  aria-pressed={railPanel === "incoming"}
                >
                  <FiInbox />
                </button>
              </Badge>
            </Tooltip>
          </div>
          <div className="chat-rail-stack chat-rail-stack--bottom">
            <Tooltip title={settingsDrawerOpen ? vi.chat.settingsClose : vi.chat.settingsOpen}>
              <button
                type="button"
                className={`chat-rail-btn${settingsDrawerOpen ? " chat-rail-btn--active" : ""}`}
                onClick={toggleSettingsFromRail}
                aria-label={
                  settingsDrawerOpen ? vi.chat.settingsClose : vi.chat.settingsOpen
                }
                aria-pressed={settingsDrawerOpen}
              >
                <FiSettings />
              </button>
            </Tooltip>
            <Tooltip title={vi.chat.logout}>
              <button
                type="button"
                className="chat-rail-btn chat-rail-btn--danger"
                onClick={() => void handleLogout()}
                aria-label={vi.chat.logout}
              >
                <FiLogOut />
              </button>
            </Tooltip>
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
        title={vi.chat.incoming(incomingRequests.length)}
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
        <nav className="chat-mobile-top-nav" aria-label={vi.chat.mobileQuickMenu}>
          <div className="chat-mobile-top-nav-inner">
            <div className="chat-mobile-top-nav-group">
              <Tooltip title={mobileLeftOpen ? vi.chat.extraClose : vi.chat.sidebarMenu}>
                <button
                  type="button"
                  className={`chat-mobile-top-nav-btn${mobileLeftOpen ? " chat-mobile-top-nav-btn--active" : ""}`}
                  onClick={toggleMobileSidebar}
                  aria-label={mobileLeftOpen ? vi.chat.extraClose : vi.chat.sidebarMenu}
                  aria-pressed={mobileLeftOpen}
                >
                  <FiMenu aria-hidden />
                </button>
              </Tooltip>
              <Tooltip title={vi.chat.railOpenSearch}>
                <button
                  type="button"
                  className={`chat-mobile-top-nav-btn${railPanel === "search" ? " chat-mobile-top-nav-btn--active" : ""}`}
                  onClick={() => toggleRailPanel("search")}
                  aria-label={vi.chat.railOpenSearch}
                  aria-pressed={railPanel === "search"}
                >
                  <FiSearch aria-hidden />
                </button>
              </Tooltip>
              <Tooltip title={vi.chat.railOpenOutgoing}>
                <Badge count={outgoingRequests.length} size="small" offset={[-2, 2]}>
                  <button
                    type="button"
                    className={`chat-mobile-top-nav-btn${railPanel === "outgoing" ? " chat-mobile-top-nav-btn--active" : ""}`}
                    onClick={() => toggleRailPanel("outgoing")}
                    aria-label={vi.chat.railOpenOutgoing}
                    aria-pressed={railPanel === "outgoing"}
                  >
                    <FiClock aria-hidden />
                  </button>
                </Badge>
              </Tooltip>
              <Tooltip title={vi.chat.railOpenIncoming}>
                <Badge count={incomingRequests.length} size="small" offset={[-2, 2]}>
                  <button
                    type="button"
                    className={`chat-mobile-top-nav-btn${railPanel === "incoming" ? " chat-mobile-top-nav-btn--active" : ""}`}
                    onClick={() => toggleRailPanel("incoming")}
                    aria-label={vi.chat.railOpenIncoming}
                    aria-pressed={railPanel === "incoming"}
                  >
                    <FiInbox aria-hidden />
                  </button>
                </Badge>
              </Tooltip>
            </div>
            <div className="chat-mobile-top-nav-group chat-mobile-top-nav-group--end">
              <Tooltip title={settingsDrawerOpen ? vi.chat.settingsClose : vi.chat.settingsOpen}>
                <button
                  type="button"
                  className={`chat-mobile-top-nav-btn${settingsDrawerOpen ? " chat-mobile-top-nav-btn--active" : ""}`}
                  onClick={toggleSettingsFromRail}
                  aria-label={
                    settingsDrawerOpen ? vi.chat.settingsClose : vi.chat.settingsOpen
                  }
                  aria-pressed={settingsDrawerOpen}
                >
                  <FiSettings aria-hidden />
                </button>
              </Tooltip>
              <Tooltip title={vi.chat.logout}>
                <button
                  type="button"
                  className="chat-mobile-top-nav-btn chat-mobile-top-nav-btn--danger"
                  onClick={() => void handleLogout()}
                  aria-label={vi.chat.logout}
                >
                  <FiLogOut aria-hidden />
                </button>
              </Tooltip>
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
            <Flex align="center" gap={8} style={{ flex: "1 1 160px", minWidth: 0 }}>
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
              <Tooltip title={vi.chat.callAudio}>
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiPhone />}
                  aria-label={vi.chat.callAudio}
                />
              </Tooltip>
              <Tooltip title={vi.chat.callVideo}>
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiCamera />}
                  aria-label={vi.chat.callVideo}
                />
              </Tooltip>
              <Tooltip title={vi.chat.roomInfo}>
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiInfo />}
                  onClick={() => setIsRoomInfoOpen(true)}
                  disabled={!selectedRoom}
                  aria-label={vi.chat.roomInfo}
                />
              </Tooltip>
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
              <ChatMessageList
                messages={messages}
                currentUserId={currentUserId}
                selectedRoom={selectedRoom}
                apiBaseUrl={API_BASE_URL}
                hasMore={messagesHasMore}
                loadingOlder={loadingOlder}
                onLoadOlder={(beforeId) => void loadOlderMessages(beforeId)}
                onRecall={(id) => void recallMessage(id)}
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

      <Drawer
        title={selectedRoom?.type === "direct" ? vi.chat.roomInfoDirect : vi.chat.roomInfoGroup}
        placement="right"
        width="min(100vw - 16px, 340px)"
        open={isRoomInfoOpen}
        onClose={() => {
          setIsRoomInfoOpen(false);
          setIsAddMemberOpen(false);
        }}
      >
        {!selectedRoom ? (
          <Text type="secondary">{vi.chat.noRoomInfo}</Text>
        ) : selectedRoom.type === "direct" ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Flex align="center" gap={12}>
              <AvatarWithStatus size={52} online={directCounterpart?.status === "online"}>
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
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
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
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <AvatarWithStatus online={member.userId.status === "online"}>
                        {member.userId.username.charAt(0).toUpperCase()}
                      </AvatarWithStatus>
                    }
                    title={member.userId.username}
                    description={member.role}
                  />
                </List.Item>
              )}
            />
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
                  <Tooltip key="add-to-group" title={vi.chat.addToGroup}>
                    <Button
                      type="text"
                      size="small"
                      icon={<FiUserPlus />}
                      loading={addingMemberId === friend._id}
                      onClick={() => addMemberToGroup(friend._id)}
                      aria-label={vi.chat.addToGroup}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <AvatarWithStatus online={friend.status === "online"}>
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
