#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Anubis 依赖修复脚本${NC}"
echo "===================="

# 检查pnpm是否安装
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}未找到pnpm，正在尝试安装...${NC}"
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo -e "${RED}安装pnpm失败，请手动安装后再运行此脚本。${NC}"
        echo "npm install -g pnpm"
        exit 1
    fi
fi

# 修复jsonwebtoken的依赖问题
echo -e "${YELLOW}正在安装缺失的依赖...${NC}"
pnpm add jws@^3.2.2

# 修复所有jsonwebtoken依赖
echo -e "${YELLOW}正在安装所有jsonwebtoken依赖...${NC}"
pnpm add ms@^2.1.1 semver@^7.5.4 lodash.once@^4.0.0 lodash.includes@^4.3.0 \
  lodash.isnumber@^3.0.3 lodash.isstring@^4.0.1 lodash.isboolean@^3.0.3 \
  lodash.isinteger@^4.0.4 lodash.isplainobject@^4.0.6

# 重新安装所有依赖
echo -e "${YELLOW}重新安装所有依赖以确保完整性...${NC}"
rm -rf node_modules
pnpm install

echo -e "${GREEN}依赖修复完成，尝试重启服务...${NC}"
pm2 restart anubis

echo "===================="