const log4js = require('log4js');
const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 配置日志输出
log4js.configure({
    appenders: {
        console: { type: 'stdout' },
        app: { 
            type: 'dateFile', 
            filename: path.join(logDir, 'app.log'),
            pattern: '.yyyy-MM-dd',
            compress: true,
            keepFileExt: true,
            numBackups: 7
        },
        error: { 
            type: 'dateFile', 
            filename: path.join(logDir, 'error.log'),
            pattern: '.yyyy-MM-dd',
            compress: true,
            keepFileExt: true,
            numBackups: 7 
        },
        errorFilter: { 
            type: 'logLevelFilter', 
            appender: 'error', 
            level: 'error' 
        }
    },
    categories: {
        default: {
            appenders: ['console', 'app', 'errorFilter'],
            level: process.env.LOG_LEVEL || 'info'
        }
    }
});

const logger = log4js.getLogger('anubis');

// 下面的方法可以在任何地方使用
module.exports = {
    logger,
    // 关闭日志系统 - 保证应用正常关闭时调用
    shutdown: () => {
        return new Promise((resolve) => {
            log4js.shutdown(() => {
                resolve();
            });
        });
    }
};
