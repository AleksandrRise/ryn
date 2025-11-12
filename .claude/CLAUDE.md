# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ryn** is an AI-powered SOC 2 compliance tool that scans application code for violations (missing audit logs, weak access controls, hardcoded secrets) and generates one-click fixes via AI.

**Current State**: Complete UI mockup with mock data. Backend Rust implementation needed.

## Technology Stack

- **Frontend**: Next.js 15.5.6 + React 19 + TypeScript + TailwindCSS
- **Backend**: Tauri 2.0 (Rust)
- **UI**: shadcn/ui + Radix UI components
- **Package Manager**: pnpm

## Development Commands

### Quick Start

```bash
# Install dependencies (runs once)
pnpm install

# Run Tauri desktop app with hot-reload (recommended for development)
pnpm tauri dev

# Build production (Next.js static export + Tauri bundle)
pnpm build              # Next.js static export
pnpm tauri build        # Desktop app bundle

# Development only
pnpm dev                # Next.js dev server (http://localhost:3000) - separate from Tauri
pnpm lint               # Run ESLint
```

### Tauri Development Notes

- `pnpm tauri dev` runs Next.js in static export mode and launches the Tauri window
- The Next.js dev server (`pnpm dev`) is separate and useful for isolated frontend testing
- MCP plugin is only enabled in debug builds and exposes a Unix socket at `/tmp/tauri-mcp.sock`
- Rebuild Rust code: changes to `src-tauri/src/*.rs` require restarting `pnpm tauri dev`

## Architecture

### Project Structure

```
app/
├── layout.tsx                  # Root layout with dark theme
├── globals.css                 # Global styles
├── page.tsx                    # Dashboard (73% compliance score)
├── scan/page.tsx               # Violations table
├── violation/[id]/page.tsx     # Violation detail + AI fix
├── audit/page.tsx              # Audit trail & reports
└── settings/page.tsx           # Framework & scan config

components/
├── dashboard/                  # Compliance metrics, charts
├── scan/                       # Violation table, filters
├── violation/                  # Detail view, code preview, diff
├── audit/                      # Timeline, event cards
├── settings/                   # Framework, database, preferences
├── layout/                     # Top nav, sidebar
└── ui/                         # 90+ shadcn/ui components

lib/
├── types/                      # violation.ts, audit.ts, fix.ts
└── tauri/commands.ts           # IPC interfaces (TODO stubs)

src-tauri/src/main.rs          # Rust backend (placeholder commands)
```

### Key Entry Points

1. **Tauri Backend**: `src-tauri/src/main.rs` - All commands return mock data
2. **Frontend Root**: `app/layout.tsx` - Dark theme + water background
3. **Dashboard**: `app/page.tsx` - Main compliance view
4. **Types**: `lib/types/violation.ts` - Core data models

## Known Issues

1. **TypeScript Errors Ignored**: `next.config.mjs` has `ignoreBuildErrors: true` - TypeScript errors don't block builds but should be addressed
2. **Backend Stub Implementation**: All Tauri commands in `main.rs` are TODO stubs returning mock data
3. **No Test Framework**: Vitest, Playwright, and Rust unit tests are not configured
4. **Incorrect Package Name**: `package.json` lists `"name": "my-v0-project"` instead of `"ryn"`

## Key Features (Status)

- ✅ **UI Complete**: Dashboard, scan results, violation details, audit trail, settings
- ⏳ **Backend**: Placeholder commands need implementation
- ⏳ **Code Scanning**: Not implemented
- ⏳ **AI Fix Generation**: Not implemented
- ⏳ **Database**: SQLite plugin installed but unused

## Design System

- **Theme**: Dark only (pure black #000 background)
- **Typography**: Inter font, tabular numbers
- **Severity Colors**: Critical (red #ef4444), High (orange #f97316), Medium (yellow #eab308), Low (gray #525252)
- **Style**: Minimalist, brutalist aesthetic with animated water background

## Dependencies

### Frontend (package.json)
- Next.js 15.5.6, React 19, TypeScript 5
- 20+ Radix UI components, lucide-react icons
- react-hook-form + zod validation
- zustand (state), recharts (charts), sonner (toasts)
- TailwindCSS 4.1.9, class-variance-authority

### Backend (Cargo.toml)
- tauri 2.0, tauri-plugin-sql (SQLite), tauri-plugin-fs, tauri-plugin-dialog
- serde, serde_json, chrono (with serde support)
- tauri-plugin-mcp (local path)

## Testing

No testing framework configured. Need to add:
- Vitest for React components
- Playwright/Cypress for E2E
- Rust unit tests in src-tauri

## Frontend-Backend Communication

Tauri commands defined in `src-tauri/src/main.rs` are invoked from React via `lib/tauri/commands.ts`. Add new commands as follows:

1. Define the command in `src-tauri/src/main.rs`:
   ```rust
   #[tauri::command]
   fn my_command(param: String) -> Result<String, String> {
       // Implementation
       Ok(result)
   }
   ```

2. Register in `invoke_handler`:
   ```rust
   .invoke_handler(tauri::generate_handler![my_command])
   ```

3. Call from React:
   ```typescript
   import { invoke } from "@tauri-apps/api/core";
   const result = await invoke("my_command", { param: "value" });
   ```

Key plugins available:
- **tauri-plugin-sql**: SQLite database queries
- **tauri-plugin-dialog**: File/folder selection dialogs
- **tauri-plugin-fs**: File system operations
- **tauri-plugin-mcp** (dev-only): Unix socket server at `/tmp/tauri-mcp.sock`

## Documentation Storage

Per project guidelines, all context7 library documentation should be stored in `.claude/docs/` folder. Do not add redundant or unrelated files to this directory.

## Other Resources

- `/ryn-stack`: Comprehensive market research on SOC 2 compliance landscape (750KB)
- `/ryn-sum`: One-paragraph product pitch
- `README.md`: Empty (needs content)

- make granulated, unambiguous todo lists that aren't confusing and left up to multiple interpretations.
- use docs folder in .claude folder to always store documentation from context7. dont add any redundant files in docs.
- use context7 to fetch any documentation you might need in order to satisfy the "no
 guessing/assuming" doctrine
- commit often