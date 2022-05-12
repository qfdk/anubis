const express = require('express');
const router = express.Router();

router.get('/', function (req, res, next) {
    res.render('login');
});

router.get('/auth/logout', async (req, res, next) => {
    req.session.destroy((err) => {
        res.redirect(`${process.env.BASE_URL_PATH ? process.env.BASE_URL_PATH : '/'}`);
    });
});

router.post('/auth/login', async (req, res, next) => {
    const { username, password } = req.body;
    const realPassword = process.env.password || 'admin';
    const realUsername = process.env.username || 'admin';
    if (username === realUsername && password === realPassword) {
        req.session['login'] = true;
        res.redirect(`${process.env.BASE_URL_PATH}/admin`);
    } else {
        res.redirect(`${process.env.BASE_URL_PATH ? process.env.BASE_URL_PATH : '/'}`);
    }
});

module.exports = router;
