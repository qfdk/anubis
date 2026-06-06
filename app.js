require('dotenv').config();

const crypto = require('crypto');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const favicon = require('serve-favicon');
const { logger } = require('./utils/logger');

// 安全配置校验：杜绝可预测的 session secret 与默认弱口令
const WEAK_SECRETS = ['anubis', 'change-this-to-a-random-string', 'anubis-dev-session-secret'];
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || WEAK_SECRETS.includes(sessionSecret)) {
    logger.warn('[安全] SESSION_SECRET 未设置或为弱默认值，已临时生成随机值（重启后会话失效）；生产环境请在 .env 设置强随机 SESSION_SECRET');
    sessionSecret = crypto.randomBytes(32).toString('hex');
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin') {
    logger.warn('[安全] ADMIN_PASSWORD 未设置或仍为默认值 admin，存在被爆破风险，请在 .env 设置强密码');
}

const {auth} = require('./middlewares/auth');
const {csrf} = require('./middlewares/csrf');
const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api-simplified');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

// 信任反向代理（nginx），让 req.secure 正确反映 HTTPS 状态
app.set('trust proxy', 1);

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,
        httpOnly: true,
        secure: 'auto'  // HTTP 时不加 Secure，HTTPS 时自动加
    }
}));

const basePath = process.env.BASE_PATH || '';
const usePath = (path, ...handlers) => app.use(basePath + path, ...handlers);

// Use static middleware
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
usePath('/', express.static(path.join(__dirname, 'public')));
// Use routers
usePath('/', csrf, publicRouter);
usePath('/admin', csrf, auth, adminRouter);
usePath('/api', apiRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const { logger } = require('./utils/logger');
    logger.debug(`404 Not Found: ${req.originalUrl}`);
    next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
    const { logger } = require('./utils/logger');
    
    // 记录错误
    logger.error(`Error: ${err.message}\nStack: ${err.stack}`);
    
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
