## ⲁⲛⲟⲩⲡ - 阿努比斯

阿努比斯（圣书体：𓇋𓈖𓊪𓅱𓃣，转写：inpw；科普特语：ⲁⲛⲟⲩⲡ，转写：Anoup；古希腊语：Ἄνουβις，转写:Anubis，早期名称:sab）

掌管自动禁止 IP 工作，本管理界面可以对默认 SSH 禁止IP 进行管理， 需要 fail2ban 安装

### 使用教程

#### 开发模式
- 修改 `.env.example` 到 `.env`
- 设置 `IS_MOCK=true` 使用模拟数据，无需真实fail2ban
- 运行 `pnpm dev` 启动开发服务器，默认端口为 `1233`

#### 生产模式
- 推荐使用 Ubuntu 20.04+, 理论上centOS 配置好也可以使用
- 安装fail2ban
- 修改 `.env.example` 到 `.env`
- 设置 `IS_MOCK=false` 使用真实fail2ban数据
- 可以使用打包命令或者直接用PM2启动项目: `pm2 start pm2.json`

### 开发指南

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 打包
pnpm build

# 生产环境运行
pnpm start
```

### API访问

Anubis现在提供了REST API接口，可通过JWT认证访问：

```bash
# 获取API Token
curl -X POST http://localhost:1233/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 使用Token获取系统状态
curl http://localhost:1233/api/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 获取Fail2Ban统计信息
curl http://localhost:1233/api/fail2ban/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 可以使用反向代理
- 推荐使用nginx设置反向代理, 1233 端口是在救命的时候使用

### nginx 二级目录反代

*NOTE : 不推荐使用 除非你知道你在干什么*

```bash

location /f2b {
    proxy_set_header Host $host;
    proxy_set_header X-Real_IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr:$remote_port;
    proxy_pass http://localhost:1233/f2b;
    # websocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}

location ~* ^/f2b/javascripts/(.+\.(js))$ {
    proxy_set_header Host $host;
    proxy_set_header X-Real_IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr:$remote_port;
    proxy_pass http://localhost:1233/f2b/javascripts/$1;
}

location ~* ^/f2b/images/flags/(.+\.(png|jpg|jpeg|gif))$ {
    proxy_set_header Host $host;
    proxy_set_header X-Real_IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr:$remote_port;
    proxy_pass http://localhost:1233/f2b/images/flags/$1;
}

```

### 屏幕截图

![1](docs/images/1.png)
![2](docs/images/2.png)
![3](docs/images/3.png)
![4](docs/images/4.png)