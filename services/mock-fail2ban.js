/**
 * Mock Fail2Ban Service
 * 用于开发和测试环境，模拟fail2ban的行为
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

// 模拟数据
const mockData = {
  jails: [
    {
      name: 'sshd',
      enabled: true,
      bannedIPs: [
        '192.168.1.100',
        '10.0.0.5',
        '172.16.10.50'
      ],
      stats: {
        currentlyBanned: 3,
        totalBanned: 15
      }
    },
    {
      name: 'nginx-http-auth',
      enabled: true,
      bannedIPs: [
        '192.168.1.101',
        '10.0.0.6'
      ],
      stats: {
        currentlyBanned: 2,
        totalBanned: 8
      }
    }
  ]
};

class MockFail2BanService {
  constructor() {
    this.data = {...mockData};
    
    logger.info('Mock Fail2Ban服务已初始化');
    
    // 尝试从jail.d目录读取配置
    this.loadConfigsFromDir();
  }

  // 从jail.d目录加载配置
  loadConfigsFromDir() {
    const jailPath = process.env.FAIL2BAN_JAIL_PATH || path.join(process.cwd(), 'mock/fail2ban/jail.d');
    
    try {
      logger.info(`尝试从目录加载jail配置: ${jailPath}`);
      
      if (fs.existsSync(jailPath)) {
        const files = fs.readdirSync(jailPath);
        logger.info(`找到 ${files.length} 个配置文件`);
        
        // 重置jails数组，只保留从配置文件中加载的
        this.data.jails = [];
        
        for (const file of files) {
          try {
            // 只处理.conf文件
            if (!file.endsWith('.conf')) continue;
            
            const configPath = path.join(jailPath, file);
            const content = fs.readFileSync(configPath, 'utf-8');
            
            // 从文件名解析jail名称
            const jailName = file.replace(/\.conf$/, '');
            
            // 检查配置文件是否包含该jail的配置（使用[jailName]的格式）
            const regex = new RegExp(`\\[${jailName}\\]`, 'i');
            
            if (regex.test(content)) {
              this.data.jails.push({
                name: jailName,
                enabled: content.includes('enabled = true'),
                bannedIPs: [
                  // 添加一些示例IP
                  `192.168.1.${Math.floor(Math.random() * 255)}`,
                  `10.0.0.${Math.floor(Math.random() * 255)}`
                ],
                stats: {
                  currentlyBanned: 2,
                  totalBanned: Math.floor(Math.random() * 20) + 5
                }
              });
              logger.info(`从配置文件加载jail: ${jailName} (enabled=${content.includes('enabled = true')})`);
            } else {
              logger.warn(`文件 ${file} 中未找到jail ${jailName} 的配置`);
            }
          } catch (err) {
            logger.error(`读取配置文件 ${file} 失败: ${err.message}`);
          }
        }
        
        // 如果没有加载任何jail，添加默认jail
        if (this.data.jails.length === 0) {
          logger.warn('未从配置文件加载任何jail，使用默认配置');
          this.data.jails = [...mockData.jails];
        }
        
        logger.info(`成功加载 ${this.data.jails.length} 个jail配置`);
      } else {
        logger.error(`Jail配置目录不存在: ${jailPath}，使用默认配置`);
        this.data.jails = [...mockData.jails];
      }
    } catch (err) {
      logger.error(`加载jail配置失败: ${err.message}，使用默认配置`);
      this.data.jails = [...mockData.jails];
    }
    
    // 输出加载的jail信息
    this.data.jails.forEach(jail => {
      logger.info(`已加载jail: ${jail.name}, enabled: ${jail.enabled}, banned IPs: ${jail.bannedIPs.length}`);
    });
  }

  // 获取所有jail的状态
  async getStatus() {
    return {
      jails: this.data.jails,
      list: this.data.jails.filter(j => j.enabled).map(j => j.name)
    };
  }

  // 获取特定jail的状态
  async getJailStatus(jailName) {
    const jail = this.data.jails.find(j => j.name === jailName);
    
    if (!jail) {
      throw new Error(`Jail '${jailName}' not found`);
    }
    
    return {
      info: jail.bannedIPs.map(ip => ({
        ip,
        country: this.getRandomCountry()
      })),
      actions: {
        bannedIPList: jail.bannedIPs
      },
      // 确保返回当前和总共禁止数
      currentlyBanned: jail.stats.currentlyBanned,
      totalBanned: jail.stats.totalBanned
    };
  }

  // 封禁IP
  async banIP(jailName, ip) {
    const jail = this.data.jails.find(j => j.name === jailName);
    
    if (!jail) {
      throw new Error(`Jail '${jailName}' not found`);
    }
    
    if (!jail.bannedIPs.includes(ip)) {
      jail.bannedIPs.push(ip);
      jail.stats.currentlyBanned += 1;
      jail.stats.totalBanned += 1;
      
      logger.info(`在jail ${jailName} 中封禁IP: ${ip}`);
    }
    
    return true;
  }

  // 解封IP
  async unbanIP(jailName, ip) {
    const jail = this.data.jails.find(j => j.name === jailName);
    
    if (!jail) {
      throw new Error(`Jail '${jailName}' not found`);
    }
    
    const index = jail.bannedIPs.indexOf(ip);
    if (index !== -1) {
      jail.bannedIPs.splice(index, 1);
      jail.stats.currentlyBanned -= 1;
      
      logger.info(`在jail ${jailName} 中解封IP: ${ip}`);
    }
    
    return true;
  }

  // 生成随机国家代码
  getRandomCountry() {
    const countries = ['CN', 'US', 'JP', 'RU', 'DE', 'GB', 'FR', 'BR', 'AU', 'IN'];
    return countries[Math.floor(Math.random() * countries.length)];
  }
}

module.exports = new MockFail2BanService();