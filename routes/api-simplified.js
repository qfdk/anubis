/**
 * 简化版 API Router
 * 提供基本的系统状态和fail2ban信息API，无需JWT认证
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const statusService = require('../services/status');
const fail2banService = require('../services/fail2ban');

/**
 * 简单的认证中间件 - 使用基础的用户名密码认证
 */
const basicAuth = (req, res, next) => {
  // 从请求头获取认证信息
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger.warn(`API访问未提供认证: ${req.originalUrl}`);
    return res.status(401).json({ error: '需要认证' });
  }
  
  // 解码Base64认证字符串
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const username = credentials[0];
  const password = credentials[1];
  
  // 验证用户名和密码
  if (username === process.env.ADMIN_USERNAME && password === process.env.PASSWORD) {
    return next();
  }
  
  logger.warn(`API访问认证失败: ${req.originalUrl}`);
  return res.status(401).json({ error: '认证失败' });
};

/**
 * 获取系统状态
 * GET /api/status
 */
router.get('/status', basicAuth, async (req, res) => {
  try {
    const status = await statusService.getServerStatus();
    res.json(status);
  } catch (err) {
    logger.error(`获取系统状态时出错: ${err.message}`);
    res.status(500).json({ error: '获取系统状态失败', message: err.message });
  }
});

/**
 * 获取Fail2Ban统计信息
 * GET /api/fail2ban/stats
 */
router.get('/fail2ban/stats', basicAuth, async (req, res) => {
  try {
    const stats = await statusService.getFail2BanStats();

    if (stats.error) {
      return res.status(500).json(stats);
    }

    res.json(stats);
  } catch (err) {
    logger.error(`获取Fail2Ban统计信息时出错: ${err.message}`);
    res.status(500).json({ error: '获取Fail2Ban统计失败', message: err.message });
  }
});

/**
 * 获取所有Jail的被禁IP列表
 * GET /api/fail2ban/banned
 */
router.get('/fail2ban/banned', basicAuth, async (req, res) => {
  try {
    const { list } = await fail2banService.getStatus();
    const result = [];

    for (const jailName of list) {
      const { info } = await fail2banService.getJailStatus(jailName);
      const ips = info.map(i => i.ip);
      if (ips.length > 0) result.push({ jail: jailName, bannedIPs: ips });
    }

    res.json({ jails: result });
  } catch (err) {
    logger.error(`获取封禁IP列表时出错: ${err.message}`);
    res.status(500).json({ error: '获取封禁IP列表失败', message: err.message });
  }
});

/**
 * 对特定Jail中的IP进行封禁
 * POST /api/fail2ban/:jailName/ban
 */
router.post('/fail2ban/:jailName/ban', basicAuth, async (req, res) => {
  try {
    const { jailName } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: '缺少IP参数' });
    }

    await fail2banService.ban(jailName, ip);
    logger.info(`通过API对IP ${ip} 在 ${jailName} 中进行了封禁`);
    res.json({ message: `IP ${ip} 已在 ${jailName} 中封禁`, success: true });
  } catch (err) {
    logger.error(`封禁IP时出错: ${err.message}`);
    res.status(500).json({ error: '封禁IP失败', message: err.message });
  }
});

/**
 * 对特定Jail中的IP进行解封
 * POST /api/fail2ban/:jailName/unban
 */
router.post('/fail2ban/:jailName/unban', basicAuth, async (req, res) => {
  try {
    const { jailName } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: '缺少IP参数' });
    }

    await fail2banService.unban(jailName, ip);
    logger.info(`通过API对IP ${ip} 在 ${jailName} 中进行了解封`);
    res.json({ message: `IP ${ip} 已在 ${jailName} 中解封`, success: true });
  } catch (err) {
    logger.error(`解封IP时出错: ${err.message}`);
    res.status(500).json({ error: '解封IP失败', message: err.message });
  }
});

module.exports = router;