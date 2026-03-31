import { Avatar, Button, Flex, Space, Typography } from "antd";
import { FiCamera, FiHash, FiInfo, FiPhone, FiSearch } from "react-icons/fi";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import type { FriendUser, Room } from "../../types";

const { Title, Text } = Typography;

type ChatThreadHeaderProps = {
  selectedRoom?: Room;
  currentRoomName: string;
  directCounterpart: FriendUser | null;
  directHeaderPresence: string;
  apiBaseUrl: string;
  onOpenThreadSearch: () => void;
  onOpenRoomInfo: () => void;
};

export function ChatThreadHeader({
  selectedRoom,
  currentRoomName,
  directCounterpart,
  directHeaderPresence,
  apiBaseUrl,
  onOpenThreadSearch,
  onOpenRoomInfo,
}: ChatThreadHeaderProps) {
  return (
    <Flex justify="space-between" align="center" gap={8} wrap="wrap" flex="none">
      <Flex align="center" gap={10} style={{ flex: "1 1 160px", minWidth: 0 }}>
        {selectedRoom?.type === "group" ? (
          <Avatar
            size={40}
            src={
              selectedRoom.avatar?.trim()
                ? resolveMediaUrl(selectedRoom.avatar.trim(), apiBaseUrl)
                : undefined
            }
            className="chat-main-header-room-avatar"
          >
            {(() => {
              const ch = currentRoomName.trim().charAt(0).toUpperCase() || "#";
              return ch === "#" ? <FiHash /> : ch;
            })()}
          </Avatar>
        ) : selectedRoom?.type === "direct" && directCounterpart ? (
          <Avatar
            size={40}
            src={
              directCounterpart.avatar?.trim()
                ? resolveMediaUrl(directCounterpart.avatar.trim(), apiBaseUrl)
                : undefined
            }
            className="chat-main-header-room-avatar"
          >
            {directCounterpart.username.charAt(0).toUpperCase()}
          </Avatar>
        ) : null}
        <Flex vertical gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Title level={4} style={{ margin: 0 }} ellipsis>
            {currentRoomName}
          </Title>
          {selectedRoom?.type === "direct" && directCounterpart ? (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {directHeaderPresence}
            </Text>
          ) : null}
        </Flex>
      </Flex>
      <Space size={8} wrap className="chat-header-actions">
        <Button
          className="chat-header-icon-btn"
          shape="circle"
          icon={<FiSearch />}
          aria-label="Tìm trong phòng"
          disabled={!selectedRoom?._id}
          onClick={onOpenThreadSearch}
        />
        <Button className="chat-header-icon-btn" shape="circle" icon={<FiPhone />} />
        <Button className="chat-header-icon-btn" shape="circle" icon={<FiCamera />} />
        <Button
          className="chat-header-icon-btn"
          shape="circle"
          icon={<FiInfo />}
          onClick={onOpenRoomInfo}
          disabled={!selectedRoom}
        />
      </Space>
    </Flex>
  );
}
