import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import "./style.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ChatSettingsProvider } from "./context/ChatSettingsContext";
import { ThemedConfigProvider } from "./ThemedConfigProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatSettingsProvider>
          <ThemedConfigProvider>
            <App />
          </ThemedConfigProvider>
        </ChatSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
