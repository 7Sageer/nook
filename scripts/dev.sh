#!/bin/bash
# Nook 开发模式启动脚本
# 在开发模式下也注入版本信息

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 读取版本信息
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 颜色输出
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}开发模式版本信息:${NC}"
echo -e "  Version:    ${YELLOW}${VERSION}${NC}"
echo -e "  BuildTime:  ${YELLOW}${BUILD_TIME}${NC}"
echo -e "  GitCommit:  ${YELLOW}${GIT_COMMIT}${NC}"
echo ""

# 构建 ldflags
LDFLAGS="-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}' -X 'main.GitCommit=${GIT_COMMIT}'"

# 启动开发模式
wails dev -ldflags "$LDFLAGS"
