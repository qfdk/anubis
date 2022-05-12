const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const Redis = require('ioredis');
const redisClient = new Redis();

const { auth } = require('./middlewares/auth');
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
process.env.BASE_URL_PATH = process.env.BASE_URL_PATH ? process.env.BASE_URL_PATH : "";

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'anubis',
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false },
}));

app.use('/', indexRouter);
app.use('/admin', auth, adminRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
