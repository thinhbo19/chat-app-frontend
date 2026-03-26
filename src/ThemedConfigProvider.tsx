import type { ReactNode } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import viVN from "antd/locale/vi_VN";
import { useChatSettings } from "./context/ChatSettingsContext";

export function ThemedConfigProvider({ children }: { children: ReactNode }) {
  const { theme } = useChatSettings();
  const isDark = theme === "dark";

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#2563eb",
          ...(isDark
            ? {
                colorBgElevated: "#1a2332",
                colorBgContainer: "#151d28",
                colorBorder: "#2d3a4d",
                colorText: "#e6edf3",
                colorTextSecondary: "#94a3b8",
                colorTextTertiary: "#64748b",
              }
            : {}),
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
