import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  FiCamera,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiInfo,
  FiLogOut,
  FiMenu,
  FiPhone,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Input,
  List,
  Modal,
  Space,
  Switch,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import { api, getAccessToken } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AvatarWithStatus } from "../components/AvatarWithStatus";
import { ChatComposeRow } from "../components/chat/ChatComposeRow";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatSidebarBody } from "../components/chat/ChatSidebarBody";
import { useChatSettings } from "../context/ChatSettingsContext";
import { getApiErrorMessage } from "../utils/apiError";
import { formatChatHeaderPresence } from "../utils/formatPresence";
import { playMessageBeep } from "../utils/messageSound";
import type {
  ChatMessage,
  ChatMessageContentType,
  FriendRequest,
  FriendUser,
  OutgoingFriendRequest,
  Room,
  RoomReadStateEntry,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const { Title, Text } = Typography;

function getRoomDisplayName(room: Room, myUserId: string) {
  if (room.type !== "direct") {
    return room.name;
  }
  const counterpart = room.members.find((member) => member.userId._id !== myUserId)?.userId;
  return counterpart?.username ? `${counterpart.username}` : "Chat 1-1";
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
  const [isExtraMenuOpen, setIsExtraMenuOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
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
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
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
    const mq = window.matchMedia("(max-width: 992px)");
    const sync = () => setIsNarrowLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isNarrowLayout) {
      setSidebarDrawerOpen(false);
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
      timeout: 5000,
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
        message.error("Khong tai them tin nhan cu");
      } finally {
        setLoadingOlder(false);
      }
    },
    [selectedRoomId, messagesHasMore, loadingOlder],
  );

  useEffect(() => {
    loadRooms().catch(() => message.error("Khong tai duoc danh sach room"));
    loadFriends().catch(() => message.error("Khong tai duoc danh sach ban be"));
    loadIncomingRequests().catch(() => message.error("Khong tai duoc loi moi ket ban"));
    loadOutgoingRequests().catch(() => message.error("Khong tai duoc danh sach cho"));
  }, [loadFriends, loadIncomingRequests, loadOutgoingRequests, loadRooms]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => null;
    const handleConnectError = (error: Error) => {
      const latestToken = getAccessToken();
      if (latestToken) {
        socket.auth = { token: latestToken };
      }
      message.error(`Socket loi: ${error.message}`);
    };

    function previewIncoming(m: ChatMessage) {
      if (m.deleted) return "Tin nhan da duoc thu hoi";
      if (m.contentType === "image") return "Hinh anh";
      if (m.contentType === "video") return "Video";
      if (m.contentType === "audio") return "Am thanh";
      return (m.text || "").slice(0, 120) || "Tin nhan";
    }

    const handleNewMessage = (incoming: ChatMessage) => {
      const roomId = selectedRoomIdRef.current;
      if (incoming.roomId === roomId) {
        setMessages((prev) => {
          if (prev.some((p) => p.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      }
      const myId = user?._id;
      const fromOther = Boolean(myId && incoming.sender.id !== myId);
      if (fromOther && incoming.roomId !== roomId) {
        setUnreadByRoomId((prev) => ({
          ...prev,
          [incoming.roomId]: (prev[incoming.roomId] || 0) + 1,
        }));
      }
      if (!fromOther) return;
      const { soundNotify: snd, desktopNotify: dsk } = settingsRef.current;
      const isCurrentRoom = incoming.roomId === roomId;
      if (snd && (!isCurrentRoom || document.visibilityState === "hidden")) {
        playMessageBeep();
      }
      if (
        dsk &&
        document.visibilityState === "hidden" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(incoming.sender.username, {
          body: previewIncoming(incoming),
          tag: incoming.id,
        });
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
      message.info("Ban vua nhan duoc loi moi ket ban moi");
    };
    const handleFriendshipUpdated = () => {
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      message.success("Danh sach ban be da duoc cap nhat");
    };
    const handleFriendRequestUpdated = () => {
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
    };
    const handleFriendshipRemoved = () => {
      loadFriends().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      message.info("Mot moi quan he ban be vua bi xoa");
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
        if (!cancelled) message.error("Khong tai duoc lich su tin nhan");
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
            message.error(response?.error || "Khong vao duoc room");
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
      message.error(getApiErrorMessage(error, "Thu hoi that bai"));
    }
  }

  async function createRoom() {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    try {
      await api.post("/api/rooms", { name: trimmed });
      setRoomName("");
      await loadRooms();
      message.success("Tao room thanh cong");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Tao room that bai"));
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
        const caption = messageInput.trim();
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
              message.error(res?.error || "Gui anh that bai");
              return;
            }
            setMessageInput("");
            clearPendingImage();
          },
        );
      } catch (_error) {
        message.error("Tai anh len that bai");
      } finally {
        setUploadingMedia(false);
      }
      return;
    }

    const trimmed = messageInput.trim();
    if (!trimmed) {
      message.warning("Nhap tin nhan hoac chon anh");
      return;
    }

    socket.emit(
      "send_message",
      { roomId: selectedRoomId, contentType: "text" as const, text: trimmed, mediaUrl: "" },
      (response: { ok: boolean; error?: string }) => {
        if (!response?.ok) {
          message.error(response?.error || "Gui tin nhan that bai");
          return;
        }
        setMessageInput("");
      },
    );
  }

  async function uploadAndEmitMedia(file: File) {
    if (!selectedRoomId || !socket) {
      message.warning("Chon room truoc");
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
      const caption = messageInput.trim();
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
            message.error(res?.error || "Gui file that bai");
            return;
          }
          setMessageInput("");
        },
      );
    } catch (_error) {
      message.error("Tai file len that bai");
    } finally {
      setUploadingMedia(false);
    }
  }

  function onImageFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.warning("Vui long chon file anh");
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
      message.error("Khong tim duoc user");
    }
  }

  async function sendFriendRequest(toUserId: string) {
    try {
      await api.post("/api/friends/request", { toUserId });
      message.success("Da gui loi moi ket ban");
      setSearchResults((prev) => prev.filter((item) => item._id !== toUserId));
      await loadIncomingRequests();
      await loadFriends();
      await loadOutgoingRequests();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Gui loi moi that bai"));
    }
  }

  async function handleRequest(requestId: string, action: "accept" | "reject") {
    try {
      await api.post(`/api/friends/request/${requestId}/${action}`);
      message.success(action === "accept" ? "Da chap nhan loi moi" : "Da tu choi loi moi");
      await loadIncomingRequests();
      await loadFriends();
    } catch (_error) {
      message.error("Cap nhat loi moi that bai");
    }
  }

  async function removeFriend(friendUserId: string) {
    try {
      await api.delete(`/api/friends/${friendUserId}`);
      message.success("Da xoa ket ban");
      await loadFriends();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Xoa ket ban that bai"));
    }
  }

  async function openDirectRoom(friendUserId: string) {
    try {
      const response = await api.post(`/api/rooms/direct/${friendUserId}`);
      const room = response.data.room as Room;
      await loadRooms();
      setSelectedRoomId(room._id);
      if (isNarrowLayout) {
        setSidebarDrawerOpen(false);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Khong mo duoc room chat 1-1"));
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
      message.success("Da them thanh vien vao nhom");
      await loadRooms();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Them thanh vien that bai"));
    } finally {
      setAddingMemberId("");
    }
  }

  const selectedRoom = rooms.find((room) => room._id === selectedRoomId);
  const currentRoomName = selectedRoom
    ? getRoomDisplayName(selectedRoom, user?._id || "")
    : "Chua chon room";
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
    <ChatSidebarBody
      roomName={roomName}
      onRoomNameChange={setRoomName}
      onCreateRoom={() => void createRoom()}
      groupRoomsOnly={groupRoomsOnly}
      selectedRoomId={selectedRoomId}
      onSelectRoom={(roomId) => {
        setSelectedRoomId(roomId);
        if (isNarrowLayout) {
          setSidebarDrawerOpen(false);
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
  );

  const sidebarCardTitle = `Xin chao, ${user?.username || ""}`;
  const sidebarCardExtra = (
    <Tooltip title="Dang xuat">   
      <Button danger size="small" onClick={handleLogout}>
        <FiLogOut aria-label="Dang xuat"/>
      </Button>
    </Tooltip>
  );

  return (
    <Flex className="chat-layout" gap={16}>
      <Button
        className="extra-menu-trigger"
        shape="circle"
        type="default"
        icon={isExtraMenuOpen ? <FiChevronLeft /> : <FiChevronRight />}
        onClick={() => setIsExtraMenuOpen((prev) => !prev)}
        aria-label={isExtraMenuOpen ? "Dong menu mo rong" : "Mo menu mo rong"}
      />
      {!isNarrowLayout ? (
        <Card className="chat-sidebar" title={sidebarCardTitle} extra={sidebarCardExtra}>
          {sidebarBody}
        </Card>
      ) : null}

      {isNarrowLayout ? (
        <Drawer
          className="chat-sidebar-drawer"
          title={sidebarCardTitle}
          extra={sidebarCardExtra}
          placement="left"
          width="min(360px, 100vw)"
          open={sidebarDrawerOpen}
          onClose={() => setSidebarDrawerOpen(false)}
          styles={{ body: { padding: 12 } }}
        >
          <div className="chat-sidebar-drawer-inner">{sidebarBody}</div>
        </Drawer>
      ) : null}

      <Drawer
        title="Menu mo rong"
        placement="left"
        width={360}
        open={isExtraMenuOpen}
        onClose={() => setIsExtraMenuOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Text strong>Cài đặt</Text>
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Text>Giao diện tối</Text>
            <Switch
              checked={theme === "dark"}
              onChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </Flex>
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Text>Thông báo desktop (tab ẩn)</Text>
            <Switch
              checked={desktopNotify}
              onChange={async (checked) => {
                if (checked) {
                  const p = await requestNotificationPermission();
                  if (p !== "granted") {
                    message.warning("Trinh duyet tu choi hoac chua cap quyen thong bao");
                    return;
                  }
                }
                setDesktopNotify(checked);
              }}
            />
          </Flex>
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Text>Âm báo tin mới</Text>
            <Switch checked={soundNotify} onChange={setSoundNotify} />
          </Flex>
          <Text type="secondary">Ngôn ngữ: Tiếng Việt (chuẩn hoá dần trong app)</Text>

          <Divider style={{ margin: "8px 0" }} />
          <Text strong>Tim user</Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="Nhap username hoac email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onPressEnter={searchUsers}
            />
            <Button onClick={searchUsers}>Tim</Button>
          </Space.Compact>
          <List
            size="small"
            dataSource={visibleSearchResults}
            locale={{ emptyText: "Khong co ket qua" }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Tooltip key="add" title="Ket ban">
                    <Button
                      type="text"
                      size="small"
                      icon={<FiUserPlus />}
                      onClick={() => sendFriendRequest(item._id)}
                      aria-label="Ket ban"
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

          <Divider style={{ margin: "4px 0" }} />
          <Text strong>Danh sach cho ({outgoingRequests.length})</Text>
          <List
            size="small"
            dataSource={outgoingRequests}
            locale={{ emptyText: "Khong co loi moi dang cho" }}
            renderItem={(request) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar>{request.toUserId.username.charAt(0).toUpperCase()}</Avatar>}
                  title={request.toUserId.username}
                  description="Dang cho chap nhan"
                />
              </List.Item>
            )}
          />

          <Divider style={{ margin: "4px 0" }} />
          <Text strong>Loi moi den ({incomingRequests.length})</Text>
          <List
            size="small"
            dataSource={incomingRequests}
            locale={{ emptyText: "Khong co loi moi" }}
            renderItem={(request) => (
              <List.Item
                actions={[
                  <Tooltip key="accept" title="Chap nhan">
                    <Button
                      size="small"
                      type="text"
                      icon={<FiCheck />}
                      onClick={() => handleRequest(request._id, "accept")}
                      aria-label="Chap nhan"
                    />
                  </Tooltip>,
                  <Tooltip key="reject" title="Tu choi">
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<FiX />}
                      onClick={() => handleRequest(request._id, "reject")}
                      aria-label="Tu choi"
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar>{request.fromUserId.username.charAt(0).toUpperCase()}</Avatar>
                  }
                  title={request.fromUserId.username}
                />
              </List.Item>
            )}
          />
        </Space>
      </Drawer>

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
          <Flex justify="space-between" align="center" gap={8} wrap="nowrap" flex="none">
            <Flex align="center" gap={8} style={{ flex: 1, minWidth: 0 }}>
              {isNarrowLayout ? (
                <Button
                  type="text"
                  className="chat-mobile-sidebar-trigger"
                  icon={<FiMenu />}
                  onClick={() => setSidebarDrawerOpen(true)}
                  aria-label="Mo menu sidebar"
                />
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
            <Space size={8}>
              <Tooltip title="Goi dien">
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiPhone />}
                  aria-label="Goi dien"
                />
              </Tooltip>
              <Tooltip title="Goi video">
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiCamera />}
                  aria-label="Goi video"
                />
              </Tooltip>
              <Tooltip title="Thong tin room">
                <Button
                  className="chat-header-icon-btn"
                  shape="circle"
                  icon={<FiInfo />}
                  onClick={() => setIsRoomInfoOpen(true)}
                  disabled={!selectedRoom}
                  aria-label="Thong tin room"
                />
              </Tooltip>
            </Space>
          </Flex>

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
              messageInput={messageInput}
              onMessageInputChange={setMessageInput}
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
              sendDisabled={
                !selectedRoomId ||
                uploadingMedia ||
                (!pendingImage && !messageInput.trim())
              }
            />
          </Flex>
        </Flex>
      </Card>

      <Modal
        title="Xem truoc anh"
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
        title={selectedRoom?.type === "direct" ? "Thong tin nguoi dung" : "Thanh vien trong nhom"}
        placement="right"
        width={340}
        open={isRoomInfoOpen}
        onClose={() => {
          setIsRoomInfoOpen(false);
          setIsAddMemberOpen(false);
        }}
      >
        {!selectedRoom ? (
          <Text type="secondary">Chua chon room de xem thong tin</Text>
        ) : selectedRoom.type === "direct" ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Flex align="center" gap={12}>
              <AvatarWithStatus size={52} online={directCounterpart?.status === "online"}>
                {(directCounterpart?.username || "?").charAt(0).toUpperCase()}
              </AvatarWithStatus>
              <Space direction="vertical" size={2}>
                <Text strong>{directCounterpart?.username || "Khong co ten"}</Text>
                <Text type="secondary">{directCounterpart?.email || "Khong co email"}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {directHeaderPresence}
                </Text>
              </Space>
            </Flex>
            <Divider style={{ margin: "6px 0" }} />
            <Text type="secondary">Loai chat: 1-1</Text>
            <Text type="secondary">Room ID: {selectedRoom._id}</Text>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text strong>Tong so thanh vien: {groupMembers.length}</Text>
              {canAddGroupMembers ? (
                <Button type="primary" size="small" onClick={() => setIsAddMemberOpen(true)}>
                  Them thanh vien
                </Button>
              ) : null}
            </Flex>
            <List
              size="small"
              dataSource={groupMembers}
              locale={{ emptyText: "Khong co thanh vien" }}
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
        title="Them thanh vien vao nhom"
        placement="right"
        width={340}
        open={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
      >
        {selectedRoom?.type !== "group" ? (
          <Text type="secondary">Chi ho tro them thanh vien cho chat nhom</Text>
        ) : (
          <List
            size="small"
            dataSource={addableFriendsForGroup}
            locale={{ emptyText: "Tat ca ban be da co trong nhom" }}
            renderItem={(friend) => (
              <List.Item
                actions={[
                  <Tooltip key="add-to-group" title="Them vao nhom">
                    <Button
                      type="text"
                      size="small"
                      icon={<FiUserPlus />}
                      loading={addingMemberId === friend._id}
                      onClick={() => addMemberToGroup(friend._id)}
                      aria-label="Them vao nhom"
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
