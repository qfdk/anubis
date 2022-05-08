const { exec } = require('child_process');
const express = require('express');
const router = express.Router();
const Jail = require('fail2ban').Jail;
const Fail2Ban = require('fail2ban').Fail2Ban;
const f2bSocket = '/var/run/fail2ban/fail2ban.sock';
const geoip = require('fast-geoip');
const fs = require('fs');
const JAIL_CONFIG_PATH = `/etc/fail2ban/jail.d`;
const fail = new Fail2Ban(f2bSocket);

router.get('/', async (req, res, next) => {
    res.render("admin/index", { ...await fail.status });
});

router.get('/jail/add', async (req, res, next) => {
    res.render(`admin/jail/add`);
});

router.post('/jail/doAdd', async (req, res, next) => {
    const { configFileName, content } = req.body;
    fs.writeFile(`${JAIL_CONFIG_PATH}/${configFileName}.conf`, content, async (err) => {
        if (err) return res.json(err);
        exec("fail2ban-client reload", async (err) => {
            if (err) return res.json(err);
            res.redirect('/admin');
        });
    });
});

router.get('/jails/:jailname', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    let status = await jail.status;
    if (status) {
        const ips = status.actions.bannedIPList;
        if (ips.length) {
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
        } else {
            status = {
                ...status,
                info: []
            };
        }
    } else {
        status = {
            ...status,
            info: []
        };
    }
    res.render('admin/jail/list', { jailname: req.params.jailname, ...status });
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

router.get('/jails/:jailname/edit', async (req, res, next) => {
    fs.readdir(JAIL_CONFIG_PATH, (err, files) => {
        if (err) return res.send("ERROR");
        for (const file of files) {
            const content = fs.readFileSync(`${JAIL_CONFIG_PATH}/${file}`, "utf-8");
            if (content.includes(`[${req.params.jailname}]`)) {
                res.render("admin/jail/edit", { configFileName: file, jailname: req.params.jailname, content });
            }
        }
    });
});

router.post('/jails/:jailname/doEdit', async (req, res, next) => {
    const { configFileName, content } = req.body;
    fs.writeFile(`${JAIL_CONFIG_PATH}/${configFileName}`, content, async (err) => {
        if (err) return res.json(err);
        exec("fail2ban-client reload", async (err) => {
            if (err) return res.json(err);
            res.redirect('/admin');
        });
    });
});
module.exports = router;
