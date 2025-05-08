const { logger } = require('../utils/logger');

/**
 * 身份验证中间件
 * 检查用户是否已登录，如果未登录则重定向到登录页面
 */
const auth = (req, res, next) => {
    // 记录session状态用于调试
    logger.debug(`验证会话: login=${req.session.login}, username=${req.session.username}, sessionID=${req.sessionID}`);
    
    // 检查用户是否已登录或管理员模式是否激活
    if (req.session && req.session.login === true) {
        // 如果有用户信息则记录
        if (req.session.username) {
            logger.debug(`用户 ${req.session.username} 访问: ${req.originalUrl}`);
        }
        return next();
    } 
    // 支持开发环境下自动通过验证
    else if (process.env.IS_ADMIN === 'true') {
        logger.debug(`管理员模式激活，自动通过验证: ${req.originalUrl}`);
        return next();
    }
    else {
        logger.warn(`未授权访问尝试: ${req.originalUrl}, sessionID=${req.sessionID}`);
        // 重定向到登录页面
        return res.redirect(process.env.BASE_PATH || '/');
    }
};

module.exports = {auth};
