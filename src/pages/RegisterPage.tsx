import { useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";

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
      message.error("Mat khau xac nhan khong khop");
      return;
    }

    try {
      setLoading(true);
      await register({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      message.success("Dang ky thanh cong, vui long dang nhap");
      navigate("/login");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Dang ky that bai"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            Dang ky tai khoan
          </Title>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Vui long nhap username" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Vui long nhap email" },
                { type: "email", message: "Email khong hop le" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Mat khau"
              name="password"
              rules={[
                { required: true, message: "Vui long nhap mat khau" },
                { min: 6, message: "Mat khau toi thieu 6 ky tu" },
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Nhap lai mat khau"
              name="confirmPassword"
              rules={[{ required: true, message: "Vui long xac nhan mat khau" }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Dang ky
            </Button>
          </Form>
          <Text type="secondary">
            Da co tai khoan? <Link to="/login">Dang nhap</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
