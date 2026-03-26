import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "chat_app_settings_v1";

export type ChatTheme = "light" | "dark";

export type ChatSettings = {
  theme: ChatTheme;
  desktopNotify: boolean;
  soundNotify: boolean;
  language: "vi";
};

const defaultSettings: ChatSettings = {
  theme: "light",
  desktopNotify: false,
  soundNotify: true,
  language: "vi",
};

type ChatSettingsContextValue = ChatSettings & {
  setTheme: (t: ChatTheme) => void;
  setDesktopNotify: (v: boolean) => void;
  setSoundNotify: (v: boolean) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
};

const ChatSettingsContext = createContext<ChatSettingsContextValue | null>(null);

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      language: "vi",
    };
  } catch {
    return defaultSettings;
  }
}

export function ChatSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ChatSettings>(() => loadSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle("theme-dark", settings.theme === "dark");
  }, [settings]);

  const setTheme = useCallback((theme: ChatTheme) => {
    setSettings((s) => ({ ...s, theme }));
  }, []);

  const setDesktopNotify = useCallback((desktopNotify: boolean) => {
    setSettings((s) => ({ ...s, desktopNotify }));
  }, []);

  const setSoundNotify = useCallback((soundNotify: boolean) => {
    setSettings((s) => ({ ...s, soundNotify }));
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return "denied";
    }
    const p = await Notification.requestPermission();
    return p;
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setTheme,
      setDesktopNotify,
      setSoundNotify,
      requestNotificationPermission,
    }),
    [settings, setTheme, setDesktopNotify, setSoundNotify, requestNotificationPermission],
  );

  return (
    <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>
  );
}

export function useChatSettings() {
  const ctx = useContext(ChatSettingsContext);
  if (!ctx) {
    throw new Error("useChatSettings must be used within ChatSettingsProvider");
  }
  return ctx;
}
