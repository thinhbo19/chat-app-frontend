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
import {
  FiCheck,
  FiClock,
  FiInbox,
  FiLogOut,
  FiHash,
  FiMenu,
  FiMessageCircle,
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
} from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AvatarWithStatus } from "../components/AvatarWithStatus";
import { ChatThreadHeader } from "../components/chat/ChatThreadHeader";

const ChatSidebarBody = lazy(() =>
  import("../components/chat/ChatSidebarBody").then((m) => ({ default: m.ChatSidebarBody })),
);
const ChatMessageList = lazy(() =>
  import("../components/chat/ChatMessageList").then((m) => ({ default: m.ChatMessageList })),
);
const ChatSettingsPanel = lazy(() =>
  import("../components/chat/ChatSettingsPanel").then((m) => ({ default: m.ChatSettingsPanel })),
);
const PersonalProfileModal = lazy(() =>
  import("../components/profile/PersonalProfileModal").then((m) => ({
    default: m.PersonalProfileModal,
  })),
);
import { useChatSettings } from "../context/ChatSettingsContext";
import { getApiErrorMessage } from "../utils/apiError";
import { formatChatHeaderPresence } from "../utils/formatPresence";
import { unlockMessageAudio } from "../utils/messageSound";
import { vi } from "../strings/vi";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { isRoomMemberPopulated } from "../utils/roomMember";
import { useChatAutoRefresh } from "../hooks/useChatAutoRefresh";
import { useChatComposerActions } from "../hooks/useChatComposerActions";
import { useChatDiscoveryActions } from "../hooks/useChatDiscoveryActions";
import { useChatDomainActions } from "../hooks/useChatDomainActions";
import { useChatPageLifecycle } from "../hooks/useChatPageLifecycle";
import { useChatSocketConnection } from "../hooks/useChatSocketConnection";
import { useChatSocketEvents } from "../hooks/useChatSocketEvents";
import { useChatThreadActions } from "../hooks/useChatThreadActions";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setChatThreadLoading as setChatThreadLoadingAction,
  setMessages as setMessagesAction,
  setMessagesHasMore as setMessagesHasMoreAction,
  setReadStates as setReadStatesAction,
  setRooms as setRoomsAction,
  setSelectedRoomId as setSelectedRoomIdAction,
  setFriends as setFriendsAction,
  setGroupInvites as setGroupInvitesAction,
  setThreadSearchHits as setThreadSearchHitsAction,
  setThreadSearchLoading as setThreadSearchLoadingAction,
  setThreadSearchOpen as setThreadSearchOpenAction,
  setThreadSearchQuery as setThreadSearchQueryAction,
  setUnreadByRoomId as setUnreadByRoomIdAction,
} from "../store/chatSlice";
import {
  selectCanPinMessagesInThread,
  selectFriendsSafe,
  selectMyRoomRole,
  selectRoomPref,
  selectSelectedRoom,
  selectSortedGroupRooms,
  selectUnreadByFriendId,
  selectVisibleDiscoveryResults,
} from "../store/chatSelectors";
import {
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  fetchPendingGroupInvites,
  fetchRoomsAndUnread,
} from "../store/chatThunks";
import type {
  AuthUser,
  ChatMessage,
  FriendUser,
  GroupInvite,
  Room,
  RoomReadStateEntry,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const BROWSE_PAGE_SIZE = 40;
const UPLOAD_MAX_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB) || 25;
const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;

const { Text } = Typography;

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
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, logout, updateCurrentUser, loadProfile } = useAuth();
  const {
    theme,
    setTheme,
    uiPreset,
    setUiPreset,
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
  const rooms = useAppSelector((state) => state.chat.rooms);
  const selectedRoomId = useAppSelector((state) => state.chat.selectedRoomId);
  const messages = useAppSelector((state) => state.chat.messages);
  const composeRef = useRef<ChatComposeRowHandle>(null);
  const [roomName, setRoomName] = useState("");

  const friends = useAppSelector((state) => state.chat.friends);
  const incomingRequests = useAppSelector((state) => state.chat.incomingRequests);
  const outgoingRequests = useAppSelector((state) => state.chat.outgoingRequests);
  const groupInvites = useAppSelector((state) => state.chat.groupInvites);
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

  const { socket, socketRef } = useChatSocketConnection({ apiBaseUrl: API_BASE_URL });
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  /** Mobile (narrow): single left drawer = sidebar + cài đặt/tìm kiếm. Desktop: chỉ dùng cho drawer phụ. */
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const readStates = useAppSelector((state) => state.chat.readStates);
  const messagesHasMore = useAppSelector((state) => state.chat.messagesHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const chatThreadLoading = useAppSelector((state) => state.chat.chatThreadLoading);
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
  const unreadByRoomId = useAppSelector((state) => state.chat.unreadByRoomId);
  const [presenceClock, setPresenceClock] = useState(0);
  const threadSearchOpen = useAppSelector((state) => state.chat.threadSearch.open);
  const threadSearchQuery = useAppSelector((state) => state.chat.threadSearch.query);
  const threadSearchLoading = useAppSelector((state) => state.chat.threadSearch.loading);
  const threadSearchHits = useAppSelector((state) => state.chat.threadSearch.hits);
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

  const setRooms = useCallback(
    (next: Room[] | ((prev: Room[]) => Room[])) => {
      const value = typeof next === "function" ? (next as (prev: Room[]) => Room[])(rooms) : next;
      dispatch(setRoomsAction(value));
    },
    [dispatch, rooms],
  );

  const setSelectedRoomId = useCallback(
    (next: string | ((prev: string) => string)) => {
      const value =
        typeof next === "function" ? (next as (prev: string) => string)(selectedRoomId) : next;
      dispatch(setSelectedRoomIdAction(value));
    },
    [dispatch, selectedRoomId],
  );

  const setMessages = useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const value =
        typeof next === "function"
          ? (next as (prev: ChatMessage[]) => ChatMessage[])(messages)
          : next;
      dispatch(setMessagesAction(value));
    },
    [dispatch, messages],
  );

  const setReadStates = useCallback(
    (next: RoomReadStateEntry[] | ((prev: RoomReadStateEntry[]) => RoomReadStateEntry[])) => {
      const value =
        typeof next === "function"
          ? (next as (prev: RoomReadStateEntry[]) => RoomReadStateEntry[])(readStates)
          : next;
      dispatch(setReadStatesAction(value));
    },
    [dispatch, readStates],
  );

  const setMessagesHasMore = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value =
        typeof next === "function" ? (next as (prev: boolean) => boolean)(messagesHasMore) : next;
      dispatch(setMessagesHasMoreAction(value));
    },
    [dispatch, messagesHasMore],
  );

  const setChatThreadLoading = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value =
        typeof next === "function" ? (next as (prev: boolean) => boolean)(chatThreadLoading) : next;
      dispatch(setChatThreadLoadingAction(value));
    },
    [dispatch, chatThreadLoading],
  );

  const setUnreadByRoomId = useCallback(
    (
      next:
        | Record<string, number>
        | ((prev: Record<string, number>) => Record<string, number>),
    ) => {
      const value =
        typeof next === "function"
          ? (next as (prev: Record<string, number>) => Record<string, number>)(unreadByRoomId)
          : next;
      dispatch(setUnreadByRoomIdAction(value));
    },
    [dispatch, unreadByRoomId],
  );

  const setFriends = useCallback(
    (next: FriendUser[] | ((prev: FriendUser[]) => FriendUser[])) => {
      const value =
        typeof next === "function" ? (next as (prev: FriendUser[]) => FriendUser[])(friends) : next;
      dispatch(setFriendsAction(value));
    },
    [dispatch, friends],
  );

  const setGroupInvites = useCallback(
    (next: GroupInvite[] | ((prev: GroupInvite[]) => GroupInvite[])) => {
      const value =
        typeof next === "function"
          ? (next as (prev: GroupInvite[]) => GroupInvite[])(groupInvites)
          : next;
      dispatch(setGroupInvitesAction(value));
    },
    [dispatch, groupInvites],
  );

  const setThreadSearchOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value =
        typeof next === "function" ? (next as (prev: boolean) => boolean)(threadSearchOpen) : next;
      dispatch(setThreadSearchOpenAction(value));
    },
    [dispatch, threadSearchOpen],
  );

  const setThreadSearchQuery = useCallback(
    (next: string | ((prev: string) => string)) => {
      const value =
        typeof next === "function" ? (next as (prev: string) => string)(threadSearchQuery) : next;
      dispatch(setThreadSearchQueryAction(value));
    },
    [dispatch, threadSearchQuery],
  );

  const setThreadSearchLoading = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value =
        typeof next === "function"
          ? (next as (prev: boolean) => boolean)(threadSearchLoading)
          : next;
      dispatch(setThreadSearchLoadingAction(value));
    },
    [dispatch, threadSearchLoading],
  );

  const setThreadSearchHits = useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const value =
        typeof next === "function"
          ? (next as (prev: ChatMessage[]) => ChatMessage[])(threadSearchHits)
          : next;
      dispatch(setThreadSearchHitsAction(value));
    },
    [dispatch, threadSearchHits],
  );

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

  const loadRooms = useCallback(async () => {
    await dispatch(fetchRoomsAndUnread()).unwrap();
  }, [dispatch]);

  const loadFriends = useCallback(async () => {
    await dispatch(fetchFriends()).unwrap();
  }, [dispatch]);

  const handleProfileUserUpdated = useCallback(
    (u: AuthUser) => {
      updateCurrentUser(u);
      void loadRooms();
      void loadFriends();
    },
    [updateCurrentUser, loadRooms, loadFriends],
  );

  const loadIncomingRequests = useCallback(async () => {
    await dispatch(fetchIncomingRequests()).unwrap();
  }, [dispatch]);

  const loadOutgoingRequests = useCallback(async () => {
    await dispatch(fetchOutgoingRequests()).unwrap();
  }, [dispatch]);

  const loadPendingGroupInvites = useCallback(async () => {
    try {
      await dispatch(fetchPendingGroupInvites()).unwrap();
    } catch {
      message.error(vi.errors.loadGroupInvites);
      setGroupInvites([]);
    }
  }, [dispatch, setGroupInvites]);

  useEffect(() => {
    discoveryModeRef.current = discoveryMode;
  }, [discoveryMode]);

  useEffect(() => {
    browseNextCursorRef.current = browseNextCursor;
  }, [browseNextCursor]);

  const { loadBrowseFirstPage, loadBrowseMore, searchUsers } = useChatDiscoveryActions({
    browsePageSize: BROWSE_PAGE_SIZE,
    searchText,
    setDiscoveryMode,
    setBrowseNextCursor,
    browseNextCursorRef,
    discoveryModeRef,
    browseMoreLockRef,
    setBrowseLoading,
    setBrowseLoadingMore,
    setDiscoveryList,
  });

  useEffect(() => {
    if (railPanel !== "search") return;
    setSearchText("");
    void loadBrowseFirstPage();
  }, [railPanel, loadBrowseFirstPage]);

  useChatSocketEvents({
    socket,
    selectedRoomIdRef,
    userRef,
    settingsRef,
    userId: user?._id,
    loadRooms,
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
    setMessages,
    setUnreadByRoomId,
    setReadStates,
    setFriends,
    setRooms,
    setSelectedRoomId,
    setMessagesHasMore,
  });

  useChatAutoRefresh({
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
    loadRooms,
    isSocketConnected: Boolean(socket?.connected),
  });

  useChatPageLifecycle({
    dispatch,
    socket,
    socketRef,
    selectedRoomId,
    messages,
    composeRef,
    markReadTimerRef,
    endOfMessagesRef,
    setMessages,
    setReadStates,
    setMessagesHasMore,
    setChatThreadLoading,
    setUnreadByRoomId,
    setPendingImage,
    loadRooms,
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
  });

  const { clearPendingImage, onImageFileSelected, onVideoOrAudioFileSelected, submitComposer } =
    useChatComposerActions({
      dispatch,
      selectedRoomId,
      socket,
      composeRef,
      uploadMaxBytes: UPLOAD_MAX_BYTES,
      uploadMaxMb: UPLOAD_MAX_MB,
      pendingImage,
      setPendingImage,
      setUploadingMedia,
      setUploadProgress,
    });

  const { loadOlderMessages, runThreadSearch } = useChatThreadActions({
    dispatch,
    selectedRoomId,
    messages,
    messagesHasMore,
    loadingOlder,
    messagesScrollRef,
    pendingScrollMessageId,
    setPendingScrollMessageId,
    setHighlightMessageId,
    setThreadSearchOpen,
    threadSearchQuery,
    setThreadSearchHits,
    setThreadSearchLoading,
    setMessages,
    setMessagesHasMore,
    setLoadingOlder,
  });


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


  async function handleLogout() {
    await logout();
    navigate("/login");
  }


  const selectedRoom = useAppSelector(selectSelectedRoom);
  const {
    acceptGroupInviteAction,
    addMemberToGroup,
    createRoomByName,
    declineGroupInviteAction,
    handleRequest,
    leaveGroupRoom,
    openDirectRoom,
    patchMemberRole,
    patchRoomPrefs,
    pinThreadMessage,
    recallMessage,
    removeFriend,
    removeGroupMember,
    sendFriendRequest,
    toggleMessageReaction,
    unpinThreadMessage,
  } = useChatDomainActions({
    dispatch,
    selectedRoomId,
    selectedRoom,
    isNarrowLayout,
    setMobileLeftOpen,
    setChatThreadLoading,
    setSelectedRoomId,
    setRooms,
    setMessages,
    setRoomName,
    setDiscoveryList,
    setAddingMemberId,
    setGroupInviteActionId,
    setRemovingMemberId,
    setLeaveGroupLoading,
    setIsRoomInfoOpen,
    setLeaveOwnerModalOpen,
    setLeaveTransferUserId,
    updateCurrentUser,
    loadRooms,
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
  });
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
  const friendsSafe = useAppSelector(selectFriendsSafe);
  const addableFriendsForGroup = useMemo(
    () => friendsSafe.filter((friend) => !groupMemberIdSet.has(friend._id)),
    [friendsSafe, groupMemberIdSet],
  );
  const visibleDiscoveryResults = useAppSelector((state) =>
    selectVisibleDiscoveryResults(state, discoveryList),
  );
  const sortedGroupRooms = useAppSelector(selectSortedGroupRooms);

  const unreadByFriendId = useAppSelector((state) => selectUnreadByFriendId(state, currentUserId));

  const myRoomRole = useAppSelector((state) => selectMyRoomRole(state, currentUserId));

  const canAddGroupMembers =
    selectedRoom?.type === "group" && myRoomRole != null && ["owner", "admin"].includes(myRoomRole);

  const isRoomOwner = myRoomRole === "owner";

  const roomPref = useAppSelector(selectRoomPref);
  const canPinMessagesInThread = useAppSelector((state) =>
    selectCanPinMessagesInThread(state, currentUserId),
  );

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
        onCreateRoom={() => void createRoomByName(roomName)}
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
    <Suspense fallback={<Spin />}>
      <ChatSettingsPanel
        uiPreset={uiPreset}
        onUiPresetChange={setUiPreset}
        theme={theme}
        onThemeChange={setTheme}
        desktopNotify={desktopNotify}
        onDesktopNotifyChange={async (checked) => {
          if (checked) {
            const p = await requestNotificationPermission();
            if (p !== "granted") {
              message.warning(vi.chat.notifyDenied);
              return;
            }
          }
          setDesktopNotify(checked);
        }}
        soundNotify={soundNotify}
        onSoundNotifyChange={setSoundNotify}
      />
    </Suspense>
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
          <ChatThreadHeader
            selectedRoom={selectedRoom ?? undefined}
            currentRoomName={currentRoomName}
            directCounterpart={directCounterpart}
            directHeaderPresence={directHeaderPresence}
            apiBaseUrl={API_BASE_URL}
            onOpenThreadSearch={() => {
              setThreadSearchOpen(true);
              setThreadSearchQuery("");
              setThreadSearchHits([]);
            }}
            onOpenRoomInfo={() => setIsRoomInfoOpen(true)}
          />

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
                selectedRoom={selectedRoom ?? undefined}
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

      <Suspense fallback={null}>
        <PersonalProfileModal
          open={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          user={user}
          apiBaseUrl={API_BASE_URL}
          uploadMaxMb={UPLOAD_MAX_MB}
          uploadMaxBytes={UPLOAD_MAX_BYTES}
          onUserUpdated={handleProfileUserUpdated}
        />
      </Suspense>

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
