const {exec} = require('child_process');
const util = require('util');
const {logger} = require('./logger');

// 使用 util.promisify 将 exec 转换为返回 Promise 的函数
const execAsync = util.promisify(exec);

// 转换为基于 Promise 的函数
const reloadFail2ban = async () => {
    try {
        await execAsync('fail2ban-client reload');
        logger.info(`fail2ban 重载成功`);
        return null;
    } catch (err) {
        logger.error(`fail2ban 重载失败: ${err.message}`);
        return err;
    }
};

// 为了向后兼容，保留回调风格的函数
const reloadFail2banCallback = (callback) => {
    exec('fail2ban-client reload', (err) => {
        if (!err) {
            logger.info(`fail2ban 重载成功`);
        }
        callback(err);
    });
};

module.exports = {
    reloadFail2ban,
    reloadFail2banCallback
};