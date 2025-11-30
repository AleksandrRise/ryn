# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ryn**: AI-powered SOC 2 compliance scanner. Detects violations via hybrid regex+LLM analysis, generates fixes via Grok.

**Stack**: Tauri 2.0 (Rust) + Next.js 16 (React 19) + SQLite + Grok Code Fast 1

## Commands

```bash
pnpm install                        # Install deps
pnpm tauri dev                      # Dev with hot-reload
./run-ryn-dev.sh                    # Loads .env, waits for Next.js, runs tauri dev

pnpm build && pnpm tauri build      # Production build
cd src-tauri && cargo test          # Rust tests (660 total)
cd src-tauri && cargo test <name>   # Single test
pnpm test                           # Frontend (Vitest)
pnpm lint                           # ESLint
cd src-tauri && cargo clippy -- -D warnings
```

**Requires**: `XAI_API_KEY` in `.env` for AI features. Rust changes need tauri dev restart.

## Architecture

### IPC Flow
React → `lib/tauri/commands.ts` → `invoke()` → Rust → JSON

**Convention**: snake_case params in Rust (`project_id`), camelCase in TS. Transformers in `lib/tauri/transformers.ts` handle conversion.

### Tauri Commands (40 registered in main.rs)
- **Project (6)**: select_project_folder, create_project, get_projects, delete_project, delete_all_projects, read_file_content
- **Scan (8)**: detect_framework, scan_project, watch_project, stop_watching, get_scan_progress, get_scans, respond_to_cost_limit, cancel_scan
- **Violation (3)**: get_violations, get_violation, dismiss_violation
- **Fix (2)**: generate_fix, apply_fix
- **Audit (1)**: get_audit_events
- **Settings (6)**: get_settings, update_settings, clear_database, export_data, complete_onboarding, check_api_key_available
- **Analytics (2)**: get_scan_costs, get_scan_cost
- **Logger (1)**: log_frontend_message
- **GitHub (11)**: start_github_oauth, poll_github_oauth, check_github_connection, disconnect_github, fetch_github_repos, get_github_repos, track_repo, untrack_repo, get_tracked_repos, check_repo_for_changes, scan_github_repo

### SOC 2 Rules (src-tauri/src/rules/)
| Rule | File | Detects |
|------|------|---------|
| A1.2 | a1_2_resilience.rs | Missing error handling, timeouts, retries |
| CC6.1 | cc6_1_access_control.rs | Missing auth/permission checks |
| CC6.7 | cc6_7_secrets.rs | Hardcoded secrets, API keys |
| CC7.2 | cc7_2_logging.rs | Missing audit logging |

### Database (7 tables, v3 schema)
`projects`, `scans`, `violations`, `fixes`, `audit_events`, `settings`, `scan_costs`, `github_repos`, `tracked_repos`

Key fields on violations: `detection_method` (regex/llm/hybrid), `confidence_score`, `llm_reasoning`, `function_name`, `class_name`

### State (Zustand stores in lib/stores/)
- `useProjectStore` - selected project, persisted to localStorage
- `useScanHistoryStore` - scan history panel prefs
- `useDashboardChartStore` - chart prefs

### Caching (lib/hooks/useTauriCache.ts)
Global TTL cache (5s) for IPC results. Invalidate with `invalidateTauriCache(key)` or `invalidateTauriCacheByCommand(cmd)`.

## Module Structure
```
src-tauri/src/
├── commands/       # 40 Tauri IPC commands
├── rules/          # 4 SOC 2 rule engines
├── scanner/        # Framework detection, file selection
├── fix_generator/  # Grok API client
├── db/             # SQLite, migrations v0→v3
└── security/       # Path validation

lib/
├── tauri/          # commands.ts, transformers.ts
├── stores/         # Zustand stores
├── hooks/          # useTauriCache, useFileWatcher
├── types/          # Domain types
└── utils/          # cn(), error-handler.ts

components/         # Feature-first: dashboard/, scan/, violation/, settings/, ui/
```

## Adding Features

**New SOC 2 Rule**: Create `rules/your_rule.rs` with `analyze()` → add to `rules/mod.rs` → call from `scan.rs`

**New Tauri Command**: Add `#[tauri::command]` in commands/ → register in `main.rs` → add TS wrapper in `lib/tauri/commands.ts`

## Conventions
- Filenames: kebab-case. Components: PascalCase. Variables: camelCase
- Styling: Tailwind + `cn()` for class merging
- Components split into hooks (data) + UI (presentation)
- Frontend tests mock Tauri invokes

## Key Instructions
- Use Context7 for docs
- Commit frequently
- For large analysis: `gemini -p "@src/ ..."`
