import { useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: { emailOrUsername: string; password: string }) {
    try {
      setLoading(true);
      await login(values);
      message.success("Dang nhap thanh cong");
      navigate("/chat");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Dang nhap that bai"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            Dang nhap
          </Title>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Email hoac Username"
              name="emailOrUsername"
              rules={[{ required: true, message: "Vui long nhap thong tin dang nhap" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Mat khau"
              name="password"
              rules={[{ required: true, message: "Vui long nhap mat khau" }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Dang nhap
            </Button>
          </Form>
          <Text type="secondary">
            Chua co tai khoan? <Link to="/register">Dang ky ngay</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
