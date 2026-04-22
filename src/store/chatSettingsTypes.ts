export type ChatTheme = "light" | "dark";
export type ChatUiPreset = "modern" | "minimal" | "neon";

export type ChatSettings = {
  theme: ChatTheme;
  uiPreset: ChatUiPreset;
  desktopNotify: boolean;
  soundNotify: boolean;
  language: "vi";
};
