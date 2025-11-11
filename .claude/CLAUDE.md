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

### Tauri Desktop App

```bash
# Install dependencies
pnpm install

# Run Next.js dev server (http://localhost:3000)
pnpm dev

# Run Tauri desktop app
pnpm tauri dev

# Build production
pnpm build              # Next.js
pnpm tauri build        # Desktop app

# Lint
pnpm lint
```

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

## Critical Issues

1. **TypeScript Errors Ignored**: `next.config.mjs` has `ignoreBuildErrors: true`
2. **Missing Rust Dependency**: Add `chrono` to `src-tauri/Cargo.toml`
3. **Backend Not Implemented**: All Tauri commands in `main.rs` are TODO stubs returning mock data
4. **No Tests**: Testing infrastructure missing

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
- serde, serde_json
- **Missing**: chrono (referenced in code)

## Testing

No testing framework configured. Need to add:
- Vitest for React components
- Playwright/Cypress for E2E
- Rust unit tests in src-tauri

## Quick Start

```bash
# Install dependencies
pnpm install

# Add missing Rust dependency
cargo add chrono --manifest-path src-tauri/Cargo.toml

# Run Tauri desktop app
pnpm tauri dev
```

## Documentation

- `/ryn-stack`: Comprehensive market research on SOC 2 compliance landscape (750KB)
- `/ryn-sum`: One-paragraph product pitch
- `README.md`: Empty (needs content)
