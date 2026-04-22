import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ChatSettings, ChatTheme, ChatUiPreset } from "./chatSettingsTypes";

const STORAGE_KEY = "chat_app_settings_v1";

const defaultSettings: ChatSettings = {
  theme: "light",
  uiPreset: "modern",
  desktopNotify: false,
  soundNotify: true,
  language: "vi",
};

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

export const chatSettingsStorageKey = STORAGE_KEY;

const chatSettingsSlice = createSlice({
  name: "chatSettings",
  initialState: loadSettings(),
  reducers: {
    setTheme(state, action: PayloadAction<ChatTheme>) {
      state.theme = action.payload;
    },
    setUiPreset(state, action: PayloadAction<ChatUiPreset>) {
      state.uiPreset = action.payload;
    },
    setDesktopNotify(state, action: PayloadAction<boolean>) {
      state.desktopNotify = action.payload;
    },
    setSoundNotify(state, action: PayloadAction<boolean>) {
      state.soundNotify = action.payload;
    },
  },
});

export const {
  setTheme: setThemeAction,
  setUiPreset: setUiPresetAction,
  setDesktopNotify: setDesktopNotifyAction,
  setSoundNotify: setSoundNotifyAction,
} = chatSettingsSlice.actions;

export default chatSettingsSlice.reducer;
