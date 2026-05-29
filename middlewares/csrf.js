const crypto = require('crypto');

const csrf = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const token = req.body._csrf;
        if (!token || token !== req.session.csrfToken) {
            return res.status(403).send('CSRF token invalid');
        }
    }
    next();
};

module.exports = { csrf };
