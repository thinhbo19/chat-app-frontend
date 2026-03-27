import { FiHash, FiUserMinus, FiUsers } from "react-icons/fi";
import { Avatar, Badge, Button, Divider, Input, List, Popconfirm, Space, Typography } from "antd";
import { AvatarWithStatus } from "../AvatarWithStatus";
import { vi } from "../../strings/vi";
import type { FriendUser, Room } from "../../types";
import { resolveMediaUrl } from "../../utils/mediaUrl";

const { Text } = Typography;

type ChatSidebarBodyProps = {
  roomName: string;
  onRoomNameChange: (value: string) => void;
  onCreateRoom: () => void;
  groupRoomsOnly: Room[];
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
  myUserId: string;
  getRoomDisplayName: (room: Room, uid: string) => string;
  friends: FriendUser[];
  onOpenDirectRoom: (friendUserId: string) => void;
  onRemoveFriend: (friendUserId: string) => void;
  unreadByRoomId: Record<string, number>;
  unreadByFriendId: Record<string, number>;
  apiBaseUrl: string;
};

export function ChatSidebarBody({
  roomName,
  onRoomNameChange,
  onCreateRoom,
  groupRoomsOnly,
  selectedRoomId,
  onSelectRoom,
  myUserId,
  getRoomDisplayName,
  friends,
  onOpenDirectRoom,
  onRemoveFriend,
  unreadByRoomId,
  unreadByFriendId,
  apiBaseUrl,
}: ChatSidebarBodyProps) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Text strong className="sidebar-section-title">
        <FiHash className="sidebar-section-icon" aria-hidden />
        {vi.sidebar.groupRoomsTitle}
      </Text>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder={vi.sidebar.newRoomPlaceholder}
          value={roomName}
          onChange={(event) => onRoomNameChange(event.target.value)}
          onPressEnter={onCreateRoom}
        />
        <Button type="primary" onClick={onCreateRoom}>
          {vi.sidebar.createBtn}
        </Button>
      </Space.Compact>

      <List
        size="small"
        bordered
        dataSource={groupRoomsOnly}
        locale={{ emptyText: vi.sidebar.noGroupRooms }}
        renderItem={(room) => {
          const n = unreadByRoomId[room._id] ?? 0;
          const title = getRoomDisplayName(room, myUserId);
          const initial = title.trim().charAt(0).toUpperCase() || "#";
          return (
            <List.Item
              className={room._id === selectedRoomId ? "room-item-active" : ""}
              onClick={() => onSelectRoom(room._id)}
              style={{ cursor: "pointer" }}
              extra={
                n > 0 ? (
                  <Badge count={n} size="small" overflowCount={99} className="sidebar-unread-badge" />
                ) : null
              }
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    size={44}
                    src={
                      room.avatar?.trim()
                        ? resolveMediaUrl(room.avatar.trim(), apiBaseUrl) || undefined
                        : undefined
                    }
                    className="chat-room-list-avatar"
                  >
                    {initial === "#" ? <FiHash /> : initial}
                  </Avatar>
                }
                title={<Text strong={room._id === selectedRoomId}>{title}</Text>}
              />
            </List.Item>
          );
        }}
      />

      <Divider style={{ margin: "8px 0" }} />
      <Text strong className="sidebar-section-title">
        <FiUsers className="sidebar-section-icon" aria-hidden />
        {vi.sidebar.friends(friends.length)}
      </Text>
      <List
        size="small"
        dataSource={friends}
        locale={{ emptyText: vi.sidebar.noFriends }}
        renderItem={(friend) => {
          const n = unreadByFriendId[friend._id] ?? 0;
          const online = friend.status === "online";
          const friendAvatarSrc = friend.avatar?.trim()
            ? resolveMediaUrl(friend.avatar.trim(), apiBaseUrl) || undefined
            : undefined;
          return (
            <List.Item
              onClick={() => onOpenDirectRoom(friend._id)}
              style={{ cursor: "pointer" }}
              extra={
                n > 0 ? (
                  <Badge count={n} size="small" overflowCount={99} className="sidebar-unread-badge" />
                ) : null
              }
              actions={[
                <Popconfirm
                  key="remove"
                  title={vi.sidebar.unfriendTitle}
                  description={vi.sidebar.unfriendDesc(friend.username)}
                  okText={vi.sidebar.delete}
                  cancelText={vi.sidebar.cancel}
                  onConfirm={() => onRemoveFriend(friend._id)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<FiUserMinus />}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <AvatarWithStatus src={friendAvatarSrc} online={online}>
                    {friend.username.charAt(0).toUpperCase()}
                  </AvatarWithStatus>
                }
                title={<span>{friend.username}</span>}
              />
            </List.Item>
          );
        }}
      />
    </Space>
  );
}
