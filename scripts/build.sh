#!/bin/bash
# Nook 构建脚本
# 构建主程序和 MCP 服务器，并打包到 .app 中

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 读取版本信息
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo -e "${BLUE}版本信息:${NC}"
echo -e "  Version:    ${YELLOW}${VERSION}${NC}"
echo -e "  BuildTime:  ${YELLOW}${BUILD_TIME}${NC}"
echo -e "  GitCommit:  ${YELLOW}${GIT_COMMIT}${NC}"
echo ""

# 构建 ldflags
LDFLAGS="-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}' -X 'main.GitCommit=${GIT_COMMIT}'"

# 同步版本号到 wails.json
echo -e "${BLUE}同步版本号到 wails.json...${NC}"
if command -v jq &> /dev/null; then
    jq ".info.productVersion = \"${VERSION}\"" wails.json > wails.json.tmp && mv wails.json.tmp wails.json
    echo -e "${GREEN}✓${NC} wails.json 已更新为 ${YELLOW}${VERSION}${NC}"
else
    echo -e "${YELLOW}警告: 未安装 jq，使用 sed 更新版本号${NC}"
    sed -i.bak "s/\"productVersion\": \"[^\"]*\"/\"productVersion\": \"${VERSION}\"/" wails.json && rm -f wails.json.bak
    echo -e "${GREEN}✓${NC} wails.json 已更新为 ${YELLOW}${VERSION}${NC}"
fi
echo ""

echo -e "${BLUE}[1/3]${NC} 构建 Wails 应用..."
wails build -ldflags "$LDFLAGS"

echo -e "${BLUE}[2/3]${NC} 构建 MCP 服务器..."
go build -ldflags "$LDFLAGS" -o build/bin/nook-mcp ./cmd/mcp-server

echo -e "${BLUE}[3/3]${NC} 打包 MCP 到 .app..."
if [[ -d "build/bin/Nook.app" ]]; then
    cp build/bin/nook-mcp "build/bin/Nook.app/Contents/Resources/nook-mcp"
    chmod +x "build/bin/Nook.app/Contents/Resources/nook-mcp"
    echo -e "${GREEN}✓${NC} MCP 已打包到 Nook.app/Contents/Resources/nook-mcp"
else
    echo "警告: Nook.app 不存在，MCP 二进制保留在 build/bin/nook-mcp"
fi

echo -e "${GREEN}构建完成!${NC}"
echo ""
echo "产物位置:"
echo "  - 主程序: build/bin/Nook.app"
echo "  - MCP:    build/bin/Nook.app/Contents/Resources/nook-mcp"
