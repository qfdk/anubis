#!/bin/bash

# 检查是否安装了pnpm
if ! command -v pnpm &> /dev/null; then
    echo "未找到pnpm，正在尝试安装..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo "安装pnpm失败，请手动安装后再运行此脚本。"
        exit 1
    fi
fi

# 检查是否存在.env文件
if [ ! -f .env ]; then
    echo "未找到.env文件，正在从示例创建..."
    cp .env.example .env

    # 设置模拟模式
    echo "IS_MOCK=true" >> .env
    echo "已创建.env文件并启用模拟模式。"
fi

# 创建目录
mkdir -p logs
mkdir -p mock/fail2ban/jail.d
mkdir -p mock/fail2ban/filter.d

# 安装依赖
echo "正在安装依赖..."
pnpm install

# 检查mock目录是否为空，如果为空则创建示例文件
if [ ! "$(ls -A mock/fail2ban/jail.d)" ]; then
    echo "创建示例jail配置..."
    echo "[sshd]
enabled = true
bantime = 3600
maxretry = 3
filter = sshd" > mock/fail2ban/jail.d/sshd.conf

    echo "[nginx-http-auth]
enabled = true
bantime = 1800
maxretry = 5
filter = nginx-http-auth" > mock/fail2ban/jail.d/nginx-http-auth.conf
fi

if [ ! "$(ls -A mock/fail2ban/filter.d)" ]; then
    echo "创建示例filter配置..."
    echo "# Fail2Ban filter for sshd
[Definition]
failregex = Authentication failure for .* from <HOST>
            Failed password for .* from <HOST>
ignoreregex =" > mock/fail2ban/filter.d/sshd.conf

    echo "# Fail2Ban filter for nginx
[Definition]
failregex = no user/password was provided for basic authentication, client: <HOST>
            password mismatch, client: <HOST>
ignoreregex =" > mock/fail2ban/filter.d/nginx-http-auth.conf
fi

# 确保.env文件存在并设置模拟模式
if [ ! -f .env ]; then
    echo "创建.env文件..."
    cp .env.example .env
fi

# 确保IS_MOCK设置为true
if ! grep -q "IS_MOCK=true" .env; then
    echo "设置模拟模式..."
    sed -i '' '/IS_MOCK=/d' .env
    echo "IS_MOCK=true" >> .env
fi

echo "启动开发环境..."
# 启动应用
pnpm dev
