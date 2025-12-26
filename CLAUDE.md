# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nook is a local-first note-taking desktop application built with Wails (Go backend + React/TypeScript frontend). It uses BlockNote as the rich text editor and stores documents as JSON files locally. Documents can be organized into folders with drag-and-drop reordering.

**Key dependencies:**
- Go 1.23+, Wails v2
- BlockNote (rich text editor), Mantine (UI components)
- dnd-kit (drag-and-drop), Framer Motion (animations)

## Development Commands

```bash
# Run in development mode with hot reload
wails dev

# Build production binary
wails build

# Frontend only (from frontend/ directory)
cd frontend && npm run dev      # Vite dev server
cd frontend && npm run build    # Build frontend

# Build MCP server (for Claude Code integration)
go build -o nook-mcp ./cmd/mcp-server
```

Note: No test suite is currently configured.

## Architecture

### Backend (Go)

- `main.go` - Application entry point, Wails configuration, native menu setup, macOS file association handling
- `app.go` - Main App struct exposing methods to frontend via Wails bindings:
  - Document CRUD: `GetDocumentList`, `CreateDocument`, `DeleteDocument`, `RenameDocument`, `SetActiveDocument`
  - Content: `LoadDocumentContent`, `SaveDocumentContent`
  - Folders: `GetFolders`, `CreateFolder`, `DeleteFolder`, `RenameFolder`, `SetFolderCollapsed`, `MoveDocumentToFolder`
  - Reordering: `ReorderDocuments`, `ReorderFolders`
  - External files: `OpenExternalFile`, `SaveExternalFile`, `LoadExternalFile`
  - Markdown: `ImportMarkdownFile`, `ExportMarkdownFile`
  - Search: `SearchDocuments`
  - Settings: `GetSettings`, `SaveSettings`

- `internal/` packages:
  - `document/` - Repository (metadata/index) and Storage (content) for documents
  - `folder/` - Folder repository for organizing documents
  - `search/` - Full-text search across documents
  - `settings/` - User preferences persistence
  - `markdown/` - Import/export markdown files via native dialogs
  - `constant/` - Centralized strings for menus, dialogs, labels

- `cmd/mcp-server/` - MCP (Model Context Protocol) server for Claude Code integration:
  - Exposes document, folder, tag, and search tools via JSON-RPC over stdio
  - Reuses `internal/` packages to access the same data store as the main app

### Frontend (React/TypeScript)

- `App.tsx` - Main component orchestrating editor, sidebar, and state
- `components/` - UI components (Editor, Sidebar, Header, DocumentList, FolderItem, ConfirmModal, WindowToolbar)
- `contexts/`
  - `DocumentContext.tsx` - Centralized state management for documents and folders (CRUD, reordering, content loading/saving)
  - `ThemeContext.tsx` - Light/dark theme management
- `hooks/` - Custom hooks:
  - `useDocuments` - Document list state and CRUD operations
  - `useFolders` - Folder management (create, delete, rename, collapse, reorder)
  - `useExternalFile` - External file editing mode
  - `useImportExport` - Markdown import/export
  - `useMenuEvents` - Native menu event listeners
  - `useAppEvents` - File open events and save handling
  - `useSearch` - Document search
  - `useEditor` - BlockNote editor instance management
  - `useTitleSync` - Sync document title with first H1 block
  - `useH1Visibility` - Track H1 visibility for header title display
- `constants/strings.ts` - All UI strings centralized
- `types/document.ts` - TypeScript interfaces matching Go structs

### Data Storage

All data stored in `~/.Nook/`:
- `index.json` - Document metadata, folder assignments, and active document ID
- `folders.json` - Folder metadata (id, name, order, collapsed state)
- `documents/{uuid}.json` - Individual document content (BlockNote JSON format)
- `settings.json` - User preferences

### Frontend-Backend Communication

- Wails generates TypeScript bindings in `frontend/wailsjs/go/main/App.ts`
- Events via `EventsEmit`/`EventsOn` for menu actions and file open notifications
- Event naming conventions:
  - `menu:*` - Native menu actions (e.g., `menu:new-document`, `menu:toggle-sidebar`)
  - `file:*` - File operations (e.g., `file:open-external`)
  - `app:*` - Application lifecycle (e.g., `app:frontend-ready`)
- Frontend emits `app:frontend-ready` to signal readiness for deferred file opens

## Key Patterns

- **Centralized state**: Use `DocumentContext` for all document/folder operations; components consume via `useDocumentContext()`
- **Strings externalized**: Go strings in `internal/constant/strings.go`, frontend strings in `frontend/src/constants/strings.ts`
- **Document content**: BlockNote JSON blocks, converted to/from Markdown for import/export
- **External file mode**: Allows editing .md/.txt files outside the app's document store
- **Drag-and-drop**: Documents and folders support reordering via drag-and-drop
- **macOS file associations**: Configured in `wails.json` for .md and .txt files
