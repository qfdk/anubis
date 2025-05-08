/**
 * 简化版 API Router
 * 提供基本的系统状态和fail2ban信息API，无需JWT认证
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const statusService = require('../services/status');

// 判断是否使用模拟服务
const USE_MOCK = process.env.IS_MOCK === 'true';

// 根据环境选择不同的服务
let Fail2Ban, Jail;

if (USE_MOCK) {
  logger.info('API路由使用模拟的Fail2Ban服务');
  const mockService = require('../services/mock-fail2ban');

  // 创建与真实服务兼容的类
  Fail2Ban = function(socketPath) {
    this.status = mockService.getStatus();
  };

  Jail = function(jailName, socketPath) {
    this.jailName = jailName;
    this.status = mockService.getJailStatus(jailName);
    this.ban = (ip) => mockService.banIP(jailName, ip);
    this.unban = (ip) => mockService.unbanIP(jailName, ip);
  };
} else {
  // 使用真实的fail2ban
  const fail2ban = require('fail2ban');
  Fail2Ban = fail2ban.Fail2Ban;
  Jail = fail2ban.Jail;
}

const f2bSocket = process.env.FAIL2BAN_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';

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
  if (username === process.env.USERNAME && password === process.env.PASSWORD) {
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
    const fail = new Fail2Ban(f2bSocket);
    const { jails, list } = await fail.status;

    const result = [];

    // 对每个jail获取封禁IP列表
    for (const jailName of list) {
      const jail = new Jail(jailName, f2bSocket);
      const status = await jail.status || { actions: { bannedIPList: [] } };
      const ips = status.actions?.bannedIPList || [];

      if (ips.length > 0) {
        result.push({
          jail: jailName,
          bannedIPs: ips
        });
      }
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

    const jail = new Jail(jailName, f2bSocket);
    await jail.ban(ip);

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

    const jail = new Jail(jailName, f2bSocket);
    await jail.unban(ip);

    logger.info(`通过API对IP ${ip} 在 ${jailName} 中进行了解封`);
    res.json({ message: `IP ${ip} 已在 ${jailName} 中解封`, success: true });
  } catch (err) {
    logger.error(`解封IP时出错: ${err.message}`);
    res.status(500).json({ error: '解封IP失败', message: err.message });
  }
});

module.exports = router;