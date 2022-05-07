const express = require('express');
const router = express.Router();
const Jail = require('fail2ban').Jail;
const Fail2Ban = require('fail2ban').Fail2Ban;
const f2bSocket = '/var/run/fail2ban/fail2ban.sock';
const geoip = require('fast-geoip');

const fail = new Fail2Ban(f2bSocket);

router.get('/', async (req, res, next) => {
    res.render("admin/index", { ...await fail.status });
});

router.get('/jails/:jailname', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const status = await jail.status;
    if (status) {
        const ips = status.actions.bannedIPList;
        for (const ip of ips) {
            const geo = await geoip.lookup(ip);
            if (status["info"]) {
                status["info"].push({
                    ip,
                    ...geo
                });
            } else {
                status["info"] = [{
                    ip,
                    ...geo
                }];
            };
        }
    }
    res.render('admin/jasil', { jailname: req.params.jailname, ...status });
});

router.get('/jails/:jailname/unban', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const { ip } = req.query;
    await jail.unban(ip);
    res.redirect(`/admin/jails/${req.params.jailname}`);
});

router.post('/jails/:jailname/ban', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const { ip } = req.body;
    await jail.ban(ip);
    res.redirect(`/admin/jails/${req.params.jailname}`);
});

module.exports = router;
