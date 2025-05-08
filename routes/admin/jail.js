const {exec} = require('child_process');
const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const util = require('util');
const fs = require('fs');
const path = require('path');
const {logger} = require('../../utils/logger');
const {reloadFail2ban} = require('../../utils');

// Promisify fs functions
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

// Promisify exec
const execAsync = util.promisify(exec);

// 判断是否使用模拟服务
// 判断是否使用模拟服务
const USE_MOCK = process.env.IS_MOCK === 'true';

// 根据环境选择不同的服务
let Fail2Ban, Jail, fail;

let mockService;
if (USE_MOCK) {
  logger.info('使用模拟的Fail2Ban服务');
  
  // 创建与真实服务兼容的类
  try {
    mockService = require('../../services/mock-fail2ban');
    
    Fail2Ban = function() {
      this.status = mockService.getStatus();
    };
    
    Jail = function(jailName) {
      this.jailName = jailName;
      this.status = mockService.getJailStatus(jailName);
      this.ban = (ip) => mockService.banIP(jailName, ip);
      this.unban = (ip) => mockService.unbanIP(jailName, ip);
    };
    
    fail = { status: mockService.getStatus() };
  } catch (err) {
    logger.error(`模拟服务加载失败: ${err.message}`);
    throw err;
  }
} else {
  // 使用真实的fail2ban
  try {
    const fail2ban = require('fail2ban');
    Fail2Ban = fail2ban.Fail2Ban;
    Jail = fail2ban.Jail;
    
    const f2bSocket = process.env.FAIL2BAN_SOCKET_PATH || '/var/run/fail2ban/fail2ban.sock';
    fail = new Fail2Ban(f2bSocket);
  } catch (err) {
    logger.error(`Fail2Ban初始化失败: ${err.message}`);
    throw err;
  }
}

const JAIL_PATH = process.env.FAIL2BAN_JAIL_PATH || `/etc/fail2ban/jail.d`;
const FILTER_PATH = process.env.FAIL2BAN_FILTER_PATH || `/etc/fail2ban/filter.d`;

router.get('/', async (req, res, next) => {
    try {
        const {jails, list} = await fail.status;

        const configNames = await readdir(JAIL_PATH);
        const regex = /\[\w+\]/gm;
        const jailsInDir = [];

        for (const config of configNames) {
            const configPath = `${JAIL_PATH}/${config}`;
            const content = await readFile(configPath, 'utf-8');
            let m;
            
            // 重置正则表达式的lastIndex
            regex.lastIndex = 0;

            while ((m = regex.exec(content)) !== null) {
                jailsInDir.push(m[0].substring(1, m[0].length - 1));
            }
        }

        const results = jailsInDir.map((jail) => ({
            jailname: jail,
            isActive: list.includes(jail),
        }));
        
        // 格式化激活规则的名称为字符串列表
        const activeJails = list.join(', ');

        res.render('admin/index', {activeJails, results});
    } catch (err) {
        res.json(err);
    }
});

router.get('/add', async (req, res, next) => {
    try {
        const files = await readdir(FILTER_PATH);
        const filters = files.map(f => f.split('.conf')[0]);
        res.render(`admin/jail/add`, {filters});
    } catch (err) {
        logger.error(`读取过滤器路径失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.post('/doAdd', async (req, res, next) => {
    try {
        const {jailname, enabled, bantime, maxretry, filter} = req.body;
        const content = `[${jailname}]
enabled = ${enabled === 'true'}
bantime = ${bantime}
maxretry = ${maxretry}
filter = ${filter}
`;
        
        // 写入配置文件
        await writeFile(`${JAIL_PATH}/${jailname}.conf`, content);
        
        try {
            // 重载 fail2ban
            await execAsync('fail2ban-client reload');
            logger.info(`新增 jail ${jailname} 成功`);
            return res.redirect(`${process.env.BASE_PATH}/admin`);
        } catch (reloadErr) {
            logger.error(`重载 fail2ban 失败: ${reloadErr.message}`);
            
            // 清理失败的配置文件
            try {
                await unlink(`${JAIL_PATH}/${jailname}.conf`);
                await execAsync('fail2ban-client reload');
            } catch (cleanupErr) {
                logger.error(`清理失败的配置文件失败: ${cleanupErr.message}`);
            }
            
            return res.json(reloadErr);
        }
    } catch (err) {
        logger.error(`新增 jail 失败: ${err.message}`);
        return res.json(err);
    }
});

router.get('/info/:jailname', async (req, res, next) => {
    try {
        // 初始化Jail实例
        const jailInstance = new Jail(req.params.jailname, process.env.FAIL2BAN_SOCKET_PATH);
        let status;
        
        try {
            status = await jailInstance.status || {info: []};
        } catch (statusErr) {
            logger.error(`获取jail状态失败: ${statusErr.message}`);
            status = {info: [], actions: { bannedIPList: [] } };
        }
        
        // 输出调试信息
        logger.debug(`Jail status for ${req.params.jailname}: ${JSON.stringify(status)}`);
        
        const ips = status.actions?.bannedIPList || [];
        
        // 添加默认值防止空值
        const actions = {
            currentlyBanned: status.currentlyBanned || 0,
            totalBanned: status.totalBanned || 0
        };
        
        // 输出 actions 调试信息
        logger.debug(`Actions: ${JSON.stringify(actions)}`);
        
        // 处理真实fail2ban数据的特定情况
        // 查看真实fail2ban返回的actions结构
        logger.debug(`Actions from fail2ban: ${JSON.stringify(status.actions || {})}`);
        
        // 尝试今fail2ban的状态中提取当前和总数据
        if (!USE_MOCK && status.actions && typeof status.actions === 'object') {
            // 查找真实fail2ban的特性结构
            if (status.actions.currentlyBanned !== undefined) {
                actions.currentlyBanned = status.actions.currentlyBanned;
            }
            if (status.actions.totalBanned !== undefined) {
                actions.totalBanned = status.actions.totalBanned;
            }
            // 有些版本可能服务不同
            if (status.currently !== undefined) {
                actions.currentlyBanned = status.currently;
            }
            if (status.total !== undefined) {
                actions.totalBanned = status.total;
            }
        }
        
        if (USE_MOCK) {
            // 已包含国家信息
            res.render('admin/jail/list', {
                jailname: req.params.jailname, 
                actions: actions,
                info: status.info || []
            });
        } else {
            // 需要使用geoip查找国家
            const infoItems = [];
            if (Array.isArray(ips) && ips.length > 0) {
                for (const ip of ips) {
                    const geo = geoip.lookup(ip);
                    const country = geo?.country || 'JP';
                    infoItems.push({ip, country});
                }
            }
            
            res.render('admin/jail/list', {
                jailname: req.params.jailname, 
                actions: actions,
                info: infoItems
            });
        }
    } catch (err) {
        logger.error(`获取jail ${req.params.jailname} 信息失败: ${err.message}`);
        res.render('admin/jail/list', {
            jailname: req.params.jailname, 
            actions: {
                currentlyBanned: 0,
                totalBanned: 0
            }, 
            info: [], 
            error: err.message
        });
    }
});


router.get('/unban/:jailname', async (req, res, next) => {
    try {
        const jail = new Jail(req.params.jailname, process.env.FAIL2BAN_SOCKET_PATH);
        const {ip} = req.query;
        
        await jail.unban(ip);
        
        logger.info(`在jail ${req.params.jailname} 中解封IP: ${ip}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    } catch (err) {
        logger.error(`解封IP失败: ${err.message}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    }
});

router.post('/ban/:jailname', async (req, res, next) => {
    try {
        const jail = new Jail(req.params.jailname, process.env.FAIL2BAN_SOCKET_PATH);
        const {ip} = req.body;
        
        await jail.ban(ip);
        
        logger.info(`在jail ${req.params.jailname} 中封禁IP: ${ip}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    } catch (err) {
        logger.error(`封禁IP失败: ${err.message}`);
        res.redirect(`${process.env.BASE_PATH}/admin/jails/info/${req.params.jailname}`);
    }
});

router.get('/edit/:jailname', async (req, res, next) => {
    try {
        const files = await readdir(JAIL_PATH);
        for (const file of files) {
            const content = await readFile(`${JAIL_PATH}/${file}`, 'utf-8');
            if (content.includes(`[${req.params.jailname}]`)) {
                return res.render('admin/jail/edit', {
                    configFileName: file,
                    jailname: req.params.jailname,
                    content: content.split('\n'),
                });
            }
        }
        // 如果没有找到匹配的文件
        logger.warn(`未找到 jail ${req.params.jailname} 的配置文件`);
        res.send('Jail not found');
    } catch (err) {
        logger.error(`编辑 jail 失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.post('/doEdit/:jailname', async (req, res, next) => {
    try {
        const {configFileName, content} = req.body;
        await writeFile(`${JAIL_PATH}/${configFileName}`, content);
        
        // 重载 fail2ban
        const err = await reloadFail2ban();
        if (err) {
            return res.json(err);
        }
        
        logger.info(`更新 jail ${req.params.jailname} 成功`);
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } catch (err) {
        logger.error(`更新 jail 失败: ${err.message}`);
        res.json(err);
    }
});

router.get('/delete/:jailname', async (req, res, next) => {
    try {
        const files = await readdir(JAIL_PATH);
        let fileFound = false;
        
        for (const file of files) {
            const filePath = `${JAIL_PATH}/${file}`;
            const content = await readFile(filePath, 'utf-8');
            
            if (content.includes(`[${req.params.jailname}]`)) {
                fileFound = true;
                // 删除配置文件
                await unlink(filePath);
                
                // 重载 fail2ban
                const err = await reloadFail2ban();
                if (err) {
                    return res.json(err);
                }
                
                logger.info(`删除 jail ${req.params.jailname} 成功`);
                return res.redirect(`${process.env.BASE_PATH}/admin`);
            }
        }
        
        if (!fileFound) {
            logger.warn(`要删除的 jail ${req.params.jailname} 不存在`);
            return res.send('Jail not found');
        }
    } catch (err) {
        logger.error(`删除 jail 失败: ${err.message}`);
        res.send('ERROR');
    }
});
module.exports = router;
