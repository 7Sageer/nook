# Nook

<p align="center">
  <img src="logo.png" alt="Nook Logo" width="120">
</p>

<h3 align="center">Write. Gather. Connect.</h3>

<p align="center">
  The missing memory layer for your AI workflow. <br/>
  Nook is a local-first knowledge base that indexes your files and feeds them to <b>Raycast</b>,  <b>Claude</b> or other agents via MCP.
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#why-nook">Why Nook?</a> •
  <a href="#installation">Installation</a> •
  <a href="#license">License</a>
</p>

<br/>

## Key Features

- 🗂️ **Filesystem as First-Class Citizen** - Nook *mounts* your folders rather than importing them. Your files stay exactly where they are—Nook only indexes, never copies.
- 🌐 **Web Archiver** - Paste a URL, and Nook saves the *content*, not just the link. Permanent context for your AI.
- 🧠 **Local Semantic Search** - Powered by local vector embeddings. Search by meaning, not just keywords.
- 🔌 **AI-Ready Context (MCP)** - Acts as a [Model Context Protocol](https://modelcontextprotocol.io) server. Connect your local knowledge directly to Cursor, Raycast, and Claude Desktop.
- 🔒 **100% Local & Private** - Built with Wails (Go). No cloud servers, no data sniffing. Your data stays on your disk.
- 📝 **Modern Block Editor** - A clean, Notion-like writing experience for when you need to capture thoughts.


## Why Nook?

Most knowledge bases force you to move your data into their silo. Nook is different:
1.  **It Gathers:** It respects your existing file system.
2.  **It Connects:** It believes your notes should be readable by your AI agents.
3.  **It Stays Local:** It gives you the power of RAG without sending private docs to the cloud.

---

## Installation

### Prerequisites

- Go 1.21+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Optional Tools (For PDF/Doc Parsing)

To enable full-text indexing for binary files, install the following:

**macOS:**
```bash
brew install pandoc poppler

```

**Windows:**

```powershell
choco install pandoc poppler

```

**Linux (Debian/Ubuntu):**

```bash
sudo apt install pandoc poppler-utils

```

### Development

```bash
# Clone the repository
git clone https://github.com/7Sageer/nook.git
cd nook

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start the app in dev mode
wails dev

```

### Build Distribution

```bash
wails build

```

### macOS First Run

Since the app is not signed with an Apple Developer certificate, macOS may block it from running. Use one of the following methods:

**Option 1: Right-click to Open**
1. Locate Nook.app in Finder
2. Hold `Control` and click the app icon
3. Select "Open"
4. Click "Open" again in the dialog

**Option 2: Remove Quarantine Attribute (Recommended)**
```bash
xattr -cr /Applications/Nook.app
```

After this, the app will open normally.

## Usage Guide

### 🤖 Connecting to AI (MCP)

You can run Nook as an MCP server locally. To use Nook with **Claude Desktop** or **Raycast**:

1. Open Nook Settings -> MCP Integration.
2. Copy the configuration JSON.
3. Paste it into your `claude_desktop_config.json` or Raycast MCP settings.

### 📝 Core Workflow

1. **Gather:** Mount your project folders, PDF library and bookmarks from internet into Nook. (Files are indexed in place, not copied.)
2. **Write:** Use the block editor to comment and capture your thoughts.
3. **Index:** Nook will silently generate vector embeddings in the background.
4. **Connect:** Open Raycast/Cursor and ask: *"Summarize the architecture document I added to Nook yesterday."*

## License

This project is licensed under the [GNU AGPL v3](https://www.google.com/search?q=LICENSE).

---

<p align="center">Made with ❤️ by <a href="https://github.com/7Sageer">7Sageer</a></p>