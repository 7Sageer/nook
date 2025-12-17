# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nostalgia is a local-first note-taking desktop application built with Wails (Go backend + React/TypeScript frontend). It uses BlockNote as the rich text editor and stores documents as JSON files locally.

## Development Commands

```bash
# Run in development mode with hot reload
wails dev

# Build production binary
wails build

# Frontend only (from frontend/ directory)
cd frontend && npm run dev      # Vite dev server
cd frontend && npm run build    # Build frontend
```

## Architecture

### Backend (Go)

- `main.go` - Application entry point, Wails configuration, native menu setup, macOS file association handling
- `app.go` - Main App struct exposing methods to frontend via Wails bindings:
  - Document CRUD: `GetDocumentList`, `CreateDocument`, `DeleteDocument`, `RenameDocument`
  - Content: `LoadDocumentContent`, `SaveDocumentContent`
  - External files: `OpenExternalFile`, `SaveExternalFile`, `LoadExternalFile`
  - Markdown: `ImportMarkdownFile`, `ExportMarkdownFile`
  - Search: `SearchDocuments`
  - Settings: `GetSettings`, `SaveSettings`

- `internal/` packages:
  - `document/` - Repository (metadata/index) and Storage (content) for documents
  - `search/` - Full-text search across documents
  - `settings/` - User preferences persistence
  - `markdown/` - Import/export markdown files via native dialogs
  - `constant/` - Centralized strings for menus, dialogs, labels

### Frontend (React/TypeScript)

- `App.tsx` - Main component orchestrating editor, sidebar, and state
- `components/` - UI components (Editor, Sidebar, Header, DocumentList, ConfirmModal)
- `hooks/` - Custom hooks:
  - `useDocuments` - Document list state and CRUD operations
  - `useExternalFile` - External file editing mode
  - `useImportExport` - Markdown import/export
  - `useMenuEvents` - Native menu event listeners
  - `useSearch` - Document search
- `contexts/ThemeContext.tsx` - Light/dark theme management
- `constants/strings.ts` - All UI strings centralized
- `types/document.ts` - TypeScript interfaces matching Go structs

### Data Storage

All data stored in `~/.nostalgia/`:
- `index.json` - Document metadata and active document ID
- `documents/{uuid}.json` - Individual document content (BlockNote JSON format)
- `settings.json` - User preferences

### Frontend-Backend Communication

- Wails generates TypeScript bindings in `frontend/wailsjs/go/main/App.ts`
- Events via `EventsEmit`/`EventsOn` for menu actions and file open notifications
- Frontend emits `app:frontend-ready` to signal readiness for deferred file opens

## Key Patterns

- Strings are externalized: Go strings in `internal/constant/strings.go`, frontend strings in `frontend/src/constants/strings.ts`
- Document content is BlockNote JSON blocks, converted to/from Markdown for import/export
- External file mode allows editing .md/.txt files outside the app's document store
- macOS file associations configured in `wails.json` for .md and .txt files
