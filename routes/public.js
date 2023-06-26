const express = require('express');
const router = express.Router();

router.get('/', function (req, res, next) {
    res.render('login');
});

router.get('/auth/logout', async (req, res, next) => {
    req.session.destroy((err) => {
        res.redirect(`${process.env.BASE_PATH === '' ? '/' : process.env.BASE_PATH}`);
    });
});

router.post('/auth/login', async (req, res, next) => {
    const {username, password} = req.body;
    const realPassword = process.env.PASSWORD;
    const realUsername = process.env.USERNAME;
    if (username === realUsername && password === realPassword) {
        req.session['login'] = true;
        res.redirect(`${process.env.BASE_PATH}/admin`);
    } else {
        res.redirect(`${process.env.BASE_PATH === '' ? '/' : process.env.BASE_PATH}`);
    }
});

module.exports = router;
