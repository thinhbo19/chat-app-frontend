import { useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { FiUserPlus } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    if (values.password !== values.confirmPassword) {
      message.error(vi.register.mismatch);
      return;
    }

    try {
      setLoading(true);
      await register({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      message.success(vi.register.success);
      navigate("/login");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.register.fail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-glow" aria-hidden />
      <Card className="auth-card auth-card-enter">
        <div className="auth-brand">
          <span className="auth-brand-icon auth-brand-icon--accent" aria-hidden>
            <FiUserPlus />
          </span>
          <div>
            <Text className="auth-brand-name">{vi.appName}</Text>
            <Text type="secondary" className="auth-brand-tagline">
              {vi.register.subtitle}
            </Text>
          </div>
        </div>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {vi.register.title}
          </Title>
          <Form layout="vertical" onFinish={handleSubmit} requiredMark="optional">
            <Form.Item
              label={vi.register.username}
              name="username"
              rules={[{ required: true, message: vi.register.usernameRequired }]}
            >
              <Input size="large" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label={vi.register.email}
              name="email"
              rules={[
                { required: true, message: vi.register.emailRequired },
                { type: "email", message: vi.register.emailInvalid },
              ]}
            >
              <Input size="large" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label={vi.register.password}
              name="password"
              rules={[
                { required: true, message: vi.register.passwordRequired },
                { min: 6, message: vi.register.passwordMin },
              ]}
            >
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              label={vi.register.confirm}
              name="confirmPassword"
              rules={[{ required: true, message: vi.register.confirmRequired }]}
            >
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" className="auth-submit-btn">
              {vi.register.submit}
            </Button>
          </Form>
          <Text type="secondary">
            {vi.register.hasAccount} <Link to="/login">{vi.register.loginLink}</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
