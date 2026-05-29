const express = require('express');
const router = express.Router();
const util = require('util');
const fs = require('fs');
const { logger } = require('../../utils/logger');
const { reloadFail2ban } = require('../../utils');
const fail2banService = require('../../services/fail2ban');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

const JAIL_PATH   = process.env.FAIL2BAN_JAIL_PATH   || '/etc/fail2ban/jail.d';
const FILTER_PATH = process.env.FAIL2BAN_FILTER_PATH || '/etc/fail2ban/filter.d';

router.get('/', async (req, res) => {
    try {
        const { list } = await fail2banService.getStatus();

        const configNames = await readdir(JAIL_PATH);
        const regex = /\[\w+\]/gm;
        const seen = new Set();
        const jailsInDir = [];

        for (const config of configNames) {
            const content = await readFile(`${JAIL_PATH}/${config}`, 'utf-8');
            regex.lastIndex = 0;
            let m;
            while ((m = regex.exec(content)) !== null) {
                const jailname = m[0].slice(1, -1);
                const key = `${jailname}:${config}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    jailsInDir.push({ jailname, configFile: config });
                }
            }
        }

        const results = jailsInDir.map(({ jailname, configFile }) => ({
            jailname,
            configFile,
            isActive: list.includes(jailname)
        }));
        res.render('admin/index', { activeJails: list.join(', '), results });
    } catch (err) {
        res.json(err);
    }
});

router.get('/add', async (req, res) => {
    try {
        const files = await readdir(FILTER_PATH);
        res.render('admin/jail/add', { filters: files.map(f => f.split('.conf')[0]) });
    } catch (err) {
        logger.error(`读取过滤器路径失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.post('/doAdd', async (req, res) => {
    try {
        const { jailname, enabled, bantime, maxretry, filter } = req.body;
        const content = `[${jailname}]\nenabled = ${enabled === 'true'}\nbantime = ${bantime}\nmaxretry = ${maxretry}\nfilter = ${filter}\n`;
        await writeFile(`${JAIL_PATH}/${jailname}.conf`, content);

        const err = await reloadFail2ban();
        if (err) {
            await unlink(`${JAIL_PATH}/${jailname}.conf`).catch(() => {});
            return res.json(err);
        }

        logger.info(`新增 jail ${jailname} 成功`);
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } catch (err) {
        logger.error(`新增 jail 失败: ${err.message}`);
        res.json(err);
    }
});

router.get('/info/:jailname', async (req, res) => {
    try {
        const { actions, info } = await fail2banService.getJailStatus(req.params.jailname);
        res.render('admin/jail/list', { jailname: req.params.jailname, actions, info });
    } catch (err) {
        logger.error(`获取jail ${req.params.jailname} 信息失败: ${err.message}`);
        res.render('admin/jail/list', {
            jailname: req.params.jailname,
            actions: { currentlyBanned: 0, totalBanned: 0 },
            info: [],
            error: err.message
        });
    }
});

router.post('/unban/:jailname', async (req, res) => {
    try {
        await fail2banService.unban(req.params.jailname, req.body.ip);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    } catch (err) {
        logger.error(`解封IP失败: ${err.message}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    }
});

router.post('/ban/:jailname', async (req, res) => {
    try {
        await fail2banService.ban(req.params.jailname, req.body.ip);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    } catch (err) {
        logger.error(`封禁IP失败: ${err.message}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    }
});

router.get('/edit/:jailname', async (req, res) => {
    try {
        const configFile = req.query.file;
        if (!configFile) return res.send('Missing file parameter');
        const content = await readFile(`${JAIL_PATH}/${configFile}`, 'utf-8');
        res.render('admin/jail/edit', {
            configFileName: configFile,
            jailname: req.params.jailname,
            content: content.split('\n'),
        });
    } catch (err) {
        logger.error(`编辑 jail 失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.post('/doEdit/:jailname', async (req, res) => {
    try {
        const { configFileName, content } = req.body;
        await writeFile(`${JAIL_PATH}/${configFileName}`, content);

        const err = await reloadFail2ban();
        if (err) return res.json(err);

        logger.info(`更新 jail ${req.params.jailname} 成功`);
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } catch (err) {
        logger.error(`更新 jail 失败: ${err.message}`);
        res.json(err);
    }
});

router.post('/toggle/:jailname', async (req, res) => {
    try {
        const configFile = req.body.configFile;
        if (!configFile) return res.send('Missing configFile parameter');
        const filePath = `${JAIL_PATH}/${configFile}`;
        let content = await readFile(filePath, 'utf-8');

        if (/enabled\s*=\s*true/i.test(content)) {
            content = content.replace(/enabled\s*=\s*true/i, 'enabled = false');
        } else if (/enabled\s*=\s*false/i.test(content)) {
            content = content.replace(/enabled\s*=\s*false/i, 'enabled = true');
        } else {
            // 没有 enabled 行则追加
            content += '\nenabled = false\n';
        }

        await writeFile(filePath, content);
        const err = await reloadFail2ban();
        if (err) return res.json(err);

        logger.info(`切换 jail ${req.params.jailname} (${configFile}) 激活状态`);
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } catch (err) {
        logger.error(`切换 jail 激活状态失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.post('/delete/:jailname', async (req, res) => {
    try {
        const configFile = req.body.configFile;
        if (!configFile) return res.send('Missing configFile parameter');
        const filePath = `${JAIL_PATH}/${configFile}`;
        await unlink(filePath);
        const err = await reloadFail2ban();
        if (err) return res.json(err);
        logger.info(`删除 jail ${req.params.jailname} (${configFile}) 成功`);
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } catch (err) {
        logger.error(`删除 jail 失败: ${err.message}`);
        res.send('ERROR');
    }
});

module.exports = router;
