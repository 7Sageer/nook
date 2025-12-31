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
NC='\033[0m' # No Color

echo -e "${BLUE}[1/3]${NC} 构建 Wails 应用..."
wails build

echo -e "${BLUE}[2/3]${NC} 构建 MCP 服务器..."
go build -o build/bin/nook-mcp ./cmd/mcp-server

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
