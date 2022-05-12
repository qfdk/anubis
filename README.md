 ⲁⲛⲟⲩⲡ - 阿努比斯

阿努比斯（圣书体：𓇋𓈖𓊪𓅱𓃣，转写：inpw；科普特语：ⲁⲛⲟⲩⲡ，转写：Anoup；古希腊语：Ἄνουβις，转写:Anubis，早期名称:sab）

掌管自动禁止 IP 工作，本管理界面可以对默认 SSH 禁止IP 进行管理， 需要 fail2ban 安装

### 安装 Redis

```bash
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

sudo apt-get update
sudo apt-get install redis
```


### nginx 二级目录反代

```bash
location /f2b/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real_IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr:$remote_port;
    proxy_pass http://localhost:1233/;
    # websocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```
