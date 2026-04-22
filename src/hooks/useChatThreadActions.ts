import { message } from "antd";
import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import { searchRoomThreadMessages, fetchOlderRoomMessages } from "../store/chatThunks";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";
import type { AppDispatch } from "../store/store";
import type { ChatMessage } from "../types";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type UseChatThreadActionsArgs = {
  dispatch: AppDispatch;
  selectedRoomId: string;
  messages: ChatMessage[];
  messagesHasMore: boolean;
  loadingOlder: boolean;
  messagesScrollRef: MutableRefObject<HTMLDivElement | null>;
  pendingScrollMessageId: string | null;
  setPendingScrollMessageId: (value: string | null) => void;
  setHighlightMessageId: (value: string | null) => void;
  setThreadSearchOpen: SetState<boolean>;
  threadSearchQuery: string;
  setThreadSearchHits: SetState<ChatMessage[]>;
  setThreadSearchLoading: SetState<boolean>;
  setMessages: SetState<ChatMessage[]>;
  setMessagesHasMore: SetState<boolean>;
  setLoadingOlder: (value: boolean) => void;
};

export function useChatThreadActions({
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
}: UseChatThreadActionsArgs) {
  const loadOlderMessages = useCallback(
    async (beforeId: string) => {
      if (!selectedRoomId || !messagesHasMore || loadingOlder) return;
      const wrap = messagesScrollRef.current;
      const prevScrollHeight = wrap?.scrollHeight ?? 0;
      setLoadingOlder(true);
      try {
        const r = await dispatch(
          fetchOlderRoomMessages({ roomId: selectedRoomId, beforeId, limit: 50 }),
        ).unwrap();
        const older = r.messages;
        setMessages((current) => {
          const ids = new Set(current.map((x) => x.id));
          const prep = older.filter((x) => !ids.has(x.id));
          return [...prep, ...current];
        });
        setMessagesHasMore(r.hasMore);
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
    [
      dispatch,
      loadingOlder,
      messagesHasMore,
      messagesScrollRef,
      selectedRoomId,
      setLoadingOlder,
      setMessages,
      setMessagesHasMore,
    ],
  );

  const runThreadSearch = useCallback(async () => {
    const q = threadSearchQuery.trim();
    if (!selectedRoomId || !q) {
      setThreadSearchHits([]);
      return;
    }
    setThreadSearchLoading(true);
    try {
      const data = await dispatch(
        searchRoomThreadMessages({ roomId: selectedRoomId, query: q, limit: 40 }),
      ).unwrap();
      setThreadSearchHits(data.messages);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.searchThreadFail));
      setThreadSearchHits([]);
    } finally {
      setThreadSearchLoading(false);
    }
  }, [
    dispatch,
    selectedRoomId,
    setThreadSearchHits,
    setThreadSearchLoading,
    threadSearchQuery,
  ]);

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
    loadOlderMessages,
    loadingOlder,
    messages,
    messagesHasMore,
    pendingScrollMessageId,
    selectedRoomId,
    setHighlightMessageId,
    setPendingScrollMessageId,
    setThreadSearchOpen,
  ]);

  return {
    loadOlderMessages,
    runThreadSearch,
  };
}
