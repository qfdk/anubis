const {exec} = require('child_process');
const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const Jail = require('fail2ban').Jail;
const Fail2Ban = require('fail2ban').Fail2Ban;
const f2bSocket = process.env.F2B_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';
const util = require('util');
const fs = require('fs');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

const JAIL_CONFIG_PATH = `/etc/fail2ban/jail.d`;
const FILTER_CONFIG_PATH = `/etc/fail2ban/filter.d`;
const fail = new Fail2Ban(f2bSocket);

router.get('/', async (req, res, next) => {
    try {
        const {jails, list} = await fail.status;

        const configNames = await readdir(JAIL_CONFIG_PATH);
        const regex = /\[\w+\]/gm;
        const jailsInDir = [];

        for (const config of configNames) {
            const configPath = `${JAIL_CONFIG_PATH}/${config}`;
            const content = await readFile(configPath, 'utf-8');
            let m;

            while ((m = regex.exec(content)) !== null) {
                jailsInDir.push(m[0].substring(1, m[0].length - 1));
            }
        }

        const results = jailsInDir.map((jail) => ({
            jailname: jail,
            isActive: list.includes(jail),
        }));

        res.render('admin/index', {jails, results});
    } catch (err) {
        res.json(err);
    }
});

router.get('/add', async (req, res, next) => {
    fs.readdir(FILTER_CONFIG_PATH, (err, files) => {
        if (err) return res.send('ERROR');
        const filters = files.map(f => f.split('.conf')[0]);
        res.render(`admin/jail/add`, {filters});
    });
});

router.post('/doAdd', async (req, res, next) => {
    const {jailname, enabled, bantime, maxretry, filter} = req.body;
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
                        res.redirect(`${process.env.BASE_PATH}/admin`);
                    });
                });
            }
            res.redirect(`${process.env.BASE_PATH}/admin`);
        });
    });
});

router.get('/info/:jailname', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const status = await jail.status || {info: []};
    const ips = status.actions?.bannedIPList || [];
    status.info = ips.map(ip => {
        const geo = geoip.lookup(ip);
        const country = geo?.country || 'JP';
        return {ip, country};
    });

    res.render('admin/jail/list', {jailname: req.params.jailname, actions: [], ...status});
});


router.get('/unban/:jailname', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const {ip} = req.query;
    await jail.unban(ip);
    res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
});

router.post('/ban/:jailname', async (req, res, next) => {
    const jail = new Jail(req.params.jailname, f2bSocket);
    const {ip} = req.body;
    await jail.ban(ip);
    res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
});

router.get('/edit/:jailname', async (req, res, next) => {
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

router.post('/doEdit/:jailname', async (req, res, next) => {
    const {configFileName, content} = req.body;
    fs.writeFile(`${JAIL_CONFIG_PATH}/${configFileName}`, content,
        async (err) => {
            if (err) return res.json(err);
            exec('fail2ban-client reload', async (err) => {
                if (err) return res.json(err);
                res.redirect(`${process.env.BASE_PATH}/admin`);
            });
        });
});

router.get('/delete/:jailname', async (req, res, next) => {
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
                        res.redirect(`${process.env.BASE_PATH}/admin`);
                    });
                });
            }
        }
    });
});
module.exports = router;
