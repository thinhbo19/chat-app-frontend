import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "antd/dist/reset.css";
import "./style.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ChatSettingsProvider } from "./context/ChatSettingsContext";
import { ThemedConfigProvider } from "./ThemedConfigProvider";
import { store } from "./store/store";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <ChatSettingsProvider>
            <ThemedConfigProvider>
              <App />
            </ThemedConfigProvider>
          </ChatSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
