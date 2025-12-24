# Development Commands

```bash
wails dev          # Dev mode with hot reload
wails build        # Production build
cd frontend && npm run dev   # Frontend dev server
cd frontend && npm run build # Frontend build
```

No test suite configured.

# Code Style

**Go:** Standard `go fmt`. Exported: PascalCase, private: camelCase. Check and return errors, don't swallow. Group related funcs with `// ========== Section Name ==========`. Externalize strings to `internal/constant/strings.go`. Use `internal/` for internal packages.

**TypeScript:** Strict mode enabled. Named exports. Hooks: `use` prefix + camelCase. Types: PascalCase. Centralize strings in `frontend/src/constants/strings.ts`. Use contexts (DocumentContext, ThemeContext) for state. NO comments unless user asks.

**Both:** Follow existing file structure. Use established libraries (BlockNote, Mantine, dnd-kit). Wails bindings in `frontend/wailsjs/go/main/App.ts`.
