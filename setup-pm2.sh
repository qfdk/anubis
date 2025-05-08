#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Anubis PM2 设置脚本${NC}"
echo "===================="

# 检查pm2是否安装
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}未找到PM2，正在尝试安装...${NC}"
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo -e "${RED}安装PM2失败，请手动安装后再运行此脚本。${NC}"
        echo "npm install -g pm2"
        exit 1
    fi
fi

# 检查fail2ban是否安装
if ! command -v fail2ban-client &> /dev/null; then
    echo -e "${YELLOW}警告: 没有找到fail2ban-client。${NC}"
    echo "在Ubuntu上，你可以使用: sudo apt-get install fail2ban"
    echo -e "${RED}fail2ban未安装，无法在真实模式下运行Anubis！${NC}"
    read -p "继续设置吗? (y/n): " continue_setup
    if [ "$continue_setup" != "y" ] && [ "$continue_setup" != "Y" ]; then
        exit 1
    fi
fi

# 创建日志目录
mkdir -p logs

# 确保.env文件存在
if [ ! -f .env ]; then
    echo -e "${YELLOW}未找到.env文件，正在从示例创建...${NC}"
    cp .env.example .env
    echo -e "${GREEN}已创建.env文件${NC}"
fi

# 安装依赖
echo -e "${YELLOW}正在安装依赖...${NC}"
npm ci

# 创建或更新pm2.json
if [ ! -f pm2.json ]; then
    echo -e "${YELLOW}未找到pm2.json文件，正在从示例创建...${NC}"
    cp pm2.json.example pm2.json
    echo -e "${GREEN}已创建pm2.json文件${NC}"
else
    echo -e "${GREEN}pm2.json文件已存在${NC}"
fi

# 设置真实环境变量
echo -e "${YELLOW}正在设置真实环境模式...${NC}"
# 检测操作系统类型并使用正确的sed语法
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (BSD) sed
    sed -i '' '/IS_MOCK=/d' .env
else
    # Linux (GNU) sed
    sed -i '/IS_MOCK=/d' .env
fi
echo "IS_MOCK=false" >> .env

# 提示用户设置端口
read -p "请输入服务端口 (默认: 1233): " port
port=${port:-1233}

# 更新端口设置
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (BSD) sed
    sed -i '' "s/\"PORT\":[^,]*/\"PORT\": $port/" pm2.json
else
    # Linux (GNU) sed
    sed -i "s/\"PORT\":[^,]*/\"PORT\": $port/" pm2.json
fi

echo -e "${GREEN}端口已设置为: $port${NC}"

# 询问用户是否要更改用户名和密码
read -p "是否需要更改用户名和密码? (y/n, 默认: n): " change_credentials
if [ "$change_credentials" = "y" ] || [ "$change_credentials" = "Y" ]; then
    read -p "请输入新用户名 (默认: admin): " username
    username=${username:-admin}
    
    read -p "请输入新密码 (默认: admin): " password
    password=${password:-admin}
    
    # 更新用户名和密码
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD) sed
        sed -i '' "s/\"USERNAME\":[^,]*/\"USERNAME\": \"$username\"/" pm2.json
        sed -i '' "s/\"PASSWORD\":[^,]*/\"PASSWORD\": \"$password\"/" pm2.json
    else
        # Linux (GNU) sed
        sed -i "s/\"USERNAME\":[^,]*/\"USERNAME\": \"$username\"/" pm2.json
        sed -i "s/\"PASSWORD\":[^,]*/\"PASSWORD\": \"$password\"/" pm2.json
    fi
    
    echo -e "${GREEN}用户名和密码已更新${NC}"
fi

# 启动PM2服务
echo -e "${YELLOW}正在启动Anubis服务...${NC}"
pm2 start pm2.json

# 保存PM2配置
echo -e "${YELLOW}正在保存PM2配置...${NC}"
pm2 save

# 输出访问信息
echo -e "${GREEN}Anubis服务已启动!${NC}"
echo -e "访问地址: ${YELLOW}http://$(hostname -I | awk '{print $1}'):$port${NC}"
echo -e "用户名: ${YELLOW}$(grep -o '"USERNAME":[^,]*' pm2.json | cut -d '"' -f 4)${NC}"
echo -e "密码: ${YELLOW}$(grep -o '"PASSWORD":[^,]*' pm2.json | cut -d '"' -f 4)${NC}"
echo ""
echo -e "${YELLOW}PM2常用命令:${NC}"
echo "查看日志: pm2 logs anubis"
echo "重启服务: pm2 restart anubis"
echo "停止服务: pm2 stop anubis"
echo "启动服务: pm2 start anubis"
echo "===================="