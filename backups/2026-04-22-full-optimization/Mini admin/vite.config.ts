import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
  ],
  base: "./",
  server: {
    host: "127.0.0.1",
    proxy: {
      "/__auth": {
        target: "https://envId-appid.tcloudbaseapp.com/",
        changeOrigin: true,
      },
    },
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
      output: {
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
