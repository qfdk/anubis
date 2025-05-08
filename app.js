require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const favicon = require('serve-favicon');

const {auth} = require('./middlewares/auth');
const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

// 已移除Helmet以避免CSP限制

// compression 压缩响应提高性能
const compression = require('compression');
app.use(compression());

app.use(session({
    secret: process.env.SESSION_SECRET || 'anubis',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,  // 设置 cookie 的过期时间为14 天
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

const basePath = process.env.BASE_PATH || '';
const usePath = (path, ...handlers) => app.use(basePath + path, ...handlers);

// Use static middleware
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
usePath('/', express.static(path.join(__dirname, 'public')));
// Use routers
usePath('/', publicRouter);
usePath('/admin', auth, adminRouter);
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
