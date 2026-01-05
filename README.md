# Nook

<p align="center">
  <img src="logo.png" alt="Nook Logo" width="120">
</p>

<p align="center">
  Write. Gather. Connect.
  
  Nook is a local-first knowledge base that gathers your notes and files into one semantic memory for your own AI assistant.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage-guide">Usage Guide</a> •
  <a href="#license">License</a>
</p>

---

## Features

- 📝 **Block-based Editor** - Modern editing experience powered by BlockNote
- 🔍 **Semantic Search** - Intelligent content retrieval using vector embeddings
- 🗂️ **Local File Integration** - Support for embedding local folders, files, and bookmarks
- 🏷️ **Tagging System** - Flexible document organization and categorization
- 🌐 **Knowledge Graph** - Visualize semantic relationships between documents
- 🌙 **Dark/Light Mode** - Automatically adapts to system themes

## Installation

### Prerequisites

- Go 1.21+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Optional Tools (Enhanced Features)

Install the following tools to enhance PDF and DOCX import capabilities:

**macOS:**
```bash
brew install pandoc poppler
```

**Windows:**
```powershell
# Using Chocolatey
choco install pandoc poppler

# Or using Scoop
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

### Development Environment

```bash
# Clone the repository
git clone https://github.com/7Sageer/nook.git
cd nook

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start the development server
wails dev
```

### Build Distribution

```bash
wails build
```

The build output will be generated in the `build/bin/` directory.

## Usage Guide

### Basic Operations

1. **Create New Note** - Click the "+" button in the sidebar or use the shortcut.
2. **Edit Content** - Use the block editor, which supports Markdown syntax.
3. **Add Tags** - Add tags at the top of the document for categorization.
4. **Search** - Use the top search bar for full-text or semantic search.

### Embedding External Content

- **Folders** - Drag and drop folders into the editor.
- **Files** - Drag and drop PDF, Word, and other files.
- **Bookmarks** - Use the `/bookmark` command to add web links.

### Shortcuts

| Shortcut | Function |
|----------|----------|
| `Cmd/Ctrl + N` | New Document |
| `Cmd/Ctrl + F` | Search |
| `Cmd/Ctrl + S` | Save |

## License

This project is licensed under the [GNU AGPL v3](LICENSE).

---

<p align="center">Made with ❤️ by <a href="https://github.com/7Sageer">7Sageer</a></p>
