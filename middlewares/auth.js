const auth = (req, res, next) => {
    if (req.session.login === true || process.env.IS_ADMIN === 'true') {
        return next();
    } else {
        return res.redirect('/');
    }
};

module.exports = {auth};
