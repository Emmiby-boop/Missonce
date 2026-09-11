import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // 团队技术提升方案 P0-5：防止问题复发
    rules: {
      // 禁止 console.log（允许 warn/error），生产构建已由 esbuild pure 移除
      "no-console": ["error", { allow: ["warn", "error"] }],
      // 禁止空 catch 块（至少要 console.error）
      "no-empty": "error",
      // 警告 any 类型使用，逐步替换为正确类型
      "@typescript-eslint/no-explicit-any": "warn",
      // 禁止 @ts-ignore，必须用类型声明替代
      "@typescript-eslint/ban-ts-comment": "error",
      // 单文件最大行数警告（现有超大文件待 P1 拆分）
      "max-lines": ["warn", { max: 500, skipComments: true }],
      // 忽略 _ 前缀的未使用变量和参数（约定弃用标记）
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  {
    // 路由页面组件允许单词命名（Login, Register 等）
    files: ["src/pages/Login.vue", "src/pages/Register.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
]);
