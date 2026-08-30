import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (/\/src\/game\/(?:listening(?:Run|Completion)|stormRelay(?:Run|Completion)|nightOperations(?:Run|Completion)|finalPromise(?:Run|Completion)|firstPage(?:State|Completion)|openStationState)\.js$/u.test(normalizedId)) {
            return "story-continuation-engine";
          }
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@phosphor-icons")) return "vendor-icons";
          if (id.includes("react")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "127.0.0.1", "localhost"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
