# Nook

<p align="center">
  <img src="logo.png" alt="Nook Logo" width="120">
</p>

<p align="center">
  一个简洁优雅的本地笔记与知识库应用，支持语义搜索与知识图谱
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装部署">安装部署</a> •
  <a href="#使用指南">使用指南</a> •
  <a href="#许可证">许可证</a>
</p>

---

## 功能特性

- 📝 **Block 式编辑器** - 基于 BlockNote 的现代化编辑体验
- 🔍 **语义搜索** - 使用向量嵌入实现智能内容检索
- 🗂️ **本地文件集成** - 支持嵌入本地文件夹、文件和书签
- 🏷️ **标签系统** - 灵活的文档组织与分类
- 🌐 **知识图谱** - 可视化文档之间的语义关系
- 🌙 **深色/浅色主题** - 自动适应系统主题

## 安装部署

### 前置要求

- Go 1.21+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### 可选工具（增强功能）

安装以下工具可增强 PDF 和 DOCX 导入能力：

**macOS:**
```bash
brew install pandoc poppler
```

**Windows:**
```powershell
# 使用 Chocolatey
choco install pandoc poppler

# 或使用 Scoop
scoop install pandoc poppler
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install pandoc poppler-utils
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install pandoc poppler-utils
```

### 开发环境

```bash
# 克隆项目
git clone https://github.com/7Sageer/nook.git
cd nook

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动开发服务器
wails dev
```

### 构建发布版

```bash
wails build
```

构建产物会生成在 `build/bin/` 目录下。

## 使用指南

### 基本操作

1. **创建新笔记** - 点击侧边栏的 "+" 按钮或使用快捷键
2. **编辑内容** - 使用块编辑器，支持 Markdown 语法
3. **添加标签** - 在文档顶部添加标签进行分类
4. **搜索** - 使用顶部搜索栏进行全文或语义搜索

### 嵌入外部内容

- **文件夹** - 拖拽文件夹到编辑器中
- **文件** - 拖拽 PDF、Word 等文件
- **书签** - 使用 `/bookmark` 命令添加网页链接

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + N` | 新建文档 |
| `Cmd/Ctrl + F` | 搜索 |
| `Cmd/Ctrl + S` | 保存 |

## 许可证

本项目采用 [GNU AGPL v3](LICENSE) 许可证。

---

<p align="center">Made with ❤️ by <a href="https://github.com/7Sageer">7Sageer</a></p>
