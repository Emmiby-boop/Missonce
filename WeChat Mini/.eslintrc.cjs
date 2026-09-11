/**
 * ESLint 配置 - 小辣椒头像小程序
 * 团队技术提升方案 P0-5：防止问题复发
 *
 * 使用方式：
 *   1. 微信开发者工具内置 ESLint 会自动读取本配置
 *   2. 命令行需先安装：npm install -D eslint
 *   3. 运行检查：npx eslint .
 */
module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  globals: {
    // 小程序前端全局 API
    wx: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    App: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
    // 小程序运行时全局
    __wxConfig: 'readonly',
    __wxRoute: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  rules: {
    // 禁止 console.log（允许 warn/error）
    // 生产环境调试日志应使用条件编译或后续接入 logger
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // 禁止空 catch 块（至少要 console.error）
    'no-empty': ['error', { allowEmptyCatch: false }],
    // 单文件最大行数警告（现有超大文件待 P1 拆分）
    'max-lines': ['warn', { max: 500, skipComments: true }],
    // 单函数最大行数警告
    'max-lines-per-function': ['warn', { max: 80, skipComments: true }],
    // 圈复杂度警告
    'complexity': ['warn', 10],
  },
  // 忽略目录
  ignorePatterns: [
    'node_modules/',
    'miniprogram_npm/',
    'cloudfunctions/*/node_modules/',
    'scripts/',
  ],
}
