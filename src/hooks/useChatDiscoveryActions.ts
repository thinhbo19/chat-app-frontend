import { message } from "antd";
import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { api } from "../services/api";
import { vi } from "../strings/vi";
import type { FriendUser } from "../types";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type UseChatDiscoveryActionsArgs = {
  browsePageSize: number;
  searchText: string;
  setDiscoveryMode: SetState<"browse" | "search">;
  setBrowseNextCursor: SetState<string | null>;
  browseNextCursorRef: MutableRefObject<string | null>;
  discoveryModeRef: MutableRefObject<"browse" | "search">;
  browseMoreLockRef: MutableRefObject<boolean>;
  setBrowseLoading: (value: boolean) => void;
  setBrowseLoadingMore: (value: boolean) => void;
  setDiscoveryList: SetState<FriendUser[]>;
};

export function useChatDiscoveryActions({
  browsePageSize,
  searchText,
  setDiscoveryMode,
  setBrowseNextCursor,
  browseNextCursorRef,
  discoveryModeRef,
  browseMoreLockRef,
  setBrowseLoading,
  setBrowseLoadingMore,
  setDiscoveryList,
}: UseChatDiscoveryActionsArgs) {
  const fetchBrowse = useCallback(
    async (after?: string | null) => {
      const params: Record<string, string | number> = { limit: browsePageSize };
      if (after) params.after = after;
      const { data } = await api.get<{ users: FriendUser[]; nextCursor: string | null }>(
        "/api/users/browse",
        { params },
      );
      return data;
    },
    [browsePageSize],
  );

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
  }, [
    browseNextCursorRef,
    fetchBrowse,
    setBrowseLoading,
    setBrowseNextCursor,
    setDiscoveryList,
    setDiscoveryMode,
  ]);

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
  }, [
    browseMoreLockRef,
    browseNextCursorRef,
    discoveryModeRef,
    fetchBrowse,
    setBrowseLoadingMore,
    setBrowseNextCursor,
    setDiscoveryList,
  ]);

  const searchUsers = useCallback(async () => {
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
      const response = await api.get<{ users: FriendUser[] }>("/api/users/search", {
        params: { q },
      });
      setDiscoveryList(response.data.users);
    } catch {
      message.error(vi.errors.userNotFound);
      setDiscoveryList([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [
    browseNextCursorRef,
    loadBrowseFirstPage,
    searchText,
    setBrowseLoading,
    setBrowseNextCursor,
    setDiscoveryList,
    setDiscoveryMode,
  ]);

  return {
    loadBrowseFirstPage,
    loadBrowseMore,
    searchUsers,
  };
}
