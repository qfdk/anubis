const express = require('express');
const router = express.Router();
const fs = require('fs');
const util = require('util');
const {reloadFail2ban} = require('../../utils');
const {logger} = require('../../utils/logger');

const FILTER_PATH = process.env.FAIL2BAN_FILTER_PATH || `/etc/fail2ban/filter.d`;

// 使用 promisify 转换 fs 函数
const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const unlinkAsync = util.promisify(fs.unlink);

router.get('/', async (req, res) => {
    try {
        const files = await readdirAsync(FILTER_PATH);
        const filters = files.map(f => f.split('.conf')[0]);
        res.render(`admin/filter/list`, {filters});
    } catch (err) {
        logger.error(`读取过滤器目录失败: ${err.message}`);
        res.send('ERROR');
    }
});


router.get('/add', (req, res) => {
    res.render(`admin/filter/add`);
});

router.post('/doAdd', async (req, res) => {
    try {
        const {filterName, filterContent} = req.body;
        await writeFileAsync(`${FILTER_PATH}/${filterName}.conf`, filterContent);
        
        const err = await reloadFail2ban();
        if (err) {
            return res.send(err);
        }
        
        res.redirect(`${process.env.BASE_PATH}/admin/filters`);
    } catch (err) {
        logger.error(`添加过滤器失败: ${err.message}`);
        res.json(err);
    }
});

router.get('/edit/:filterName', async (req, res) => {
    try {
        const {filterName} = req.params;
        const filterContent = await readFileAsync(`${FILTER_PATH}/${filterName}.conf`);
        res.render(`admin/filter/edit`, {
            filterName, 
            filterContent: filterContent.toString('utf8').split('\n')
        });
    } catch (err) {
        logger.error(`读取过滤器失败: ${err.message}`);
        res.send('ERROR');
    }
});

router.get('/delete/:filterName', async (req, res) => {
    try {
        const {filterName} = req.params;
        await unlinkAsync(`${FILTER_PATH}/${filterName}.conf`);
        
        const err = await reloadFail2ban();
        if (err) {
            return res.send(err);
        }
        
        res.redirect(`${process.env.BASE_PATH}/admin/filters`);
    } catch (err) {
        logger.error(`删除过滤器失败: ${err.message}`);
        res.send('ERROR');
    }
});


module.exports = router;
