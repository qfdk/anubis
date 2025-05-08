/**
 * API Router
 * Provides REST API endpoints for system status and fail2ban information
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const statusService = require('../services/status');

// JWT 认证中间件
const jwt = require('jsonwebtoken');

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

const JWT_SECRET = process.env.JWT_SECRET || 'anubis-api-secret-key';
const f2bSocket = process.env.FAIL2BAN_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';

/**
 * JWT 验证中间件
 */
const verifyToken = (req, res, next) => {
  // 从请求头或查询参数获取令牌
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

  if (!token) {
    logger.warn(`API访问未提供令牌: ${req.originalUrl}`);
    return res.status(401).json({ error: '需要认证令牌' });
  }

  try {
    // 验证令牌
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    logger.warn(`API访问令牌无效: ${req.originalUrl}`);
    return res.status(403).json({ error: '无效或过期的令牌' });
  }
};

/**
 * 生成 API Token
 * POST /api/auth
 */
router.post('/auth', (req, res) => {
  const { username, password } = req.body;

  // 验证用户名和密码（使用与主登录相同的凭据）
  if (username === process.env.USERNAME && password === process.env.PASSWORD) {
    // 创建令牌
    const token = jwt.sign(
      { username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`为用户 ${username} 生成API令牌`);
    return res.json({ token });
  }

  logger.warn(`API令牌生成失败, 用户名或密码错误: ${username}`);
  return res.status(401).json({ error: '用户名或密码无效' });
});

/**
 * 获取系统状态
 * GET /api/status
 */
router.get('/status', verifyToken, async (req, res) => {
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
router.get('/fail2ban/stats', verifyToken, async (req, res) => {
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
router.get('/fail2ban/banned', verifyToken, async (req, res) => {
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
router.post('/fail2ban/:jailName/ban', verifyToken, async (req, res) => {
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
router.post('/fail2ban/:jailName/unban', verifyToken, async (req, res) => {
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
