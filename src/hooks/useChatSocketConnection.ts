import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ACCESS_TOKEN_REFRESHED_EVENT, getAccessToken } from "../services/api";

type UseChatSocketConnectionOptions = {
  apiBaseUrl: string;
};

export function useChatSocketConnection({ apiBaseUrl }: UseChatSocketConnectionOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setSocket(null);
      return;
    }

    const nextSocket = io(apiBaseUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
      autoConnect: false,
      transports: ["websocket", "polling"],
    });

    setSocket(nextSocket);
    nextSocket.connect();

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const onTokenRefreshed = () => {
      const currentSocket = socketRef.current;
      if (!currentSocket) return;

      const token = getAccessToken();
      if (!token) return;

      currentSocket.auth = { token };
      if (currentSocket.connected) {
        currentSocket.disconnect();
      }
      currentSocket.connect();
    };

    window.addEventListener(ACCESS_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
    return () => window.removeEventListener(ACCESS_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
  }, []);

  return { socket, socketRef };
}
