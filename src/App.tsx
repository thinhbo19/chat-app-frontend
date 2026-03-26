import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Spin } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ChatSettingsProvider } from "./context/ChatSettingsContext";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));

function RouteFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
      }}
    >
      <Spin size="large" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const { isAuthenticated, loadProfile } = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    loadProfile()
      .catch(() => null)
      .finally(() => setCheckingAuth(false));
  }, [loadProfile]);

  if (checkingAuth) {
    return <Spin fullscreen tip="Dang tai..." />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/chat" replace /> : <RegisterPage />}
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatSettingsProvider>
                <ChatPage />
              </ChatSettingsProvider>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
      </Routes>
    </Suspense>
  );
}
