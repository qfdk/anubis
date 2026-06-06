const {exec} = require('child_process');
const path = require('path');
const util = require('util');
const {logger} = require('./logger');

/**
 * 把用户提供的文件名安全地解析到 baseDir 内。
 * 解析后若逃逸出 baseDir（路径穿越）则抛错。
 * @param {string} baseDir 允许访问的根目录
 * @param {string} name 用户输入的文件名/相对路径
 * @returns {string} 校验通过的绝对路径
 */
const resolveInside = (baseDir, name) => {
    const base = path.resolve(baseDir);
    const target = path.resolve(base, name);
    if (target !== base && !target.startsWith(base + path.sep)) {
        throw new Error(`非法路径，拒绝越界访问: ${name}`);
    }
    return target;
};

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

module.exports = {
    reloadFail2ban,
    resolveInside
};