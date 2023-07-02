const express = require('express');
const router = express.Router();
const fs = require('fs');
const {reloadFail2ban} = require('../../utils');

const FILTER_PATH = process.env.FAIL2BAN_FILTER_PATH || `/etc/fail2ban/filter.d`;

router.get('/', (req, res) => {
    fs.readdir(FILTER_PATH, (err, files) => {
        if (err) return res.send('ERROR');
        const filters = files.map(f => f.split('.conf')[0]);
        res.render(`admin/filter/list`, {filters});
    });
});


router.get('/add', (req, res) => {
    res.render(`admin/filter/add`);
});

router.post('/doAdd', (req, res) => {
    const {filterName, filterContent} = req.body;
    fs.writeFile(`${FILTER_PATH}/${filterName}.conf`, filterContent, (err) => {
        if (err) return res.json(err);
        reloadFail2ban((err) => {
            if (err) {
                return res.send(err);
            }
            res.redirect(`${process.env.BASE_PATH}/admin/filters`);
        });
    });
});

router.get('/edit/:filterName', (req, res) => {
    const {filterName} = req.params;
    fs.readFile(`${FILTER_PATH}/${filterName}.conf`, (err, filterContent) => {
        res.render(`admin/filter/edit`, {filterName, filterContent});
    });
});

router.get('/delete/:filterName', (req, res) => {
    const {filterName} = req.params;
    fs.unlinkSync(`${FILTER_PATH}/${filterName}.conf`);
    res.redirect(`${process.env.BASE_PATH}/admin/filters`);
});


module.exports = router;
