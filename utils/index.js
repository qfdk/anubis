const {exec} = require('child_process');
const {logger} = require('./logger');

const reloadFail2ban = (callback) => {
    exec('fail2ban-client reload', (err) => {
        if (!err) {
            logger.info(`fail2ban 重载成功`);
        }
        callback(err);
    });
};

module.exports = {
    reloadFail2ban
};