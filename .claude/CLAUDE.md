# CLAUDE.md (Condensed)

## Project Overview

**Ryn**: AI-powered SOC 2 compliance tool that scans application code for violations (missing audit logs, weak access controls, hardcoded secrets, error handling issues) and generates one-click fixes via Claude.

**Tech Stack**: Tauri 2.0 (Rust backend) + Next.js 16.0.1 (React 19) + SQLite + Claude Haiku 4.5

**Status**:
- ✅ Complete backend (20 Tauri commands), hybrid scanning (regex + LLM), cost tracking, full UI, database with migrations
- ✅ 660 Rust tests passing (457 library + 200 integration + 3 doctests, 0 ignored)
- ✅ Tree-sitter enriches violations with code context
- ✅ File watcher fully integrated with graceful shutdown mechanism (all tests passing)
- ✅ Fix generation uses ClaudeClient with real Claude Haiku 4.5 API integration
- ✅ All doctests fixed and passing

## Development

### Commands
```bash
pnpm install                # Install dependencies
pnpm tauri dev             # Run with hot-reload (recommended)
pnpm build && pnpm tauri build  # Production build

# Testing
cd src-tauri && cargo test  # Backend tests (660 total: 457 library + 200 integration + 3 doctests)
pnpm test                   # Frontend unit tests
pnpm test:coverage          # Frontend tests with coverage
pnpm test:e2e               # End-to-end tests

# Code quality
pnpm lint && pnpm prettier --check "**/*.{ts,tsx}"
cd src-tauri && cargo fmt && cargo clippy -- -D warnings
```

**Requirements**: 
- Set `ANTHROPIC_API_KEY` in `.env` for fix generation
- Rust changes require restart of `pnpm tauri dev`

## Architecture

### Core Patterns

**IPC Communication**: React → `lib/tauri/commands.ts` → `invoke()` → Rust commands → JSON response
- Use snake_case convention (e.g., `project_id`, not `projectId`)

**Hybrid Scanning** (3 modes):
- `regex_only`: Free pattern matching only
- `smart`: AI analyzes security-critical files (~30-40%)
- `analyze_all`: AI analyzes all files

**Detection Methods**: Violations tagged as "regex", "llm", or "hybrid" (found by both)

**Database**: 
- Singleton connection via `once_cell::Lazy`
- 8 tables with v2 migration system
- All queries use parameterized statements

### Module Structure
```
src-tauri/src/
├── commands/       # 20 Tauri IPC commands
├── rules/          # 4 SOC 2 rule engines (regex-based)
├── scanner/        # Framework detection, file selection
├── fix_generator/  # Claude API integration
├── db/            # Database layer with migrations
└── security/      # Path validation

app/               # Next.js pages
components/        # React components
lib/tauri/        # TypeScript command wrappers
```

## Adding Features

### New SOC 2 Rule
1. Create `src-tauri/src/rules/your_rule.rs` with `analyze()` method
2. Add to `rules/mod.rs` 
3. Call from `scan.rs` in `run_all_rules()`

### New Tauri Command
1. Define in command module with `#[tauri::command]`
2. Register in `main.rs` 
3. Add TypeScript wrapper in `lib/tauri/commands.ts`

## Security
- Path traversal protection via `validate_project_path()`
- System directories blocked (`/etc`, `/usr`, etc.)
- Parameterized SQL queries

## Known Issues
- Frontend E2E tests mock Tauri IPC instead of calling backend

## Key Instructions
- Verify implementations before claiming features work
- Use Context7 for documentation
- Commit frequently
- For large context analysis, use `gemini -p` CLI
  -Core Strategy: Use Gemini CLI (1M+ token context) for reading/analyzing large codebases, Claude Code for editing/implementing Syntax: gemini -p "@src/ @tests/ Analyze architecture" - use @ to include files/directories When to Use: Analyzing >100KB files, entire codebases, checking if features are implemented, understanding project-wide patterns Key Advantage: Gemini consumes ~1% context per query vs Claude's ~10%; instant codebase understanding without file-by-file analysis. Limitations: Gemini is lazy for detailed planning (300 lines vs Claude's 1500); adds excessive code comments; free tier rate limited. gemini might also say wrong stuff because of its knowledge cutoff date, which might result in outdated perspectives. gemini is also not as good at coding as you. 