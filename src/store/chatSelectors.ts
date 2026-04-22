import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { isRoomMemberPopulated } from "../utils/roomMember";
import { isValidFriendUser } from "../utils/friendUser";
import type { FriendUser } from "../types";

export const selectChatState = (state: RootState) => state.chat;
export const selectRooms = (state: RootState) => state.chat.rooms;
export const selectSelectedRoomId = (state: RootState) => state.chat.selectedRoomId;
export const selectUnreadByRoomId = (state: RootState) => state.chat.unreadByRoomId;
export const selectCurrentUserId = (_state: RootState, currentUserId: string) => currentUserId;
export const selectDiscoveryList = (_state: RootState, discoveryList: FriendUser[]) => discoveryList;
export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectOutgoingRequests = (state: RootState) => state.chat.outgoingRequests;
export const selectFriends = (state: RootState) => state.chat.friends;

export const selectSelectedRoom = createSelector(
  [selectRooms, selectSelectedRoomId],
  (rooms, selectedRoomId) => rooms.find((room) => room._id === selectedRoomId) || null,
);

export const selectUnreadByFriendId = createSelector(
  [selectRooms, selectUnreadByRoomId, selectCurrentUserId],
  (rooms, unreadByRoomId, currentUserId) => {
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
  },
);

export const selectSortedGroupRooms = createSelector(
  [selectRooms, selectAuthUser],
  (rooms, user) => {
    const pinIds = new Set((user?.chatRoomPrefs || []).filter((p) => p.sidebarPinned).map((p) => p.roomId));
    const list = rooms.filter((room) => room.type === "group");
    return [...list].sort((a, b) => {
      const ap = pinIds.has(a._id) ? 1 : 0;
      const bp = pinIds.has(b._id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },
);

export const selectFriendsSafe = createSelector([selectFriends], (friends) =>
  friends.filter(isValidFriendUser),
);

export const selectVisibleDiscoveryResults = createSelector(
  [selectDiscoveryList, selectFriendsSafe, selectOutgoingRequests],
  (discoveryList, friendsSafe, outgoingRequests) => {
    const friendIdSet = new Set(friendsSafe.map((item) => item._id));
    const outgoingIdSet = new Set(
      outgoingRequests
        .map((item) => item.toUserId?._id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    return discoveryList.filter((item) => !friendIdSet.has(item._id) && !outgoingIdSet.has(item._id));
  },
);

export const selectMyRoomRole = createSelector(
  [selectSelectedRoom, selectCurrentUserId],
  (selectedRoom, currentUserId) => {
    if (!selectedRoom) return null;
    const me = selectedRoom.members.find(
      (m) => isRoomMemberPopulated(m) && m.userId._id === currentUserId,
    );
    return me?.role ?? null;
  },
);

export const selectRoomPref = createSelector(
  [selectSelectedRoomId, selectAuthUser],
  (selectedRoomId, user) => {
    if (!selectedRoomId || !user?.chatRoomPrefs) return null;
    return user.chatRoomPrefs.find((p) => p.roomId === selectedRoomId) ?? null;
  },
);

export const selectCanPinMessagesInThread = createSelector(
  [selectSelectedRoom, selectMyRoomRole],
  (selectedRoom, myRoomRole) => {
    if (!selectedRoom) return false;
    if (selectedRoom.type === "direct") return true;
    return myRoomRole != null && ["owner", "admin"].includes(myRoomRole);
  },
);
