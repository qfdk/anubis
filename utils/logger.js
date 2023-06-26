const log4js = require('log4js');

const logger = log4js.getLogger('anubis');
log4js.configure({
    appenders: {out: {type: 'stdout'}},
    categories: {
        default: {
            appenders: ['out'],
            level: process.env.LOGLEVEL || 'info',
        },
    },
});

module.exports = {
    logger,
};
