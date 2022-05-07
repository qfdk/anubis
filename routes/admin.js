const express = require('express');
const router = express.Router();
const Jail = require('fail2ban').Jail;
const Fail2Ban = require('fail2ban').Fail2Ban;
const f2bSocket = '/var/run/fail2ban/fail2ban.sock';

const jail = new Jail('sshd', f2bSocket);
const fail = new Fail2Ban(f2bSocket);

router.get('/', async (req, res, next) => {
    res.render("admin/index", {...await jail.status, ...await fail.status});
});

router.get('/unban', async (req, res, next) => {
    const {ip} = req.query;
    await jail.unban(ip);
    res.redirect('/admin');
});

router.post('/ban', async (req, res, next) => {
    const {ip} = req.body;
    await jail.ban(ip);
    res.redirect('/admin');
});

module.exports = router;
