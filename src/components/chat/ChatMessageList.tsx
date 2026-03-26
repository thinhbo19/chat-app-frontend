import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import { Avatar, Dropdown, Image, Spin, Typography } from "antd";
import type { MenuProps } from "antd";
import { ChatAudioMessage } from "../ChatAudioMessage";
import type { ChatMessage, Room, RoomReadStateEntry } from "../../types";

const { Text } = Typography;

function formatTime(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveMediaUrl(mediaUrl: string, apiBase: string) {
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    return mediaUrl;
  }
  return `${apiBase}${mediaUrl}`;
}

function readReceiptHint(
  msg: ChatMessage,
  isMine: boolean,
  room: Room | undefined,
  myUserId: string,
  readStates: RoomReadStateEntry[],
): string | null {
  if (!isMine || msg.deleted || !room) return null;
  const others = room.members.filter((m) => m.userId._id !== myUserId);
  if (others.length === 0) return null;
  let readCount = 0;
  for (const m of others) {
    const st = readStates.find((s) => s.userId === m.userId._id);
    const lr = st?.lastReadMessageId;
    if (lr && lr >= msg.id) readCount += 1;
  }
  if (readCount === 0) return null;
  if (room.type === "direct") return "Đã xem";
  if (readCount === others.length) return `Đã xem (${readCount})`;
  return `Đã xem ${readCount}/${others.length}`;
}

type ChatMessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
  selectedRoom: Room | undefined;
  apiBaseUrl: string;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: (beforeMessageId: string) => void;
  onRecall: (messageId: string) => void;
  readStates: RoomReadStateEntry[];
  listEndRef: RefObject<HTMLDivElement | null>;
  listScrollRef?: RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({
  messages,
  currentUserId,
  selectedRoom,
  apiBaseUrl,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRecall,
  readStates,
  listEndRef,
  listScrollRef,
}: ChatMessageListProps) {
  const localScrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = listScrollRef ?? localScrollRef;
  const loadLockRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !hasMore || loadingOlder || loadLockRef.current) return;
    if (el.scrollTop < 72 && messages[0]) {
      loadLockRef.current = true;
      onLoadOlder(messages[0].id);
    }
  }, [hasMore, loadingOlder, onLoadOlder, messages]);

  useEffect(() => {
    if (!loadingOlder) {
      loadLockRef.current = false;
    }
  }, [loadingOlder]);

  const recallItems = (messageId: string): MenuProps["items"] => [
    {
      key: "recall",
      label: "Thu hồi tin nhắn",
      danger: true,
      onClick: () => onRecall(messageId),
    },
  ];

  return (
    <div className="message-list-wrapper" ref={wrapRef} onScroll={handleScroll}>
      {loadingOlder ? (
        <div className="message-load-older">
          <Spin size="small" />
        </div>
      ) : null}
      {messages.length === 0 ? (
        <div className="empty-messages">
          <Text type="secondary">Chua co tin nhan nao</Text>
        </div>
      ) : (
        messages.map((msg) => {
          const isMine = msg.sender.id === currentUserId;
          const contentType = msg.contentType || "text";
          const mediaSrc = resolveMediaUrl(msg.mediaUrl || "", apiBaseUrl);
          const receipt = readReceiptHint(msg, isMine, selectedRoom, currentUserId, readStates);
          const canRecall = isMine && !msg.deleted;

          if (contentType === "text") {
            const bubble = (
              <div className={`message-bubble ${isMine ? "mine" : "other"}`}>
                <div className="message-meta">
                  <Text type="secondary">{formatTime(msg.createdAt)}</Text>
                </div>
                <Text className="message-text">{msg.text}</Text>
                {receipt ? (
                  <Text type="secondary" className="message-read-hint">
                    {receipt}
                  </Text>
                ) : null}
              </div>
            );

            return (
              <div
                key={msg.id}
                className={`message-row ${isMine ? "mine" : "other"} message-enter`}
              >
                {!isMine && (
                  <Avatar className="message-avatar">
                    {msg.sender.username.charAt(0).toUpperCase()}
                  </Avatar>
                )}
                {canRecall ? (
                  <Dropdown menu={{ items: recallItems(msg.id) }} trigger={["contextMenu"]}>
                    <div style={{ maxWidth: "100%" }}>{bubble}</div>
                  </Dropdown>
                ) : (
                  bubble
                )}
              </div>
            );
          }

          const bare = (
            <div className="message-bare-block">
              {contentType === "image" && mediaSrc ? (
                <Image
                  src={mediaSrc}
                  alt=""
                  className="message-bare-img"
                  preview={{ mask: "Phong to" }}
                />
              ) : null}
              {contentType === "video" && mediaSrc ? (
                <video className="message-bare-video" controls src={mediaSrc} />
              ) : null}
              {contentType === "audio" && mediaSrc ? (
                <ChatAudioMessage src={mediaSrc} isMine={isMine} />
              ) : null}
              {msg.text ? (
                <Text className="message-bare-caption" type="secondary">
                  {msg.text}
                </Text>
              ) : null}
              <div className="message-bare-meta">
                <Text type="secondary">{formatTime(msg.createdAt)}</Text>
                {receipt ? (
                  <Text type="secondary" className="message-read-hint message-read-hint-inline">
                    {receipt}
                  </Text>
                ) : null}
              </div>
            </div>
          );

          return (
            <div
              key={msg.id}
              className={`message-row ${isMine ? "mine" : "other"} message-enter`}
            >
              {!isMine && (
                <Avatar className="message-avatar">
                  {msg.sender.username.charAt(0).toUpperCase()}
                </Avatar>
              )}
              {canRecall ? (
                <Dropdown menu={{ items: recallItems(msg.id) }} trigger={["contextMenu"]}>
                  <div style={{ maxWidth: "100%" }}>{bare}</div>
                </Dropdown>
              ) : (
                bare
              )}
            </div>
          );
        })
      )}
      <div ref={listEndRef} />
    </div>
  );
}
