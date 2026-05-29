const { logger } = require('../utils/logger');
const geoip = require('geoip-lite');

const USE_MOCK = process.env.IS_MOCK === 'true';
const f2bSocket = process.env.FAIL2BAN_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';

let Fail2Ban, Jail;

if (USE_MOCK) {
    const mock = require('./mock-fail2ban');
    Fail2Ban = function () { this.status = mock.getStatus(); };
    Jail = function (jailName) {
        this.status = mock.getJailStatus(jailName);
        this.ban   = (ip) => mock.banIP(jailName, ip);
        this.unban = (ip) => mock.unbanIP(jailName, ip);
    };
} else {
    const f2b = require('fail2ban');
    Fail2Ban = f2b.Fail2Ban;
    Jail = f2b.Jail;
}

/**
 * 获取 fail2ban 总状态（jail 列表）
 * @returns {{ jails: number, list: string[] }}
 */
async function getStatus() {
    const fail = new Fail2Ban(f2bSocket);
    return fail.status;
}

/**
 * 获取单个 jail 的详情，含封禁 IP 及国家信息
 * @returns {{ actions: { currentlyBanned: number, totalBanned: number }, info: { ip: string, country: string }[] }}
 */
async function getJailStatus(jailname) {
    const jail = new Jail(jailname, f2bSocket);
    const status = await jail.status || { info: [], actions: { bannedIPList: [] } };

    const actions = {
        currentlyBanned: status.currentlyBanned || status.actions?.currentlyBanned || 0,
        totalBanned:     status.totalBanned     || status.actions?.totalBanned     || 0,
    };

    let info;
    if (USE_MOCK) {
        info = status.info || [];
    } else {
        const ips = status.actions?.bannedIPList || [];
        info = ips.map(ip => {
            const geo = geoip.lookup(ip);
            return { ip, country: geo?.country || 'JP' };
        });
    }

    return { actions, info };
}

/**
 * 封禁 IP
 */
async function ban(jailname, ip) {
    const jail = new Jail(jailname, f2bSocket);
    await jail.ban(ip);
    logger.info(`封禁 IP ${ip} (jail: ${jailname})`);
}

/**
 * 解封 IP
 */
async function unban(jailname, ip) {
    const jail = new Jail(jailname, f2bSocket);
    await jail.unban(ip);
    logger.info(`解封 IP ${ip} (jail: ${jailname})`);
}

module.exports = { getStatus, getJailStatus, ban, unban };
