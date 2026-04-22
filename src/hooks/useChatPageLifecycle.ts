import { message } from "antd";
import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Socket } from "socket.io-client";
import { api } from "../services/api";
import { fetchRoomThread } from "../store/chatThunks";
import { vi } from "../strings/vi";
import type { AppDispatch } from "../store/store";
import type { ChatComposeRowHandle } from "../components/chat/ChatComposeRow";
import type { ChatMessage, RoomReadStateEntry } from "../types";

type SetState<T> = (value: T | ((prev: T) => T)) => void;
type PendingImage = { file: File; previewUrl: string } | null;

type UseChatPageLifecycleArgs = {
  dispatch: AppDispatch;
  socket: Socket | null;
  socketRef: MutableRefObject<Socket | null>;
  selectedRoomId: string;
  messages: ChatMessage[];
  composeRef: MutableRefObject<ChatComposeRowHandle | null>;
  markReadTimerRef: MutableRefObject<ReturnType<typeof window.setTimeout> | null>;
  endOfMessagesRef: MutableRefObject<HTMLDivElement | null>;
  setMessages: SetState<ChatMessage[]>;
  setReadStates: SetState<RoomReadStateEntry[]>;
  setMessagesHasMore: SetState<boolean>;
  setChatThreadLoading: SetState<boolean>;
  setUnreadByRoomId: SetState<Record<string, number>>;
  setPendingImage: SetState<PendingImage>;
  loadRooms: () => Promise<void>;
  loadFriends: () => Promise<void>;
  loadIncomingRequests: () => Promise<void>;
  loadOutgoingRequests: () => Promise<void>;
  loadPendingGroupInvites: () => Promise<void>;
};

export function useChatPageLifecycle({
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
}: UseChatPageLifecycleArgs) {
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
        const thread = await dispatch(fetchRoomThread({ roomId: selectedRoomId, limit: 50 })).unwrap();
        if (cancelled) return;
        setMessages(thread.messages);
        setMessagesHasMore(thread.hasMore);
        setReadStates(thread.states);
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
  }, [
    dispatch,
    selectedRoomId,
    setChatThreadLoading,
    setMessages,
    setMessagesHasMore,
    setReadStates,
    setUnreadByRoomId,
    socket,
  ]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [endOfMessagesRef, lastMessageId]);

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
  }, [markReadTimerRef, messages, selectedRoomId, socketRef]);

  useEffect(() => {
    composeRef.current?.clear();
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [composeRef, selectedRoomId, setPendingImage]);
}
