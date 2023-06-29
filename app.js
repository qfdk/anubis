require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');

const {auth} = require('./middlewares/auth');
const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const {logger} = require('./utils/logger');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: 'anubis',
    resave: true,
    saveUninitialized: false,
    cookie: {secure: false},
}));
app.use((req, res, next) => {
    logger.debug(`${req.method} - ${req.originalUrl}`);
    next();
});

const basePath = process.env.BASE_PATH || '';
const usePath = (path, ...handlers) => app.use(basePath + path, ...handlers);

// Use static middleware
usePath('/', express.static(path.join(__dirname, 'public')));

// Use routers
usePath('/', publicRouter);
usePath('/admin', auth, adminRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    console.log(req.originalUrl);
    next(createError(404));
});

// error handler
app.use((err, req, res) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
