/**
 * Status Service
 * Provides system status and performance monitoring functionality
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const { logger } = require('../utils/logger');
const execAsync = promisify(exec);

class StatusService {
  /**
   * Get current server status including CPU and memory usage
   * @returns {Promise<Object>} System status metrics
   */
  async getServerStatus() {
    try {
      const cpuUsage = await this.getCpuUsage();
      const memoryUsage = this.getMemoryUsage();
      
      return {
        cpu: cpuUsage,
        memory: memoryUsage,
        uptime: os.uptime(),
        hostname: os.hostname(),
        loadAverage: os.loadavg(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error getting server status: ${error.message}`);
      throw new Error('Failed to retrieve server status');
    }
  }

  /**
   * Calculate CPU usage percentage
   * @returns {Promise<Number>} CPU usage percentage
   */
  async getCpuUsage() {
    try {
      // For macOS
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync("top -l 1 | grep 'CPU usage'");
        const matches = stdout.match(/(\d+\.\d+)% user, (\d+\.\d+)% sys, (\d+\.\d+)% idle/);
        if (matches) {
          const [, user, sys] = matches;
          return parseFloat(user) + parseFloat(sys);
        }
        return 0;
      } 
      // For Linux
      else if (process.platform === 'linux') {
        const { stdout } = await execAsync("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'");
        return parseFloat(stdout.trim());
      }
      // Fall back to load average for other platforms
      const [load] = os.loadavg();
      const cpuCount = os.cpus().length;
      return (load / cpuCount) * 100;
    } catch (error) {
      logger.error(`Error calculating CPU usage: ${error.message}`);
      return 0;
    }
  }

  /**
   * Calculate memory usage
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: this.formatBytes(totalMem),
      free: this.formatBytes(freeMem),
      used: this.formatBytes(usedMem),
      percentUsed: Math.round((usedMem / totalMem) * 100)
    };
  }

  /**
   * Get Fail2Ban statistics
   * @returns {Promise<Object>} Fail2Ban statistics
   */
  async getFail2BanStats() {
    // 检查是否使用模拟模式
    const USE_MOCK = process.env.IS_MOCK === 'true';
    
    if (USE_MOCK) {
      try {
        // 使用模拟服务
        const mockService = require('./mock-fail2ban');
        const status = await mockService.getStatus();
        
        let totalBans = 0;
        const jails = status.list.map(async (jailName) => {
          try {
            const jailStatus = await mockService.getJailStatus(jailName);
            totalBans += jailStatus.stats?.totalBanned || 0;
            
            return {
              name: jailName,
              currentlyBanned: jailStatus.stats?.currentlyBanned || 0,
              totalBanned: jailStatus.stats?.totalBanned || 0
            };
          } catch (err) {
            logger.error(`获取模拟 jail ${jailName} 统计信息失败: ${err.message}`);
            return { name: jailName, error: 'Failed to retrieve statistics' };
          }
        });
        
        return {
          totalBans,
          jails: await Promise.all(jails)
        };
      } catch (error) {
        logger.error(`获取模拟fail2ban统计信息失败: ${error.message}`);
        return { 
          error: 'Failed to retrieve fail2ban statistics',
          totalBans: 0,
          jails: [] 
        };
      }
    } else {
      // 使用真实fail2ban
      try {
        const { stdout } = await execAsync('fail2ban-client status');
        
        // Parse fail2ban output
        const jails = stdout.match(/Jail list:\s+(.+)/);
        
        if (!jails || !jails[1]) {
          return { 
            error: 'No jails found or fail2ban not running',
            totalBans: 0,
            jails: [] 
          };
        }
        
        const jailList = jails[1].split(', ');
        let totalBans = 0;
        const jailStats = [];
        
        // Get stats for each jail
        for (const jail of jailList) {
          try {
            const { stdout: jailStatus } = await execAsync(`fail2ban-client status ${jail}`);
            const currentlyBanned = (jailStatus.match(/Currently banned:\s+(\d+)/) || [])[1] || 0;
            const totalBanned = (jailStatus.match(/Total banned:\s+(\d+)/) || [])[1] || 0;
            
            totalBans += parseInt(totalBanned, 10);
            
            jailStats.push({
              name: jail,
              currentlyBanned: parseInt(currentlyBanned, 10),
              totalBanned: parseInt(totalBanned, 10)
            });
          } catch (err) {
            logger.error(`Error getting stats for jail ${jail}: ${err.message}`);
            jailStats.push({ name: jail, error: 'Failed to retrieve statistics' });
          }
        }
        
        return {
          totalBans,
          jails: jailStats
        };
      } catch (error) {
        logger.error(`Error getting fail2ban stats: ${error.message}`);
        return { 
          error: 'Failed to retrieve fail2ban statistics',
          totalBans: 0,
          jails: [] 
        };
      }
    }
  }

  /**
   * Start periodic collection of performance metrics
   * @param {Function} callback Function to call with collected metrics
   * @param {Number} interval Interval in milliseconds
   * @returns {Object} Timer object that can be used to stop collection
   */
  startPeriodicCollection(callback, interval = 60000) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const timer = setInterval(async () => {
      try {
        const serverStatus = await this.getServerStatus();
        let fail2banStats = {};
        
        try {
          fail2banStats = await this.getFail2BanStats();
        } catch (err) {
          fail2banStats = { error: 'Failed to collect fail2ban statistics' };
        }
        
        callback({
          serverStatus,
          fail2banStats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error in periodic collection: ${error.message}`);
        callback({ error: 'Failed to collect metrics' });
      }
    }, interval);
    
    return {
      stop: () => clearInterval(timer),
      timer
    };
  }

  /**
   * Format bytes to human-readable format
   * @param {Number} bytes Number of bytes
   * @param {Number} decimals Number of decimal places
   * @returns {String} Formatted string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  }
}

module.exports = new StatusService();