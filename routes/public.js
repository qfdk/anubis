const express = require('express');
const router = express.Router();

router.get('/', function (req, res, next) {
    res.render('login');
});

router.get('/auth/logout', async (req, res, next) => {
    req.session.destroy((err) => {
        res.redirect(`/`);
    });
});

router.post('/auth/login', async (req, res, next) => {
    const { username, password } = req.body;
    const realPassword = process.env.password;
    const realUsername = process.env.username;
    if (username === realUsername && password === realPassword) {
        req.session['login'] = true;
        res.redirect(`/admin`);
    } else {
        res.redirect(`/`);
    }
});

module.exports = router;
