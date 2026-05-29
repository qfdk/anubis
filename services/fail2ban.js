const { logger } = require('../utils/logger');
const geoip = require('geoip-lite');

const USE_MOCK = process.env.IS_MOCK === 'true';
const f2bSocket = process.env.FAIL2BAN_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';

let client;

if (USE_MOCK) {
    const mock = require('./mock-fail2ban');
    client = {
        status:      () => mock.getStatus().then(s => ({ total: s.list.length, list: s.list })),
        jailStatus:  (jail) => mock.getJailStatus(jail),
        ban:         (jail, ip) => mock.banIP(jail, ip),
        unban:       (jail, ip) => mock.unbanIP(jail, ip),
        reload:      () => Promise.resolve(),
    };
} else {
    const Fail2BanClient = require('fail2ban-node');
    client = new Fail2BanClient(f2bSocket);
}

/**
 * @returns {Promise<{ total: number, list: string[] }>}
 */
async function getStatus() {
    return client.status();
}

/**
 * @returns {Promise<{ actions: { currentlyBanned: number, totalBanned: number }, info: { ip: string, country: string }[] }>}
 */
async function getJailStatus(jailname) {
    if (USE_MOCK) {
        const status = await client.jailStatus(jailname) || { info: [], stats: {} };
        return {
            actions: {
                currentlyBanned: status.stats?.currentlyBanned || 0,
                totalBanned:     status.stats?.totalBanned     || 0,
            },
            info: status.info || [],
        };
    }

    const status = await client.jailStatus(jailname);
    const info = (status.bannedIPs || []).map(ip => {
        const geo = geoip.lookup(ip);
        return { ip, country: geo?.country || 'JP' };
    });

    return {
        actions: {
            currentlyBanned: status.currentlyBanned || 0,
            totalBanned:     status.totalBanned     || 0,
        },
        info,
    };
}

async function ban(jailname, ip) {
    await client.ban(jailname, ip);
    logger.info(`封禁 IP ${ip} (jail: ${jailname})`);
}

async function unban(jailname, ip) {
    await client.unban(jailname, ip);
    logger.info(`解封 IP ${ip} (jail: ${jailname})`);
}

module.exports = { getStatus, getJailStatus, ban, unban };
