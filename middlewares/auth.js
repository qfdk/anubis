const { logger } = require('../utils/logger');

/**
 * 身份验证中间件
 * 检查用户是否已登录，如果未登录则重定向到登录页面
 */
const auth = (req, res, next) => {
    // 检查用户是否已登录或管理员模式是否激活
    if (req.session.login === true || process.env.IS_ADMIN === 'true') {
        // 如果有用户信息则记录
        if (req.session.username) {
            logger.debug(`用户 ${req.session.username} 访问: ${req.originalUrl}`);
        }
        return next();
    } else {
        logger.warn(`未授权访问尝试: ${req.originalUrl}`);
        // 重定向到登录页面
        return res.redirect(process.env.BASE_PATH || '/');
    }
};

module.exports = {auth};
