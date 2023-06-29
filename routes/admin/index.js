const express = require('express');
const router = express.Router();

const jail = require('./jail');
const filter = require('./filter');

router.get('/', (req, res) => {
    res.redirect(`${process.env.BASE_PATH}/admin/jails`);
});

router.use('/jails', jail);
router.use('/filters', filter);

module.exports = router;
