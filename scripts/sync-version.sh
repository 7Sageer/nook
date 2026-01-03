#!/bin/bash
# 同步版本号到 wails.json
# 从 git tag 读取版本号并更新 wails.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

# 读取版本号
VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")

echo -e "${BLUE}同步版本号:${NC} ${YELLOW}${VERSION}${NC}"

# 检查是否安装了 jq
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}警告: 未安装 jq，使用 sed 更新版本号${NC}"
    # 使用 sed 更新版本号
    sed -i.bak "s/\"productVersion\": \".*\"/\"productVersion\": \"${VERSION}\"/" wails.json
    rm wails.json.bak
else
    # 使用 jq 更新版本号
    jq ".info.productVersion = \"${VERSION}\"" wails.json > wails.json.tmp
    mv wails.json.tmp wails.json
fi

echo -e "${GREEN}✓${NC} wails.json 版本号已更新为 ${YELLOW}${VERSION}${NC}"
