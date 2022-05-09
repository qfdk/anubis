const auth = (req, res, next) => {
    if (req.session.login === true) {
        return next();
    } else {
        return res.redirect('/');
    }
};

module.exports = {auth};
