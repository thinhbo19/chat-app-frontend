import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
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
