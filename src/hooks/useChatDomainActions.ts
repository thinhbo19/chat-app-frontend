import { message } from "antd";
import { useCallback } from "react";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";
import {
  acceptGroupInviteThunk,
  addMemberToGroupThunk,
  createGroupRoom,
  declineGroupInviteThunk,
  handleFriendRequestThunk,
  leaveGroupRoomThunk,
  openDirectRoomThunk,
  patchMemberRoleThunk,
  patchRoomPreferences,
  pinRoomMessage,
  recallRoomMessage,
  removeFriendThunk,
  removeGroupMemberThunk,
  sendFriendRequestThunk,
  toggleRoomMessageReaction,
  unpinRoomMessage,
} from "../store/chatThunks";
import type { AppDispatch } from "../store/store";
import type { AuthUser, ChatMessage, FriendUser, Room } from "../types";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type UseChatDomainActionsArgs = {
  dispatch: AppDispatch;
  selectedRoomId: string;
  selectedRoom: Room | null;
  isNarrowLayout: boolean;
  setMobileLeftOpen: (open: boolean) => void;
  setChatThreadLoading: SetState<boolean>;
  setSelectedRoomId: SetState<string>;
  setRooms: SetState<Room[]>;
  setMessages: SetState<ChatMessage[]>;
  setRoomName: (value: string) => void;
  setDiscoveryList: SetState<FriendUser[]>;
  setAddingMemberId: (value: string) => void;
  setGroupInviteActionId: (value: string) => void;
  setRemovingMemberId: (value: string) => void;
  setLeaveGroupLoading: (value: boolean) => void;
  setIsRoomInfoOpen: (open: boolean) => void;
  setLeaveOwnerModalOpen: (open: boolean) => void;
  setLeaveTransferUserId: (value: string) => void;
  updateCurrentUser: (user: AuthUser) => void;
  loadRooms: () => Promise<void>;
  loadFriends: () => Promise<void>;
  loadIncomingRequests: () => Promise<void>;
  loadOutgoingRequests: () => Promise<void>;
  loadPendingGroupInvites: () => Promise<void>;
};

export function useChatDomainActions({
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
}: UseChatDomainActionsArgs) {
  const recallMessage = useCallback(
    async (messageId: string) => {
      if (!selectedRoomId) return;
      try {
        await dispatch(recallRoomMessage({ roomId: selectedRoomId, messageId })).unwrap();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.recall));
      }
    },
    [dispatch, selectedRoomId],
  );

  const toggleMessageReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!selectedRoomId) return;
      try {
        const data = await dispatch(
          toggleRoomMessageReaction({ roomId: selectedRoomId, messageId, emoji }),
        ).unwrap();
        if (data?.message) {
          setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.reactionFail));
      }
    },
    [dispatch, selectedRoomId, setMessages],
  );

  const pinThreadMessage = useCallback(
    async (messageId: string) => {
      if (!selectedRoomId) return;
      try {
        const data = await dispatch(pinRoomMessage({ roomId: selectedRoomId, messageId })).unwrap();
        message.success(vi.chat.pinOk);
        if (data?.room?._id) {
          const updatedRoom = data.room as Room;
          setRooms((prev) => prev.map((r) => (r._id === selectedRoomId ? updatedRoom : r)));
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.pinMessageFail));
      }
    },
    [dispatch, selectedRoomId, setRooms],
  );

  const unpinThreadMessage = useCallback(
    async (messageId: string) => {
      if (!selectedRoomId) return;
      try {
        const data = await dispatch(unpinRoomMessage({ roomId: selectedRoomId, messageId })).unwrap();
        message.success(vi.chat.unpinOk);
        if (data?.room?._id) {
          const updatedRoom = data.room as Room;
          setRooms((prev) => prev.map((r) => (r._id === selectedRoomId ? updatedRoom : r)));
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.unpinMessageFail));
      }
    },
    [dispatch, selectedRoomId, setRooms],
  );

  const patchRoomPrefs = useCallback(
    async (partial: { muted?: boolean; sidebarPinned?: boolean }) => {
      if (!selectedRoom?._id) return;
      try {
        const data = await dispatch(
          patchRoomPreferences({ roomId: selectedRoom._id, ...partial }),
        ).unwrap();
        updateCurrentUser(data.user);
        if (partial.muted !== undefined) {
          message.success(vi.chat.muteOk);
        } else if (partial.sidebarPinned !== undefined) {
          message.success(vi.chat.pinRoomTopOk);
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.roomPrefsFail));
      }
    },
    [dispatch, selectedRoom, updateCurrentUser],
  );

  const createRoomByName = useCallback(
    async (roomName: string) => {
      const trimmed = roomName.trim();
      if (!trimmed) return;
      try {
        await dispatch(createGroupRoom({ name: trimmed })).unwrap();
        setRoomName("");
        await loadRooms();
        message.success(vi.errors.createRoomOk);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.createRoomFail));
      }
    },
    [dispatch, loadRooms, setRoomName],
  );

  const sendFriendRequest = useCallback(
    async (toUserId: string) => {
      try {
        await dispatch(sendFriendRequestThunk({ toUserId })).unwrap();
        message.success(vi.errors.inviteSent);
        setDiscoveryList((prev) => prev.filter((item) => item._id !== toUserId));
        await loadIncomingRequests();
        await loadFriends();
        await loadOutgoingRequests();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.inviteFail));
      }
    },
    [dispatch, loadFriends, loadIncomingRequests, loadOutgoingRequests, setDiscoveryList],
  );

  const handleRequest = useCallback(
    async (requestId: string, action: "accept" | "reject") => {
      try {
        await dispatch(handleFriendRequestThunk({ requestId, action })).unwrap();
        message.success(action === "accept" ? vi.errors.accepted : vi.errors.rejected);
        await loadIncomingRequests();
        await loadFriends();
      } catch {
        message.error(vi.errors.requestUpdateFail);
      }
    },
    [dispatch, loadFriends, loadIncomingRequests],
  );

  const removeFriend = useCallback(
    async (friendUserId: string) => {
      try {
        await dispatch(removeFriendThunk({ friendUserId })).unwrap();
        message.success(vi.errors.unfriendOk);
        await loadFriends();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.unfriendFail));
      }
    },
    [dispatch, loadFriends],
  );

  const openDirectRoom = useCallback(
    async (friendUserId: string) => {
      setChatThreadLoading(true);
      try {
        const response = await dispatch(openDirectRoomThunk({ friendUserId })).unwrap();
        const room = response.room;
        await loadRooms();
        setSelectedRoomId(room._id);
        if (isNarrowLayout) {
          setMobileLeftOpen(false);
        }
      } catch (error: unknown) {
        setChatThreadLoading(false);
        message.error(getApiErrorMessage(error, vi.errors.openDirectFail));
      }
    },
    [dispatch, isNarrowLayout, loadRooms, setChatThreadLoading, setMobileLeftOpen, setSelectedRoomId],
  );

  const patchMemberRole = useCallback(
    async (memberUserId: string, role: "admin" | "member") => {
      if (!selectedRoom?._id) return;
      try {
        await dispatch(
          patchMemberRoleThunk({ roomId: selectedRoom._id, memberUserId, role }),
        ).unwrap();
        await loadRooms();
        message.success(vi.chat.roleUpdated);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.roleUpdateFail));
      }
    },
    [dispatch, loadRooms, selectedRoom],
  );

  const addMemberToGroup = useCallback(
    async (memberUserId: string) => {
      if (!selectedRoom || selectedRoom.type !== "group") {
        return;
      }
      try {
        setAddingMemberId(memberUserId);
        await dispatch(addMemberToGroupThunk({ roomId: selectedRoom._id, memberUserId })).unwrap();
        message.success(vi.errors.groupInviteSent);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.memberAddFail));
      } finally {
        setAddingMemberId("");
      }
    },
    [dispatch, selectedRoom, setAddingMemberId],
  );

  const acceptGroupInviteAction = useCallback(
    async (inviteId: string) => {
      try {
        setGroupInviteActionId(inviteId);
        await dispatch(acceptGroupInviteThunk({ inviteId })).unwrap();
        message.success(vi.errors.groupInviteAcceptOk);
        await loadPendingGroupInvites();
        await loadRooms();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.groupInviteAcceptFail));
      } finally {
        setGroupInviteActionId("");
      }
    },
    [dispatch, loadPendingGroupInvites, loadRooms, setGroupInviteActionId],
  );

  const declineGroupInviteAction = useCallback(
    async (inviteId: string) => {
      try {
        setGroupInviteActionId(inviteId);
        await dispatch(declineGroupInviteThunk({ inviteId })).unwrap();
        message.success(vi.errors.groupInviteDeclineOk);
        await loadPendingGroupInvites();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.groupInviteDeclineFail));
      } finally {
        setGroupInviteActionId("");
      }
    },
    [dispatch, loadPendingGroupInvites, setGroupInviteActionId],
  );

  const removeGroupMember = useCallback(
    async (memberUserId: string) => {
      if (!selectedRoom || selectedRoom.type !== "group") return;
      try {
        setRemovingMemberId(memberUserId);
        await dispatch(removeGroupMemberThunk({ roomId: selectedRoom._id, memberUserId })).unwrap();
        message.success(vi.chat.memberRemovedOk);
        await loadRooms();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.memberRemoveFail));
      } finally {
        setRemovingMemberId("");
      }
    },
    [dispatch, loadRooms, selectedRoom, setRemovingMemberId],
  );

  const leaveGroupRoom = useCallback(
    async (newOwnerUserId?: string) => {
      if (!selectedRoom || selectedRoom.type !== "group") return;
      const roomId = selectedRoom._id;
      try {
        setLeaveGroupLoading(true);
        await dispatch(leaveGroupRoomThunk({ roomId, newOwnerUserId })).unwrap();
        message.success(vi.chat.leaveGroupOk);
        await loadRooms();
        setSelectedRoomId((cur) => (cur === roomId ? "" : cur));
        setIsRoomInfoOpen(false);
        setLeaveOwnerModalOpen(false);
        setLeaveTransferUserId("");
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.leaveGroupFail));
        throw error;
      } finally {
        setLeaveGroupLoading(false);
      }
    },
    [
      dispatch,
      loadRooms,
      selectedRoom,
      setIsRoomInfoOpen,
      setLeaveGroupLoading,
      setLeaveOwnerModalOpen,
      setLeaveTransferUserId,
      setSelectedRoomId,
    ],
  );

  return {
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
  };
}
