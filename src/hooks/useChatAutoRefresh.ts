import { useEffect } from "react";

type AsyncCallback = () => Promise<unknown>;

type UseChatAutoRefreshOptions = {
  loadFriends: AsyncCallback;
  loadIncomingRequests: AsyncCallback;
  loadOutgoingRequests: AsyncCallback;
  loadPendingGroupInvites: AsyncCallback;
  loadRooms: AsyncCallback;
  isSocketConnected?: boolean;
};

export function shouldRunChatPolling(
  visibilityState: DocumentVisibilityState,
  isSocketConnected: boolean,
) {
  if (visibilityState !== "visible") return false;
  return !isSocketConnected;
}

export function useChatAutoRefresh({
  loadFriends,
  loadIncomingRequests,
  loadOutgoingRequests,
  loadPendingGroupInvites,
  loadRooms,
  isSocketConnected = false,
}: UseChatAutoRefreshOptions) {
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!shouldRunChatPolling(document.visibilityState, isSocketConnected)) {
        return;
      }
      loadFriends().catch(() => null);
      loadIncomingRequests().catch(() => null);
      loadOutgoingRequests().catch(() => null);
      loadPendingGroupInvites().catch(() => null);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [
    loadFriends,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadPendingGroupInvites,
    isSocketConnected,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      loadRooms().catch(() => null);
    }, 45_000);

    return () => window.clearInterval(interval);
  }, [loadRooms]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      loadRooms().catch(() => null);
      loadPendingGroupInvites().catch(() => null);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadRooms, loadPendingGroupInvites]);
}
