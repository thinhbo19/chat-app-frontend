import { Flex, Select, Space, Switch, Typography } from "antd";
import { vi } from "../../strings/vi";
import type { ChatUiPreset, ChatTheme } from "../../context/ChatSettingsContext";

const { Text } = Typography;

type ChatSettingsPanelProps = {
  uiPreset: ChatUiPreset;
  onUiPresetChange: (preset: ChatUiPreset) => void;
  theme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  desktopNotify: boolean;
  onDesktopNotifyChange: (next: boolean) => void;
  soundNotify: boolean;
  onSoundNotifyChange: (next: boolean) => void;
};

export function ChatSettingsPanel({
  uiPreset,
  onUiPresetChange,
  theme,
  onThemeChange,
  desktopNotify,
  onDesktopNotifyChange,
  soundNotify,
  onSoundNotifyChange,
}: ChatSettingsPanelProps) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.uiPreset}</Text>
        <Select
          value={uiPreset}
          onChange={(v) => onUiPresetChange(v as ChatUiPreset)}
          style={{ width: 150 }}
          options={[
            { value: "modern", label: vi.chat.uiPresetModern },
            { value: "minimal", label: vi.chat.uiPresetMinimal },
            { value: "neon", label: vi.chat.uiPresetNeon },
          ]}
        />
      </Flex>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.themeDark}</Text>
        <Switch
          checked={theme === "dark"}
          onChange={(checked) => onThemeChange(checked ? "dark" : "light")}
        />
      </Flex>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.desktopNotify}</Text>
        <Switch checked={desktopNotify} onChange={onDesktopNotifyChange} />
      </Flex>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Text>{vi.chat.soundNotify}</Text>
        <Switch checked={soundNotify} onChange={onSoundNotifyChange} />
      </Flex>
      <Text type="secondary">{vi.chat.languageNote}</Text>
    </Space>
  );
}
