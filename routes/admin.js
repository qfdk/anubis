const { exec } = require('child_process');
const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const Jail = require('fail2ban').Jail;
const Fail2Ban = require('fail2ban').Fail2Ban;
const f2bSocket = '/var/run/fail2ban/fail2ban.sock';
const fs = require('fs');

const JAIL_CONFIG_PATH = `/etc/fail2ban/jail.d`;
const FILTER_CONFIG_PATH = `/etc/fail2ban/filter.d`;
const fail = new Fail2Ban(f2bSocket);

router.get('/', async (req, res, next) => {
    const { jails, list } = await fail.status;

    fs.readdir(JAIL_CONFIG_PATH, (err, configNames) => {
        if (err) return res.json(err);
        const regex = /\[\w+\]/gm;
        const jailsInDir = [];
        for (const config of configNames) {
            const configPath = `${JAIL_CONFIG_PATH}/${config}`;
            const content = fs.readFileSync(configPath, 'utf-8');
            let m;
            while ((m = regex.exec(content)) !== null) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
                m.forEach((jail, groupIndex) => {
                    jailsInDir.push(jail.substring(1, jail.length - 1));
                });
            }
        }
        const results = [];
        for (const j of jailsInDir) {
            results.push({
                jailname: j,
                isActive: list.includes(j),
            });
        }
        res.render('admin/index', { jails, results });
    });
});

router.get('/jail/add', async (req, res, next) => {
    let filters;
    fs.readdir(FILTER_CONFIG_PATH, (err, files) => {
        if (err) return res.send('ERROR');
        filters = files.map(f => f.split('.conf')[0]);
        res.render(`admin/jail/add`, { filters });
    });
});

router.post('/jail/doAdd', async (req, res, next) => {
    const { jailname, enabled, bantime, maxretry, filter } = req.body;
    const content = `[${jailname}]
enabled = ${enabled === 'true'}
bantime = ${bantime}
maxretry = ${maxretry}
filter = ${filter}
`;
    fs.writeFile(`${JAIL_CONFIG_PATH}/${jailname}.conf`, content, (err) => {
        if (err) return res.json(err);
        exec('fail2ban-client reload', (err) => {
            if (err) {
                fs.unlink(`${JAIL_CONFIG_PATH}/${jailname}.conf`, (err) => {
                    if (err) return res.json(err);
                    exec('fail2ban-client reload', (err) => {
                        if (err) return res.json(err);
                        res.redirect(`${process.env.BASE_URL_PATH}/admin`);
                    });
                });
            }
            res.redirect(`${process.env.BASE_URL_PATH}/admin`);
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
                const geo = geoip.lookup(ip);
                if (status['info']) {
                    status['info'].push({
                        ip,
                        ...geo
                    });
                } else {
                    status['info'] = [
                        {
                            ip,
                            ...geo
                        }];
                }
            }
        } else {
            status = {
                ...status,
                info: [],
            };
        }
    } else {
        status = {
            ...status,
            info: [],
        };
    }
    res.render('admin/jail/list', { jailname: req.params.jailname, ...status });
});

router.get('/jails/:jailname/unban', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const { ip } = req.query;
    await jail.unban(ip);
    res.redirect(`${process.env.BASE_URL_PATH}/admin/jails/${req.params.jailname}`);
});

router.post('/jails/:jailname/ban', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const { ip } = req.body;
    await jail.ban(ip);
    res.redirect(`${process.env.BASE_URL_PATH}/admin/jails/${req.params.jailname}`);
});

router.get('/jails/:jailname/edit', async (req, res, next) => {
    fs.readdir(JAIL_CONFIG_PATH, (err, files) => {
        if (err) return res.send('ERROR');
        for (const file of files) {
            const content = fs.readFileSync(`${JAIL_CONFIG_PATH}/${file}`,
                'utf-8');
            if (content.includes(`[${req.params.jailname}]`)) {
                res.render('admin/jail/edit', {
                    configFileName: file,
                    jailname: req.params.jailname,
                    content,
                });
            }
        }
    });
});

router.post('/jails/:jailname/doEdit', async (req, res, next) => {
    const { configFileName, content } = req.body;
    fs.writeFile(`${JAIL_CONFIG_PATH}/${configFileName}`, content,
        async (err) => {
            if (err) return res.json(err);
            exec('fail2ban-client reload', async (err) => {
                if (err) return res.json(err);
                res.redirect(`${process.env.BASE_URL_PATH}/admin`);
            });
        });
});

router.get('/jails/:jailname/delete', async (req, res, next) => {
    fs.readdir(JAIL_CONFIG_PATH, (err, files) => {
        if (err) return res.send('ERROR');
        for (const file of files) {
            const filePath = `${JAIL_CONFIG_PATH}/${file}`;
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes(`[${req.params.jailname}]`)) {
                // 删除配置文件并重新载入client
                fs.unlink(filePath, err => {
                    if (err) return res.json(err);
                    exec('fail2ban-client reload', async (err) => {
                        if (err) return res.json(err);
                        res.redirect(`${process.env.BASE_URL_PATH}/admin`);
                    });
                });
            }
        }
    });
});
module.exports = router;
