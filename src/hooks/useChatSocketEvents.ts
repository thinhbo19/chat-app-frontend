import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { message, notification } from "antd";
import type { Socket } from "socket.io-client";
import { playMessageBeep } from "../utils/messageSound";
import { isValidFriendUser } from "../utils/friendUser";
import { isRoomMemberPopulated } from "../utils/roomMember";
import { vi } from "../strings/vi";
import type { AuthUser, ChatMessage, FriendUser, Room, RoomReadStateEntry } from "../types";

type UseChatSocketEventsOptions = {
  socket: Socket | null;
  selectedRoomIdRef: MutableRefObject<string>;
  userRef: MutableRefObject<AuthUser | null>;
  settingsRef: MutableRefObject<{ soundNotify: boolean; desktopNotify: boolean }>;
  userId?: string;
  loadRooms: () => Promise<unknown>;
  loadFriends: () => Promise<unknown>;
  loadIncomingRequests: () => Promise<unknown>;
  loadOutgoingRequests: () => Promise<unknown>;
  loadPendingGroupInvites: () => Promise<unknown>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setUnreadByRoomId: Dispatch<SetStateAction<Record<string, number>>>;
  setReadStates: Dispatch<SetStateAction<RoomReadStateEntry[]>>;
  setFriends: Dispatch<SetStateAction<FriendUser[]>>;
  setRooms: Dispatch<SetStateAction<Room[]>>;
  setSelectedRoomId: Dispatch<SetStateAction<string>>;
  setMessagesHasMore: Dispatch<SetStateAction<boolean>>;
};

const SOCKET_ERROR_TOAST_COOLDOWN_MS = 7000;

export function shouldShowSocketErrorToast(lastShownAt: number, now: number) {
  return now - lastShownAt >= SOCKET_ERROR_TOAST_COOLDOWN_MS;
}

export function useChatSocketEvents({
  socket,
  selectedRoomIdRef,
  userRef,
  settingsRef,
  userId,
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
}: UseChatSocketEventsOptions) {
  useEffect(() => {
    if (!socket) return;
    let lastSocketErrorToastAt = 0;

    const handleConnect = () => {
      void loadRooms();
      void loadPendingGroupInvites();
    };
    const handleConnectError = (error: Error) => {
      const now = Date.now();
      if (shouldShowSocketErrorToast(lastSocketErrorToastAt, now)) {
        lastSocketErrorToastAt = now;
        message.error(vi.errors.socket(error.message));
      }
    };

    function previewIncoming(incomingMessage: ChatMessage) {
      if (incomingMessage.deleted) return vi.preview.recalled;
      if (incomingMessage.contentType === "image") return vi.preview.image;
      if (incomingMessage.contentType === "video") return vi.preview.video;
      if (incomingMessage.contentType === "audio") return vi.preview.audio;
      return (incomingMessage.text || "").slice(0, 120) || vi.preview.message;
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
      const myId = userId ? String(userId) : "";
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
          .map((friend) => {
            if (friend._id !== payload.userId) return friend;
            const next: FriendUser = { ...friend, status: payload.status };
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
            const nextUser = { ...mem.userId, status: payload.status };
            if (payload.lastSeenAt) {
              nextUser.lastSeenAt = payload.lastSeenAt;
            }
            return { ...mem, userId: nextUser };
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
    selectedRoomIdRef,
    settingsRef,
    setFriends,
    setMessages,
    setMessagesHasMore,
    setReadStates,
    setRooms,
    setSelectedRoomId,
    setUnreadByRoomId,
    userId,
    userRef,
  ]);
}
