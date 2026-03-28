import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Dropdown, Image, Modal, Popover, Spin, Tabs, Typography } from "antd";
import type { TabsProps } from "antd";
import type { MenuProps } from "antd";
import { FiSmile } from "react-icons/fi";
import { ChatAudioMessage } from "../ChatAudioMessage";
import { vi } from "../../strings/vi";
import type { ChatMessage, MessageReaction, Room, RoomReadStateEntry } from "../../types";
import { hasReadThrough } from "../../utils/objectIdCompare";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { isRoomMemberPopulated, type RoomMemberPopulated } from "../../utils/roomMember";

const { Text } = Typography;

/** Chỉ vài emoji cơ bản để thả — không mở bảng emoji đầy đủ. */
const BASIC_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮"];

function formatTime(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function aggregateReactions(
  reactions: MessageReaction[] | undefined,
  myUserId: string,
): Map<string, { count: number; usernames: string[]; mine: boolean }> {
  const map = new Map<string, { count: number; usernames: string[]; mine: boolean }>();
  for (const r of reactions || []) {
    const e = (r.emoji || "").trim();
    if (!e) continue;
    const cur = map.get(e) ?? { count: 0, usernames: [] as string[], mine: false };
    cur.count += 1;
    cur.usernames.push(r.username || "?");
    if (r.userId === myUserId) cur.mine = true;
    map.set(e, cur);
  }
  return map;
}

/** Emoji có nhiều lượt nhất (hòa → ưu tiên thứ tự trong BASIC_REACTION_EMOJIS). */
function summarizeReactions(reactions: MessageReaction[] | undefined, myUserId: string) {
  const agg = aggregateReactions(reactions, myUserId);
  if (agg.size === 0) return null;
  const order = new Map(BASIC_REACTION_EMOJIS.map((e, i) => [e, i]));
  const entries = [...agg.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999);
  });
  const total = [...agg.values()].reduce((s, v) => s + v.count, 0);
  const topEmoji = entries[0][0];
  const topHasMine = entries[0][1].mine;
  return { total, topEmoji, topHasMine, entries };
}

function readReceiptHint(
  msg: ChatMessage,
  isMine: boolean,
  room: Room | undefined,
  myUserId: string,
  readStates: RoomReadStateEntry[],
): string | null {
  if (!isMine || msg.deleted || !room) return null;
  const others = room.members.filter(
    (m): m is RoomMemberPopulated =>
      isRoomMemberPopulated(m) && m.userId._id !== myUserId,
  );
  if (others.length === 0) return null;
  let readCount = 0;
  for (const m of others) {
    const st = readStates.find((s) => s.userId === m.userId._id);
    const lr = st?.lastReadMessageId;
    if (hasReadThrough(lr, msg.id)) readCount += 1;
  }
  if (readCount === 0) return null;
  if (room.type === "direct") return vi.messageList.readDirect;
  if (readCount === others.length) return vi.messageList.readGroupAll(readCount);
  return vi.messageList.readGroupPartial(readCount, others.length);
}

function avatarSrcForUserInRoom(
  room: Room | undefined,
  userId: string,
  apiBaseUrl: string,
): string | undefined {
  if (!room) return undefined;
  for (const mem of room.members) {
    if (!isRoomMemberPopulated(mem) || mem.userId._id !== userId) continue;
    const a = mem.userId.avatar?.trim();
    if (!a) return undefined;
    return resolveMediaUrl(a, apiBaseUrl) || undefined;
  }
  return undefined;
}

function normalizeReactionRows(reactions: MessageReaction[] | undefined): MessageReaction[] {
  const list = (reactions || [])
    .map((r) => ({
      userId: r.userId,
      username: r.username || "?",
      emoji: (r.emoji || "").trim(),
    }))
    .filter((r) => r.emoji);
  return [...list].sort((a, b) =>
    a.username.localeCompare(b.username, "vi", { sensitivity: "base" }),
  );
}

type ChatMessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
  selectedRoom: Room | undefined;
  apiBaseUrl: string;
  hasMore: boolean;
  loadingOlder: boolean;
  /** Đang tải lần đầu khi vừa đổi phòng / mở chat */
  initialLoading?: boolean;
  onLoadOlder: (beforeMessageId: string) => void;
  onRecall: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  canPinMessages: boolean;
  pinnedMessageIds: string[];
  highlightMessageId: string | null;
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
  initialLoading = false,
  onLoadOlder,
  onRecall,
  onToggleReaction,
  onPinMessage,
  onUnpinMessage,
  canPinMessages,
  pinnedMessageIds,
  highlightMessageId,
  readStates,
  listEndRef,
  listScrollRef,
}: ChatMessageListProps) {
  const localScrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = listScrollRef ?? localScrollRef;
  const loadLockRef = useRef(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactionModalMessageId, setReactionModalMessageId] = useState<string | null>(null);
  const [reactionModalTabKey, setReactionModalTabKey] = useState<string>("__all__");

  const reactionModalRows = normalizeReactionRows(
    reactionModalMessageId
      ? messages.find((m) => m.id === reactionModalMessageId)?.reactions
      : undefined,
  );

  useEffect(() => {
    if (reactionModalMessageId) setReactionModalTabKey("__all__");
  }, [reactionModalMessageId]);

  const renderReactionUserList = (rows: MessageReaction[]) => (
    <div className="message-reaction-detail-user-list">
      {rows.length === 0 ? (
        <Text type="secondary">{vi.messageList.reactionDetailEmpty}</Text>
      ) : (
        rows.map((r) => (
          <div key={r.userId} className="message-reaction-detail-row">
            <div className="message-reaction-detail-avatar-wrap">
              <Avatar
                size={40}
                src={avatarSrcForUserInRoom(selectedRoom, r.userId, apiBaseUrl)}
                className="message-reaction-detail-avatar"
              >
                {r.username.charAt(0).toUpperCase()}
              </Avatar>
            </div>
            <span className="message-reaction-detail-name" title={r.username}>
              {r.username}
            </span>
            <span className="message-reaction-detail-emoji-right" aria-hidden>
              {r.emoji}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const reactionModalTabItems: TabsProps["items"] = (() => {
    if (reactionModalRows.length === 0) return [];
    const order = new Map(BASIC_REACTION_EMOJIS.map((e, i) => [e, i]));
    const emojiKeys = [...new Set(reactionModalRows.map((r) => r.emoji))].sort((a, b) => {
      const ca = reactionModalRows.filter((x) => x.emoji === a).length;
      const cb = reactionModalRows.filter((x) => x.emoji === b).length;
      if (cb !== ca) return cb - ca;
      return (order.get(a) ?? 999) - (order.get(b) ?? 999);
    });
    const total = reactionModalRows.length;
    const items: TabsProps["items"] = [
      {
        key: "__all__",
        label: `${vi.messageList.reactionFilterAll} (${total})`,
        children: renderReactionUserList(reactionModalRows),
      },
      ...emojiKeys.map((emoji) => {
        const n = reactionModalRows.filter((r) => r.emoji === emoji).length;
        return {
          key: emoji,
          label: `${emoji} ${n}`,
          children: renderReactionUserList(reactionModalRows.filter((r) => r.emoji === emoji)),
        };
      }),
    ];
    return items;
  })();

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

  useEffect(() => {
    if (!highlightMessageId || !wrapRef.current) return;
    const el = wrapRef.current.querySelector(`[data-mid="${CSS.escape(highlightMessageId)}"]`);
    if (!(el instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("message-row--flash");
      window.setTimeout(() => el.classList.remove("message-row--flash"), 2200);
    });
  }, [highlightMessageId, messages]);

  const contextItems = useCallback(
    (msg: ChatMessage, canRecall: boolean): MenuProps["items"] => {
      const items: MenuProps["items"] = [];
      const pinned = pinnedMessageIds.includes(msg.id);
      if (canPinMessages && !msg.deleted) {
        items.push({
          key: pinned ? "unpin" : "pin",
          label: pinned ? vi.chat.unpinMessage : vi.chat.pinMessage,
          onClick: () =>
            pinned ? onUnpinMessage?.(msg.id) : onPinMessage?.(msg.id),
        });
      }
      if (canRecall) {
        items.push({
          key: "recall",
          label: vi.messageList.recall,
          danger: true,
          onClick: () => onRecall(msg.id),
        });
      }
      return items.length ? items : undefined;
    },
    [canPinMessages, pinnedMessageIds, onPinMessage, onUnpinMessage, onRecall],
  );

  function basicReactionPicker(messageId: string) {
    return (
      <div className="message-reaction-basic-picker">
        {BASIC_REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="message-reaction-basic-btn"
            onClick={() => {
              onToggleReaction(messageId, emoji);
              setReactionPickerFor(null);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  function renderReactionsRow(msg: ChatMessage) {
    if (msg.deleted) return null;
    const summary = summarizeReactions(msg.reactions, currentUserId);

    const addBtn = (
      <Popover
        open={reactionPickerFor === msg.id}
        onOpenChange={(open) => setReactionPickerFor(open ? msg.id : null)}
        trigger={["click"]}
        placement="top"
        content={basicReactionPicker(msg.id)}
      >
        <Button
          type="text"
          size="small"
          className="message-reaction-add"
          icon={<FiSmile aria-hidden />}
          aria-label={vi.messageList.addReaction}
        />
      </Popover>
    );

    if (!summary) {
      return <div className="message-reactions-row message-reactions-row--compact">{addBtn}</div>;
    }

    return (
      <div className="message-reactions-row message-reactions-row--compact">
        <button
          type="button"
          className={`message-reaction-summary${summary.topHasMine ? " message-reaction-summary--mine" : ""}`}
          onClick={() => setReactionModalMessageId(msg.id)}
        >
          <span className="message-reaction-summary-emoji" aria-hidden>
            {summary.topEmoji}
          </span>
          <span className="message-reaction-summary-count">{summary.total}</span>
        </button>
        {addBtn}
      </div>
    );
  }

  return (
    <div className="message-list-wrapper" ref={wrapRef} onScroll={handleScroll}>
      {loadingOlder ? (
        <div className="message-load-older">
          <Spin size="small" />
        </div>
      ) : null}
      {initialLoading ? (
        <div className="empty-messages chat-messages-initial-loading">
          <Spin size="large" tip={vi.chat.loadingMessages} />
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-messages">
          <Text type="secondary">{vi.messageList.empty}</Text>
        </div>
      ) : (
        messages.map((msg) => {
          const isMine = msg.sender.id === currentUserId;
          const contentType = msg.contentType || "text";
          const mediaSrc = resolveMediaUrl(msg.mediaUrl || "", apiBaseUrl);
          const receipt = readReceiptHint(msg, isMine, selectedRoom, currentUserId, readStates);
          const canRecall = isMine && !msg.deleted;
          const menuItems = contextItems(msg, canRecall);
          const rowHighlight = highlightMessageId === msg.id ? " message-row--highlight" : "";

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
                data-mid={msg.id}
                className={`message-row ${isMine ? "mine" : "other"} message-enter${rowHighlight}`}
              >
                {!isMine && (
                  <Avatar className="message-avatar">
                    {msg.sender.username.charAt(0).toUpperCase()}
                  </Avatar>
                )}
                <div className="message-col">
                  {menuItems ? (
                    <Dropdown menu={{ items: menuItems }} trigger={["contextMenu"]}>
                      <div style={{ maxWidth: "100%" }}>{bubble}</div>
                    </Dropdown>
                  ) : (
                    bubble
                  )}
                  {renderReactionsRow(msg)}
                </div>
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
                  preview={{ mask: vi.messageList.zoomImage }}
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
              data-mid={msg.id}
              className={`message-row ${isMine ? "mine" : "other"} message-enter${rowHighlight}`}
            >
              {!isMine && (
                <Avatar className="message-avatar">
                  {msg.sender.username.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div className="message-col">
                {menuItems ? (
                  <Dropdown menu={{ items: menuItems }} trigger={["contextMenu"]}>
                    <div style={{ maxWidth: "100%" }}>{bare}</div>
                  </Dropdown>
                ) : (
                  bare
                )}
                {renderReactionsRow(msg)}
              </div>
            </div>
          );
        })
      )}
      <div ref={listEndRef} />

      <Modal
        title={vi.messageList.reactionDetailTitle}
        open={reactionModalMessageId != null}
        onCancel={() => setReactionModalMessageId(null)}
        footer={null}
        width="min(92vw, 400px)"
        centered
        destroyOnClose
        closable
        maskClosable
        className="message-reaction-detail-modal"
        classNames={{ header: "message-reaction-detail-modal-header" }}
      >
        {reactionModalRows.length === 0 ? (
          <Text type="secondary">{vi.messageList.reactionDetailEmpty}</Text>
        ) : (
          <Tabs
            activeKey={reactionModalTabKey}
            onChange={setReactionModalTabKey}
            items={reactionModalTabItems}
            destroyInactiveTabPane
            className="message-reaction-detail-tabs"
          />
        )}
      </Modal>
    </div>
  );
}
