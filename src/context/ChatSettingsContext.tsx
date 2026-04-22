import { useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  chatSettingsStorageKey,
  setDesktopNotifyAction,
  setSoundNotifyAction,
  setThemeAction,
  setUiPresetAction,
} from "../store/chatSettingsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import type { ChatSettings, ChatTheme, ChatUiPreset } from "../store/chatSettingsTypes";

type ChatSettingsContextValue = ChatSettings & {
  setTheme: (t: ChatTheme) => void;
  setUiPreset: (p: ChatUiPreset) => void;
  setDesktopNotify: (v: boolean) => void;
  setSoundNotify: (v: boolean) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
};
export { type ChatSettings, type ChatTheme, type ChatUiPreset } from "../store/chatSettingsTypes";

export function ChatSettingsProvider({ children }: { children: ReactNode }) {
  const settings = useAppSelector((state) => state.chatSettings);
  useEffect(() => {
    localStorage.setItem(chatSettingsStorageKey, JSON.stringify(settings));
    document.documentElement.classList.toggle("theme-dark", settings.theme === "dark");
    document.documentElement.classList.remove("ui-modern", "ui-minimal", "ui-neon");
    document.documentElement.classList.add(`ui-${settings.uiPreset}`);
  }, [settings]);

  return <>{children}</>;
}

export function useChatSettings(): ChatSettingsContextValue {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.chatSettings);

  const setTheme = useCallback(
    (theme: ChatTheme) => {
      dispatch(setThemeAction(theme));
    },
    [dispatch],
  );
  const setUiPreset = useCallback(
    (uiPreset: ChatUiPreset) => {
      dispatch(setUiPresetAction(uiPreset));
    },
    [dispatch],
  );
  const setDesktopNotify = useCallback(
    (desktopNotify: boolean) => {
      dispatch(setDesktopNotifyAction(desktopNotify));
    },
    [dispatch],
  );
  const setSoundNotify = useCallback(
    (soundNotify: boolean) => {
      dispatch(setSoundNotifyAction(soundNotify));
    },
    [dispatch],
  );
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.requestPermission();
  }, []);

  return useMemo(
    () => ({
      ...settings,
      setTheme,
      setUiPreset,
      setDesktopNotify,
      setSoundNotify,
      requestNotificationPermission,
    }),
    [settings, setTheme, setUiPreset, setDesktopNotify, setSoundNotify, requestNotificationPermission],
  );
}
