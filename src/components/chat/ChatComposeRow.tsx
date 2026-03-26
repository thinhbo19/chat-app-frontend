import { lazy, Suspense } from "react";
import { FiFilm, FiImage, FiMic, FiSend, FiX } from "react-icons/fi";
import { Button, Flex, Input, Popover, Space, Tooltip } from "antd";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

type ChatComposeRowProps = {
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSubmit: () => void;
  selectedRoomId: string;
  uploadingMedia: boolean;
  emojiOpen: boolean;
  onEmojiOpenChange: (open: boolean) => void;
  pendingImage: { file: File; previewUrl: string } | null;
  onClearPendingImage: () => void;
  onOpenPendingModal: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickAudio: () => void;
  sendDisabled: boolean;
};

export function ChatComposeRow({
  messageInput,
  onMessageInputChange,
  onSubmit,
  selectedRoomId,
  uploadingMedia,
  emojiOpen,
  onEmojiOpenChange,
  pendingImage,
  onClearPendingImage,
  onOpenPendingModal,
  onPickImage,
  onPickVideo,
  onPickAudio,
  sendDisabled,
}: ChatComposeRowProps) {
  return (
    <>
      {pendingImage ? (
        <div className="pending-image-row">
          <div className="pending-image-thumb-wrap">
            <img
              src={pendingImage.previewUrl}
              alt=""
              className="pending-image-thumb"
              onClick={onOpenPendingModal}
              role="presentation"
            />
            <button
              type="button"
              className="pending-image-remove"
              onClick={onClearPendingImage}
              aria-label="Bo chon anh"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      ) : null}
      <Flex gap={8} align="flex-end" className="chat-compose-row" wrap="wrap" flex="none">
        <Space size={4} wrap className="chat-compose-tools">
          <Popover
            open={emojiOpen}
            onOpenChange={onEmojiOpenChange}
            placement="topLeft"
            trigger="click"
            content={
              <Suspense fallback={null}>
                <EmojiPicker
                  width={300}
                  height={380}
                  onEmojiClick={(emojiData: { emoji: string }) => {
                    onMessageInputChange(messageInput + emojiData.emoji);
                  }}
                />
              </Suspense>
            }
          >
            <Button type="default" className="chat-compose-tool-btn" aria-label="Chon emoji">
              <span className="chat-emoji-trigger">🙂</span>
            </Button>
          </Popover>
          <Tooltip title="Gui anh">
            <Button
              type="default"
              className="chat-compose-tool-btn"
              icon={<FiImage />}
              loading={uploadingMedia}
              disabled={!selectedRoomId}
              onClick={onPickImage}
              aria-label="Dinh kem anh"
            />
          </Tooltip>
          <Tooltip title="Gui video">
            <Button
              type="default"
              className="chat-compose-tool-btn"
              icon={<FiFilm />}
              loading={uploadingMedia}
              disabled={!selectedRoomId}
              onClick={onPickVideo}
              aria-label="Dinh kem video"
            />
          </Tooltip>
          <Tooltip title="Gui am thanh">
            <Button
              type="default"
              className="chat-compose-tool-btn"
              icon={<FiMic />}
              loading={uploadingMedia}
              disabled={!selectedRoomId}
              onClick={onPickAudio}
              aria-label="Dinh kem am thanh"
            />
          </Tooltip>
        </Space>
        <Input.TextArea
          className="chat-compose-input"
          value={messageInput}
          placeholder="Nhap tin nhan, emoji hoac chu thich kem file..."
          onChange={(event) => onMessageInputChange(event.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void onSubmit();
            }
          }}
          disabled={!selectedRoomId}
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
          <Button
            type="primary"
            shape="circle"
            icon={<FiSend />}
            onClick={() => void onSubmit()}
            disabled={sendDisabled}
            aria-label="Gui tin nhan"
            className="chat-send-btn"
          />
      </Flex>
    </>
  );
}
