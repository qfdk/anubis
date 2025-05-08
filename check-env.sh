#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Anubis 环境变量检查脚本${NC}"
echo "===================="

# 检查.env文件是否存在
if [ ! -f .env ]; then
    echo -e "${RED}错误: .env 文件不存在${NC}"
    exit 1
fi

# 读取并展示当前的用户名和密码配置
USERNAME=$(grep "^USERNAME=" .env | cut -d'=' -f2)
PASSWORD=$(grep "^PASSWORD=" .env | cut -d'=' -f2)
IS_MOCK=$(grep "^IS_MOCK=" .env | cut -d'=' -f2)

echo -e "${YELLOW}当前配置:${NC}"
echo -e "用户名: ${GREEN}$USERNAME${NC}"
echo -e "密码: ${GREEN}$PASSWORD${NC}"
echo -e "模拟模式: ${GREEN}$IS_MOCK${NC}"

# 询问是否需要更新用户名和密码
read -p "是否需要更新用户名和密码? (y/n): " update_credentials

if [ "$update_credentials" = "y" ] || [ "$update_credentials" = "Y" ]; then
    read -p "请输入新用户名 (默认: admin): " new_username
    new_username=${new_username:-admin}
    
    read -p "请输入新密码 (默认: admin): " new_password
    new_password=${new_password:-admin}
    
    # 更新.env文件中的用户名和密码
    # 检测操作系统类型并使用正确的sed语法
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD) sed
        sed -i '' "s/^USERNAME=.*/USERNAME=$new_username/" .env
        sed -i '' "s/^PASSWORD=.*/PASSWORD=$new_password/" .env
    else
        # Linux (GNU) sed
        sed -i "s/^USERNAME=.*/USERNAME=$new_username/" .env
        sed -i "s/^PASSWORD=.*/PASSWORD=$new_password/" .env
    fi
    
    echo -e "${GREEN}用户名和密码已更新${NC}"
    
    # 如果PM2正在运行，重启服务
    if command -v pm2 &> /dev/null && pm2 list | grep -q "anubis"; then
        echo -e "${YELLOW}重启Anubis服务...${NC}"
        pm2 restart anubis
    else
        echo -e "${YELLOW}请手动重启Anubis服务以应用新的配置${NC}"
    fi
fi

echo "===================="
echo -e "${GREEN}环境变量检查完成${NC}"