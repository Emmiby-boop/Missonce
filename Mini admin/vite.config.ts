import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
  ],
  base: "./",
  // 生产构建移除 console.log（保留 console.warn/error），开发模式保留全部
  esbuild: {
    pure: mode === "production" ? ["console.log"] : [],
    drop: mode === "production" ? ["debugger"] : [],
  },
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
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts-vendor': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers', 'vue-echarts'],
          'cloudbase': ['@cloudbase/js-sdk'],
          'vendor-icons': ['@heroicons/vue'],
          'vendor-editor': ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
}));
