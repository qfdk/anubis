const auth = (req, res, next) => {
    if (req.session.login === true) {
        return next();
    } else {
        console.log("[鉴权路由] 未登录");
        return res.redirect('/');
    }
};

module.exports = {auth};
