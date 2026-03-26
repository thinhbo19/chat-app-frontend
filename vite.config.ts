import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("emoji-picker-react")) return "emoji-picker";
          if (id.includes("socket.io-client")) return "socket-io";
          if (id.includes("antd") || id.includes("@ant-design")) return "antd";
        },
      },
    },
  },
});
