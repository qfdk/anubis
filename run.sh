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

# 创建日志目录
mkdir -p logs

# 安装依赖
echo "正在安装依赖..."
pnpm install

# 确保.env文件存在
if [ ! -f .env ]; then
    echo "未找到.env文件，正在从示例创建..."
    cp .env.example .env
    echo "已创建.env文件，请检查配置并修改。"
    exit 0
fi

# 确认运行模式
read -p "使用生产模式？需要系统安装fail2ban (y/n): " production

if [ "$production" = "y" ] || [ "$production" = "Y" ]; then
    # 生产模式
    echo "设置生产模式，使用真实fail2ban数据..."
    # 检测操作系统类型并使用正确的sed语法
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD) sed
        sed -i '' '/IS_MOCK=/d' .env
    else
        # Linux (GNU) sed
        sed -i '/IS_MOCK=/d' .env
    fi
    echo "IS_MOCK=false" >> .env
    
    # 检查fail2ban是否安装
    if ! command -v fail2ban-client &> /dev/null; then
        echo "警告: 没有找到fail2ban-client，请确保fail2ban已正确安装。"
        echo "在Ubuntu上，你可以使用: sudo apt-get install fail2ban"
        exit 1
    fi
    
    echo "启动生产服务器..."
    pnpm start
else
    # 开发模式
    echo "设置开发模式，使用模拟数据..."
    # 检测操作系统类型并使用正确的sed语法
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD) sed
        sed -i '' '/IS_MOCK=/d' .env
    else
        # Linux (GNU) sed
        sed -i '/IS_MOCK=/d' .env
    fi
    echo "IS_MOCK=true" >> .env
    
    # 创建模拟数据目录
    mkdir -p mock/fail2ban/jail.d
    mkdir -p mock/fail2ban/filter.d
    
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
    
    echo "启动开发服务器..."
    pnpm dev
fi