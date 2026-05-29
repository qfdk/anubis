require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const favicon = require('serve-favicon');

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
    secret: process.env.SESSION_SECRET || 'anubis',
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
