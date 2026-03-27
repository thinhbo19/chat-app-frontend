import { Avatar, Modal, Space, Typography } from "antd";
import { vi } from "../../strings/vi";
import type { FriendUser } from "../../types";
import { formatChatHeaderPresence } from "../../utils/formatPresence";
import { resolveMediaUrl } from "../../utils/mediaUrl";

const { Text } = Typography;

type FriendInfoModalProps = {
  open: boolean;
  onClose: () => void;
  friend: FriendUser | null;
  apiBaseUrl: string;
};

export function FriendInfoModal({ open, onClose, friend, apiBaseUrl }: FriendInfoModalProps) {
  if (!friend) return null;

  const avatarSrc = friend.avatar?.trim()
    ? resolveMediaUrl(friend.avatar.trim(), apiBaseUrl) || undefined
    : undefined;
  const presence = formatChatHeaderPresence(friend.status, friend.lastSeenAt);
  const phone = friend.phone?.trim();

  return (
    <Modal
      title={vi.sidebar.friendInfoTitle}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(100vw - 24px, 400px)"
      centered
      destroyOnClose
    >
      <Space align="start" size={16} style={{ width: "100%" }}>
        <Avatar size={72} src={avatarSrc} className="chat-room-list-avatar">
          {friend.username.charAt(0).toUpperCase()}
        </Avatar>
        <Space direction="vertical" size={10} style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 18, display: "block" }}>
            {friend.username}
          </Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {vi.profile.email}
            </Text>
            <br />
            <Text>{friend.email || "—"}</Text>
          </div>
          {phone ? (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {vi.profile.phone}
              </Text>
              <br />
              <Text>{phone}</Text>
            </div>
          ) : null}
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {vi.sidebar.friendInfoPresence}
            </Text>
            <br />
            <Text>{presence}</Text>
          </div>
        </Space>
      </Space>
    </Modal>
  );
}
