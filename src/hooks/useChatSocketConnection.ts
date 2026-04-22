import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type UseChatSocketConnectionOptions = {
  apiBaseUrl: string;
};

export function useChatSocketConnection({ apiBaseUrl }: UseChatSocketConnectionOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const nextSocket = io(apiBaseUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
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

  return { socket, socketRef };
}
