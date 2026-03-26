import { useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { FiMessageCircle } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: { emailOrUsername: string; password: string }) {
    try {
      setLoading(true);
      await login(values);
      message.success(vi.login.success);
      navigate("/chat");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.login.fail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-glow" aria-hidden />
      <Card className="auth-card auth-card-enter">
        <div className="auth-brand">
          <span className="auth-brand-icon" aria-hidden>
            <FiMessageCircle />
          </span>
          <div>
            <Text className="auth-brand-name">{vi.appName}</Text>
            <Text type="secondary" className="auth-brand-tagline">
              {vi.login.subtitle}
            </Text>
          </div>
        </div>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {vi.login.title}
          </Title>
          <Form layout="vertical" onFinish={handleSubmit} requiredMark="optional">
            <Form.Item
              label={vi.login.emailLabel}
              name="emailOrUsername"
              rules={[{ required: true, message: vi.login.emailRequired }]}
            >
              <Input size="large" placeholder="you@email.com" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label={vi.login.passwordLabel}
              name="password"
              rules={[{ required: true, message: vi.login.passwordRequired }]}
            >
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" className="auth-submit-btn">
              {vi.login.submit}
            </Button>
          </Form>
          <Text type="secondary">
            {vi.login.noAccount} <Link to="/register">{vi.login.registerLink}</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
