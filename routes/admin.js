const express = require('express');
const router = express.Router();
const Jail = require('fail2ban').Jail
const f2bSocket = '/var/run/fail2ban/fail2ban.sock';

const jail = new Jail('sshd', f2bSocket)

router.get('/', async (req, res, next) => {
  res.render("admin/index", { ...await jail.status });
});

router.get('/unban', async (req, res, next) => {
  const { ip } = req.query;
  await jail.unban(ip);
  res.redirect('/admin');
});

router.post('/ban', async (req, res, next) => {
  const { ip } = req.body;
  await jail.ban(ip);
  res.redirect('/admin');
});

module.exports = router;
