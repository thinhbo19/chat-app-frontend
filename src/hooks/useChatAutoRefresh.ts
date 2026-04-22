import { useEffect } from "react";

type AsyncCallback = () => Promise<unknown>;

type UseChatAutoRefreshOptions = {
  loadFriends: AsyncCallback;
  loadIncomingRequests: AsyncCallback;
  loadOutgoingRequests: AsyncCallback;
  loadPendingGroupInvites: AsyncCallback;
  loadRooms: AsyncCallback;
};

export function useChatAutoRefresh({
  loadFriends,
  loadIncomingRequests,
  loadOutgoingRequests,
  loadPendingGroupInvites,
  loadRooms,
}: UseChatAutoRefreshOptions) {
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
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      loadRooms().catch(() => null);
      loadPendingGroupInvites().catch(() => null);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadRooms, loadPendingGroupInvites]);
}
