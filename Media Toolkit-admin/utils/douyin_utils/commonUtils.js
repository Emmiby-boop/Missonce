const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * ⚠️ 安全提示：本模块使用 vm 沙箱执行 a_bogus.js（抖音签名算法，混淆代码）。
 * Node.js 官方明确声明 vm 模块不是安全边界（"not a security mechanism"）。
 * 风险：如果 a_bogus.js 被上游篡改，存在远程代码执行（RCE）风险。
 * 缓解措施：
 *   1. 固定 a_bogus.js 版本并校验其 SHA256 哈希
 *   2. 定期审计 a_bogus.js 内容变更
 *   3. 长期方案：将签名算法改写为 WASM 或纯 JS 实现
 */

// 全局缓存：a_bogus 脚本只加载执行一次，所有请求共享
let _cachedContext = null;

class CommonUtils {
  constructor() {
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  }

  _getContext() {
    if (_cachedContext) return _cachedContext;
    const filePath = path.join(__dirname, 'a_bogus.js');
    const scriptCode = fs.readFileSync(filePath, 'utf8');
    const context = {
      console,
      Date,
      Math,
      encodeURIComponent,
      decodeURIComponent,
      String,
      Array,
      Uint8Array,
      Int32Array,
      Uint32Array,
      parseInt,
      parseFloat,
      isNaN,
      Buffer,
    };
    vm.createContext(context);
    vm.runInContext(scriptCode, context, { filename: filePath });
    _cachedContext = context;
    return context;
  }

  getABogus(requestUrl, userAgent) {
    userAgent = userAgent || this.userAgent;
    const ctx = this._getContext();
    const generator = ctx.generate_a_bogus;
    if (typeof generator !== 'function') {
      throw new Error('a_bogus generator is not available');
    }
    const query = new URL(requestUrl).search.slice(1);
    return generator(query, userAgent);
  }

  getMsToken(randomLength) {
    randomLength = randomLength || 107;
    const chars = 'ABCDEFGHIGKLMNOPQRSTUVWXYZabcdefghigklmnopqrstuvwxyz0123456789=';
    let token = '';
    for (let i = 0; i < randomLength; i += 1) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}

module.exports = CommonUtils;
