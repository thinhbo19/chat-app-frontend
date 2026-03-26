import {
  forwardRef,
  lazy,
  memo,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FiFilm, FiImage, FiMic, FiSend, FiX } from "react-icons/fi";
import { Button, Flex, Input, Popover, Space, Tooltip } from "antd";
import { vi } from "../../strings/vi";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export type ChatComposeRowHandle = {
  getText: () => string;
  clear: () => void;
};

type ChatComposeRowProps = {
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
  /** Chỉ trạng thái từ cha: phòng + đang upload — nút gửi còn phụ thuộc nội dung nháp bên trong. */
  parentSendBlocked: boolean;
};

const ChatComposeRowInner = forwardRef<ChatComposeRowHandle, ChatComposeRowProps>(
  function ChatComposeRowInner(
    {
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
      parentSendBlocked,
    },
    ref,
  ) {
    const [draft, setDraft] = useState("");
    const draftRef = useRef(draft);
    draftRef.current = draft;

    useImperativeHandle(
      ref,
      () => ({
        getText: () => draftRef.current,
        clear: () => setDraft(""),
      }),
      [],
    );

    const appendEmoji = useCallback((emoji: string) => {
      setDraft((prev) => prev + emoji);
    }, []);

    const sendDisabled =
      parentSendBlocked || (!pendingImage && !draft.trim());

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
                      appendEmoji(emojiData.emoji);
                    }}
                  />
                </Suspense>
              }
            >
              <Button type="default" className="chat-compose-tool-btn">
                <span className="chat-emoji-trigger">🙂</span>
              </Button>
            </Popover>
            <Tooltip title={vi.compose.sendImage}>
              <Button
                type="default"
                className="chat-compose-tool-btn"
                icon={<FiImage />}
                loading={uploadingMedia}
                disabled={!selectedRoomId}
                onClick={onPickImage}
              />
            </Tooltip>
            <Tooltip title={vi.compose.sendVideo}>
              <Button
                type="default"
                className="chat-compose-tool-btn"
                icon={<FiFilm />}
                loading={uploadingMedia}
                disabled={!selectedRoomId}
                onClick={onPickVideo}
              />
            </Tooltip>
            <Tooltip title={vi.compose.sendAudio}>
              <Button
                type="default"
                className="chat-compose-tool-btn"
                icon={<FiMic />}
                loading={uploadingMedia}
                disabled={!selectedRoomId}
                onClick={onPickAudio}
              />
            </Tooltip>
          </Space>
          <Input.TextArea
            className="chat-compose-input"
            value={draft}
            placeholder={vi.compose.placeholder}
            onChange={(event) => setDraft(event.target.value)}
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
            className="chat-send-btn"
          />
        </Flex>
      </>
    );
  },
);

export const ChatComposeRow = memo(ChatComposeRowInner);
