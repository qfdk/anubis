const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
    res.render('login');
});

router.get('/logout', async (req, res, next) => {
    req.session.destroy((err) => {
        res.redirect('/');
    });
});

router.post('/loginAction', async (req, res, next) => {
    const {username, password} = req.body;
    const realPassword = process.env.password || 'admin';
    const realUsername = process.env.username || 'admin';
    if (username === realUsername && password === realPassword) {
        req.session['login'] = true;
        res.redirect('/admin');
    } else {
        res.redirect('/');
    }
});

module.exports = router;
