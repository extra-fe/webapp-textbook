import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      // src/ を指す @ も張っておく。以降 "@/components/..." のように書ける
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      zod: fileURLToPath(new URL("./node_modules/zod", import.meta.url)),
    },
  },
});
