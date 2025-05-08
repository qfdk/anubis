const express = require('express');
const router = express.Router();
const util = require('util');
const { logger } = require('../utils/logger');

router.get('/', (req, res) => {
    // 记录访问登录页面
    logger.debug('Access login page');
    res.render('login');
});

router.get('/auth/logout', async (req, res) => {
    try {
        // 将 session.destroy 转换为 Promise
        const destroySession = util.promisify(req.session.destroy).bind(req.session);
        await destroySession();
        
        const redirectPath = process.env.BASE_PATH || '/';
        logger.info('User logged out');
        res.redirect(redirectPath);
    } catch (err) {
        logger.error(`注销失败: ${err.message}`);
        const redirectPath = process.env.BASE_PATH || '/';
        res.redirect(redirectPath);
    }
});

router.post('/auth/login', (req, res) => {
    try {
        const {username, password} = req.body;
        
        // 设置环境变量没有变成常量避免意外修改
        const realPassword = process.env.PASSWORD || 'admin';
        const realUsername = process.env.USERNAME || 'admin';
        
        // 详细记录登录尝试信息（不包含密码）
        logger.debug(`登录尝试 - 用户名: ${username}, 预期用户名: ${realUsername}`);
        
        // 验证登录凭证
        if (username === realUsername && password === realPassword) {
            // 设置session
            req.session.login = true;
            req.session.loginTime = Date.now();
            req.session.username = username;
            
            // 确保session已保存，然后再重定向
            req.session.save((err) => {
                if (err) {
                    logger.error(`保存session失败: ${err.message}`);
                    return res.redirect(process.env.BASE_PATH || '/');
                }
                
                logger.info(`用户 ${username} 登录成功`);
                // 使用return确保重定向只执行一次
                return res.redirect(`${process.env.BASE_PATH || ''}/admin`);
            });
        } else {
            logger.warn(`登录失败: 用户名或密码错误, 尝试的用户名: ${username}`);
            return res.redirect(process.env.BASE_PATH || '/');
        }
    } catch (err) {
        logger.error(`登录过程发生错误: ${err.message}`);
        return res.redirect(process.env.BASE_PATH || '/');
    }
});

module.exports = router;
