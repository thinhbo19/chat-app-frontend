import { message } from "antd";
import { useCallback } from "react";
import type { ChangeEvent, MutableRefObject } from "react";
import type { Socket } from "socket.io-client";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";
import { uploadMediaThunk } from "../store/chatThunks";
import type { AppDispatch } from "../store/store";
import type { ChatComposeRowHandle } from "../components/chat/ChatComposeRow";

type PendingImage = { file: File; previewUrl: string } | null;
type SetState<T> = (value: T | ((prev: T) => T)) => void;

type UseChatComposerActionsArgs = {
  dispatch: AppDispatch;
  selectedRoomId: string;
  socket: Socket | null;
  composeRef: MutableRefObject<ChatComposeRowHandle | null>;
  uploadMaxBytes: number;
  uploadMaxMb: number;
  pendingImage: PendingImage;
  setPendingImage: SetState<PendingImage>;
  setUploadingMedia: (value: boolean) => void;
  setUploadProgress: (value: number | null) => void;
};

export function useChatComposerActions({
  dispatch,
  selectedRoomId,
  socket,
  composeRef,
  uploadMaxBytes,
  uploadMaxMb,
  pendingImage,
  setPendingImage,
  setUploadingMedia,
  setUploadProgress,
}: UseChatComposerActionsArgs) {
  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [setPendingImage]);

  const uploadAndEmitMedia = useCallback(
    async (file: File) => {
      if (!selectedRoomId || !socket) {
        message.warning(vi.errors.pickRoom);
        return;
      }
      if (file.size > uploadMaxBytes) {
        message.error(vi.errors.uploadTooLarge(uploadMaxMb));
        return;
      }
      setUploadingMedia(true);
      setUploadProgress(0);
      try {
        const response = await dispatch(
          uploadMediaThunk({
            file,
            onUploadProgress: (loaded, total) => {
              if (!total) return;
              setUploadProgress(Math.round((loaded / total) * 100));
            },
          }),
        ).unwrap();
        const caption = composeRef.current?.getText().trim() ?? "";
        socket.emit(
          "send_message",
          {
            roomId: selectedRoomId,
            contentType: response.contentType,
            mediaUrl: response.mediaUrl,
            text: caption,
          },
          (res: { ok: boolean; error?: string }) => {
            if (!res?.ok) {
              message.error(res?.error || vi.errors.sendFileFail);
              return;
            }
            composeRef.current?.clear();
          },
        );
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.uploadFileFail));
      } finally {
        setUploadingMedia(false);
        setUploadProgress(null);
      }
    },
    [
      composeRef,
      dispatch,
      selectedRoomId,
      setUploadProgress,
      setUploadingMedia,
      socket,
      uploadMaxBytes,
      uploadMaxMb,
    ],
  );

  const submitComposer = useCallback(async () => {
    if (!selectedRoomId || !socket) return;

    if (pendingImage) {
      if (pendingImage.file.size > uploadMaxBytes) {
        message.error(vi.errors.uploadTooLarge(uploadMaxMb));
        return;
      }
      setUploadingMedia(true);
      setUploadProgress(0);
      try {
        const response = await dispatch(
          uploadMediaThunk({
            file: pendingImage.file,
            onUploadProgress: (loaded, total) => {
              if (!total) return;
              setUploadProgress(Math.round((loaded / total) * 100));
            },
          }),
        ).unwrap();
        const caption = composeRef.current?.getText().trim() ?? "";
        socket.emit(
          "send_message",
          {
            roomId: selectedRoomId,
            contentType: response.contentType,
            mediaUrl: response.mediaUrl,
            text: caption,
          },
          (res: { ok: boolean; error?: string }) => {
            if (!res?.ok) {
              message.error(res?.error || vi.errors.sendImageFail);
              return;
            }
            composeRef.current?.clear();
            clearPendingImage();
          },
        );
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, vi.errors.uploadImageFail));
      } finally {
        setUploadingMedia(false);
        setUploadProgress(null);
      }
      return;
    }

    const trimmed = composeRef.current?.getText().trim() ?? "";
    if (!trimmed) {
      message.warning(vi.errors.needTextOrMedia);
      return;
    }

    socket.emit(
      "send_message",
      { roomId: selectedRoomId, contentType: "text" as const, text: trimmed, mediaUrl: "" },
      (response: { ok: boolean; error?: string }) => {
        if (!response?.ok) {
          message.error(response?.error || vi.errors.sendTextFail);
          return;
        }
        composeRef.current?.clear();
      },
    );
  }, [
    clearPendingImage,
    composeRef,
    dispatch,
    pendingImage,
    selectedRoomId,
    setUploadProgress,
    setUploadingMedia,
    socket,
    uploadMaxBytes,
    uploadMaxMb,
  ]);

  const onImageFileSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        message.warning(vi.errors.pickImageFile);
        return;
      }
      if (file.size > uploadMaxBytes) {
        message.error(vi.errors.uploadTooLarge(uploadMaxMb));
        return;
      }
      setPendingImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl: URL.createObjectURL(file) };
      });
    },
    [setPendingImage, uploadMaxBytes, uploadMaxMb],
  );

  const onVideoOrAudioFileSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (file.size > uploadMaxBytes) {
        message.error(vi.errors.uploadTooLarge(uploadMaxMb));
        return;
      }
      void uploadAndEmitMedia(file);
    },
    [uploadAndEmitMedia, uploadMaxBytes, uploadMaxMb],
  );

  return {
    clearPendingImage,
    onImageFileSelected,
    onVideoOrAudioFileSelected,
    submitComposer,
  };
}
