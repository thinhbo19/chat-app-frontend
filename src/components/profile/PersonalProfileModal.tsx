import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  Form,
  Grid,
  Input,
  Menu,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import { FiLock, FiUpload, FiUser } from "react-icons/fi";
import { api } from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiError";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { vi } from "../../strings/vi";
import type { AuthUser } from "../../types";

const { Text } = Typography;

type ProfileSection = "info" | "password";

type PersonalProfileModalProps = {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  apiBaseUrl: string;
  uploadMaxMb: number;
  uploadMaxBytes: number;
  onUserUpdated: (user: AuthUser) => void;
};

export function PersonalProfileModal({
  open,
  onClose,
  user,
  apiBaseUrl,
  uploadMaxMb,
  uploadMaxBytes,
  onUserUpdated,
}: PersonalProfileModalProps) {
  const screens = Grid.useBreakpoint();
  /** `md` undefined lúc mount → coi như desktop để tránh nháy menu ngang. */
  const menuNarrow = screens.md === false;

  const [section, setSection] = useState<ProfileSection>("info");
  const [profileForm] = Form.useForm<{
    username: string;
    email: string;
    phone: string;
  }>();
  const [passwordForm] = Form.useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSection("info");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    profileForm.setFieldsValue({
      username: user.username,
      email: user.email,
      phone: user.phone?.trim() ?? "",
    });
  }, [open, user?._id, user?.username, user?.email, user?.phone, profileForm]);

  useEffect(() => {
    if (!open) return;
    passwordForm.resetFields();
  }, [open, passwordForm]);

  async function onAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      message.warning(vi.errors.pickImageFile);
      return;
    }
    if (file.size > uploadMaxBytes) {
      message.error(vi.errors.uploadTooLarge(uploadMaxMb));
      return;
    }
    try {
      setAvatarSaving(true);
      const formData = new FormData();
      formData.append("file", file);
      const up = await api.post<{ mediaUrl: string; contentType: string }>(
        "/api/messages/upload",
        formData,
      );
      if (up.data.contentType !== "image") {
        message.warning(vi.errors.pickImageFile);
        return;
      }
      const { data } = await api.patch<{ user: AuthUser }>("/api/users/me/avatar", {
        avatar: up.data.mediaUrl,
      });
      onUserUpdated(data.user);
      message.success(vi.profile.avatarSaved);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.errors.profileAvatarFail));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function submitProfile() {
    if (!user) return;
    try {
      const values = await profileForm.validateFields();
      setProfileSaving(true);
      const { data } = await api.patch<{ user: AuthUser }>("/api/users/me", {
        username: values.username.trim(),
        email: values.email.trim(),
        phone: (values.phone || "").trim(),
      });
      onUserUpdated(data.user);
      message.success(vi.profile.profileSaved);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error, vi.errors.profileUpdateFail));
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitPassword() {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error(vi.profile.confirmMismatch);
        return;
      }
      setPasswordSaving(true);
      await api.patch("/api/users/me/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.resetFields();
      message.success(vi.profile.passwordChanged);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error, vi.errors.profilePasswordFail));
    } finally {
      setPasswordSaving(false);
    }
  }

  const avatarSrc = user?.avatar?.trim()
    ? resolveMediaUrl(user.avatar.trim(), apiBaseUrl)
    : undefined;

  const menuItems = [
    {
      key: "info" as const,
      label: vi.profile.menuInfo,
      icon: <FiUser aria-hidden />,
    },
    {
      key: "password" as const,
      label: vi.profile.menuPassword,
      icon: <FiLock aria-hidden />,
    },
  ];

  return (
    <Modal
      className="personal-profile-modal"
      title={vi.profile.title}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(100vw - 24px, 760px)"
      destroyOnClose
      keyboard={false}
      centered
    >
      {!user ? (
        <Text type="secondary">{vi.chat.noRoomInfo}</Text>
      ) : (
        <div className="profile-modal-split">
          <div className="profile-modal-split-nav">
            <Menu
              className="profile-modal-nav-menu"
              mode={menuNarrow ? "horizontal" : "vertical"}
              selectedKeys={[section]}
              items={menuItems}
              disabledOverflow
              onClick={({ key }) => setSection(key as ProfileSection)}
            />
          </div>
          <div className="profile-modal-split-panel">
            {section === "info" ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                    {vi.profile.avatarHint(uploadMaxMb)}
                  </Text>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="chat-hidden-file-input"
                    aria-hidden
                    tabIndex={-1}
                    onChange={(e) => void onAvatarFileChange(e)}
                  />
                  <Space align="center" size={12} wrap>
                    <Avatar size={72} src={avatarSrc}>
                      {user.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Button
                      icon={<FiUpload aria-hidden />}
                      loading={avatarSaving}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {vi.profile.pickAvatar}
                    </Button>
                  </Space>
                </div>

                <Divider style={{ margin: 0 }} />

                <Form form={profileForm} layout="vertical" requiredMark={false}>
                  <Form.Item
                    name="username"
                    label={vi.profile.username}
                    rules={[
                      { required: true, message: vi.register.usernameRequired },
                      { min: 3, message: vi.register.usernameRequired },
                      { max: 30, message: vi.register.usernameRequired },
                    ]}
                  >
                    <Input autoComplete="username" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label={vi.profile.email}
                    rules={[
                      { required: true, message: vi.register.emailRequired },
                      { type: "email", message: vi.register.emailInvalid },
                    ]}
                  >
                    <Input autoComplete="email" />
                  </Form.Item>
                  <Form.Item name="phone" label={vi.profile.phone}>
                    <Input placeholder={vi.profile.phonePlaceholder} autoComplete="tel" />
                  </Form.Item>
                  <Button type="primary" loading={profileSaving} onClick={() => void submitProfile()}>
                    {vi.profile.saveProfile}
                  </Button>
                </Form>
              </Space>
            ) : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {vi.profile.passwordSection}
                </Text>
                <Form form={passwordForm} layout="vertical" requiredMark={false}>
                  <Form.Item
                    name="currentPassword"
                    label={vi.profile.currentPassword}
                    rules={[{ required: true, message: vi.login.passwordRequired }]}
                  >
                    <Input.Password autoComplete="current-password" />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label={vi.profile.newPassword}
                    rules={[
                      { required: true, message: vi.register.passwordRequired },
                      { min: 6, message: vi.register.passwordMin },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label={vi.profile.confirmPassword}
                    rules={[{ required: true, message: vi.register.confirmRequired }]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Button type="primary" onClick={() => void submitPassword()} loading={passwordSaving}>
                    {vi.profile.changePassword}
                  </Button>
                </Form>
              </Space>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
