import type { ReactNode } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import viVN from "antd/locale/vi_VN";
import { useChatSettings } from "./context/ChatSettingsContext";

export function ThemedConfigProvider({ children }: { children: ReactNode }) {
  const { theme, uiPreset } = useChatSettings();
  const isDark = theme === "dark";
  const colorPrimary =
    uiPreset === "neon" ? "#06b6d4" : uiPreset === "minimal" ? "#4f46e5" : "#6366f1";
  const colorInfo = uiPreset === "neon" ? "#38bdf8" : "#22c3ee";

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary,
          colorInfo,
          colorSuccess: "#22c55e",
          borderRadius: 10,
          borderRadiusLG: 16,
          borderRadiusSM: 8,
          fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
          motionDurationFast: "0.16s",
          motionDurationMid: "0.24s",
          ...(isDark
            ? {
                colorBgBase: "#080d16",
                colorBgLayout: "#0f1724",
                colorBgElevated: "#1a2332",
                colorBgContainer: "#151d28",
                colorBorder: "#2d3a4d",
                colorText: "#e6edf3",
                colorTextSecondary: "#94a3b8",
                colorTextTertiary: "#64748b",
                colorSplit: "#2d3a4d",
                boxShadowSecondary: "0 18px 42px rgba(0, 0, 0, 0.38)",
              }
            : {
                colorBgBase: "#f3f6ff",
                colorBgLayout: "#f6f8ff",
                colorBgElevated: "#ffffff",
                colorBgContainer: "#ffffff",
                colorBorder: "rgba(99, 102, 241, 0.2)",
                colorSplit: "rgba(99, 102, 241, 0.12)",
                boxShadowSecondary: "0 18px 42px rgba(79, 70, 229, 0.16)",
              }),
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
