const express = require('express');
const router = express.Router();
const { success, badRequest, serverError } = require('../../utils/response');
const wl = require('../../utils/domainWhitelist');

// ==================== GET /api/whitelist ====================
// 获取所有白名单
router.get('/whitelist', (req, res) => {
  try {
    return res.json(success({
      proxy: wl.getProxyDomains(),
      audio: wl.getAudioDomains(),
    }));
  } catch (e) {
    return res.status(500).json(serverError('获取白名单失败'));
  }
});

// ==================== POST /api/whitelist/proxy ====================
// 添加代理域名
router.post('/whitelist/proxy', (req, res) => {
  const { domain } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json(badRequest('域名不能为空'));
  }
  try {
    const added = wl.addProxyDomain(domain.trim().toLowerCase());
    if (added) {
      return res.json(success(null, `已添加代理域名: ${domain}`));
    } else {
      return res.json(success(null, `${domain} 已存在`));
    }
  } catch (e) {
    return res.status(500).json(serverError('添加失败'));
  }
});

// ==================== DELETE /api/whitelist/proxy/:domain ====================
// 移除代理域名
router.delete('/whitelist/proxy/:domain', (req, res) => {
  try {
    const removed = wl.removeProxyDomain(req.params.domain);
    if (removed) {
      return res.json(success(null, `已移除: ${req.params.domain}`));
    } else {
      return res.status(404).json(badRequest(`${req.params.domain} 不存在`));
    }
  } catch (e) {
    return res.status(500).json(serverError('移除失败'));
  }
});

// ==================== POST /api/whitelist/audio ====================
// 添加音频域名
router.post('/whitelist/audio', (req, res) => {
  const { domain } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json(badRequest('域名不能为空'));
  }
  try {
    const added = wl.addAudioDomain(domain.trim().toLowerCase());
    if (added) {
      return res.json(success(null, `已添加音频域名: ${domain}`));
    } else {
      return res.json(success(null, `${domain} 已存在`));
    }
  } catch (e) {
    return res.status(500).json(serverError('添加失败'));
  }
});

// ==================== DELETE /api/whitelist/audio/:domain ====================
// 移除音频域名
router.delete('/whitelist/audio/:domain', (req, res) => {
  try {
    const removed = wl.removeAudioDomain(req.params.domain);
    if (removed) {
      return res.json(success(null, `已移除: ${req.params.domain}`));
    } else {
      return res.status(404).json(badRequest(`${req.params.domain} 不存在`));
    }
  } catch (e) {
    return res.status(500).json(serverError('移除失败'));
  }
});

// ==================== POST /api/whitelist/reset ====================
// 恢复默认白名单
router.post('/whitelist/reset', (req, res) => {
  try {
    wl.resetToDefaults();
    return res.json(success(null, '已恢复默认白名单'));
  } catch (e) {
    return res.status(500).json(serverError('重置失败'));
  }
});

module.exports = router;
