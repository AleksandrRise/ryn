# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ryn** is an AI-powered SOC 2 compliance tool that scans application code for violations and generates one-click fixes via Claude. Unlike infrastructure monitoring tools (Vanta, Drata), Ryn scans actual application code for missing audit logs, weak access controls, hardcoded secrets, and error handling issues.

**Tech Stack**: Tauri 2.0 (Rust backend) + Next.js 16 (React 19 frontend) + SQLite + Claude API + LangGraph

**Current Implementation Status**:
- ✅ Full backend: 14 Tauri commands, 4 SOC 2 rule engines, database layer, Claude API integration
- ✅ Complete UI: Dashboard, scan results, violation details, audit trail, settings
- ⚠️ Known runtime issue: Database connection leak causing scan failures on real projects
- ❌ File watcher: Implemented but not integrated
- ❌ LangGraph: TypeScript agent exists but disconnected from Rust backend

## Development Commands

### Essential Commands

```bash
# Install all dependencies
pnpm install

# Run development server (recommended)
pnpm tauri dev              # Launches Tauri window with hot-reload

# Frontend only (for UI work)
pnpm dev                    # Next.js at http://localhost:3000

# Production build
pnpm build                  # Next.js static export
pnpm tauri build            # Desktop app bundle (macOS .dmg, Windows .msi, Linux .AppImage)

# Code quality
pnpm lint                   # ESLint
pnpm prettier --check "**/*.{ts,tsx}"   # Format check
cd src-tauri && cargo fmt   # Rust formatting
cd src-tauri && cargo clippy -- -D warnings   # Rust linting
```

### Testing

```bash
# Rust backend tests (44 source files, 280+ tests)
cd src-tauri && cargo test              # All tests
cargo test test_name                     # Single test
cargo test --package ryn --lib           # Library tests only

# Frontend tests
pnpm vitest                             # Run all Vitest tests
pnpm vitest --ui                        # Visual test UI
pnpm vitest run path/to/test.ts         # Single test file
```

### Important Notes

- **Rust changes require restart**: Modifications to `src-tauri/src/*.rs` require stopping and restarting `pnpm tauri dev`
- **Database location**: `./data/ryn.db` by default (override with `RYN_DATA_DIR` environment variable)
- **MCP plugin**: Only enabled in debug builds at `/tmp/tauri-mcp.sock`
- **API key required**: Set `ANTHROPIC_API_KEY` in `.env` for fix generation to work
- **Next.js static export**: `next.config.mjs` uses `output: 'export'` - required for Tauri bundling

### Environment Variables

```bash
# Required for fix generation
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional: Custom database location
RYN_DATA_DIR=/path/to/data/dir   # Defaults to ./data
```

## Architecture

### Critical Design Patterns

**1. Frontend-Backend Communication (Tauri IPC)**

All communication flows through Tauri's IPC system with strict type safety:

```
React Component → lib/tauri/commands.ts → invoke("command_name") →
Rust src-tauri/src/commands/*.rs → Database/Scanner/Rules →
JSON Response → TypeScript interfaces
```

**snake_case convention**: Rust uses `project_id: i64`, TypeScript uses `project_id: number` (NOT `projectId`). Tauri serializes both correctly.

**2. Scanning Architecture**

```
User clicks "Scan" → scan_project() command →
├─ Walks directory (walkdir crate)
├─ Skips node_modules, .git, etc
├─ Detects language (Python/JS/TS)
├─ Runs 4 rule engines in parallel:
│  ├─ CC6.1: Access Control (missing @login_required, auth middleware)
│  ├─ CC6.7: Secrets (hardcoded passwords, API keys, tokens)
│  ├─ CC7.2: Logging (missing audit logs on sensitive ops)
│  └─ A1.2: Resilience (missing error handling, timeouts)
├─ Stores violations in SQLite
├─ Emits progress events (scan-progress) every 10 files
└─ Returns Scan object with severity counts
```

**Rule Engine Pattern**: Each rule in `src-tauri/src/rules/*.rs` exposes `analyze(code, file_path, scan_id) -> Result<Vec<Violation>>`. Rules use regex patterns, NOT AST parsing (tree-sitter exists but unused by rules).

**3. Database Layer**

- **Connection management**: `db::init_db()` called once in `main.rs`, but **every command re-initializes** (causes connection leak - known bug)
- **Schema**: 7 tables (projects, scans, violations, fixes, audit_events, controls, settings)
- **Migrations**: Executed on first run via `migrations.rs:run_migrations()`
- **Indexes**: B-tree indexes on foreign keys and status fields for performance

**4. Fix Generation Flow**

```
User clicks "Generate Fix" → generate_fix(violation_id) →
├─ Fetch violation from DB
├─ Get control requirements from controls table
├─ Build Claude prompt with:
│  ├─ File context (surrounding lines)
│  ├─ Framework info (Django/Flask/Express)
│  ├─ SOC 2 control requirements
│  └─ Original code snippet
├─ Call Claude API (Haiku model, prompt caching enabled)
├─ Parse response for fixed_code + explanation
├─ Validate fix (line-level check only)
└─ Store in fixes table with trust_level="review"

User clicks "Apply Fix" → apply_fix(fix_id) →
├─ Read original file
├─ Apply string replacement (exact match)
├─ Write file to disk
├─ Git operations:
│  ├─ Check repo is clean
│  ├─ Stage changed file
│  ├─ Create commit with message
│  └─ Store commit SHA in fixes.git_commit_sha
└─ Update violation.status = "fixed"
```

**Rate Limiting**: Claude API calls limited to 50 requests/minute (configurable in `rate_limiter.rs`)

### Module Organization

```
src-tauri/src/
├── commands/           # 14 Tauri IPC command handlers
│   ├── project.rs      # select_project_folder, create_project, get_projects
│   ├── scan.rs         # detect_framework, scan_project, get_scan_progress, get_scans
│   ├── violation.rs    # get_violations, get_violation, dismiss_violation
│   ├── fix.rs          # generate_fix, apply_fix (Claude API integration)
│   ├── audit.rs        # get_audit_events
│   └── settings.rs     # get_settings, update_settings, clear_database, export_data
├── rules/              # 4 SOC 2 compliance rule engines
│   ├── cc6_1_access_control.rs
│   ├── cc6_7_secrets.rs
│   ├── cc7_2_logging.rs
│   └── a1_2_resilience.rs
├── scanner/            # Code analysis infrastructure
│   ├── framework_detector.rs   # Detects Django/Flask/Express/Next.js
│   ├── file_watcher.rs         # notify-based file watching (NOT INTEGRATED)
│   ├── tree_sitter_utils.rs    # AST parsing (exists but rules don't use it)
│   ├── python_scanner.rs       # STUB ONLY
│   └── javascript_scanner.rs   # STUB ONLY
├── fix_generator/
│   ├── claude_client.rs        # Anthropic API client with streaming
│   └── (fix_applicator merged into commands/fix.rs)
├── git/
│   └── operations.rs           # git2-based operations (commit, clean check)
├── db/
│   ├── schema.sql              # SQLite schema with 7 tables
│   ├── migrations.rs           # Auto-apply migrations on startup
│   └── queries.rs              # CRUD operations with parameterized SQL
├── security/
│   └── path_validation.rs      # Prevents path traversal, blocks system dirs
├── rate_limiter.rs             # Token bucket rate limiting for Claude API
└── main.rs                     # Entry point, registers all commands
```

### Frontend Architecture

```
app/                    # Next.js 16 App Router
├── page.tsx           # Dashboard with compliance score
├── scan/page.tsx      # Violations table with filters
├── violation/[id]/    # Violation detail + fix generation
├── audit/page.tsx     # Audit trail timeline
└── settings/page.tsx  # Framework config, database management

components/
├── scan/
│   └── scan-results.tsx       # Main scanning UI (line 179 calls scan_project)
├── violation/
│   └── fix-generator.tsx      # AI fix UI with diff viewer
└── ui/                         # 90+ shadcn/ui components

lib/
├── tauri/commands.ts           # TypeScript wrappers for all 14 Tauri commands
├── types/                      # TypeScript interfaces matching Rust models
├── langgraph/
│   ├── agent.ts                # LangGraph state machine (NOT USED BY BACKEND)
│   ├── prompts.ts              # SOC 2 prompt templates
│   └── types.ts
└── utils/error-handler.ts      # Centralized Tauri error handling
```

## Critical Known Issues

### 1. Database Connection Leak (Causes Runtime Errors)

**Symptom**: `[Tauri Error] {}` when scanning real projects

**Root Cause**: Every command calls `db::init_db()`, creating new SQLite connections without cleanup. Under load, this exhausts file descriptors.

**Location**: All command modules call `let conn = db::init_db().map_err(...)?;`

**Fix Required**: Implement connection pooling or use `once_cell::Lazy` for singleton connection

### 2. LangGraph Integration Incomplete

**Status**: TypeScript agent (`lib/langgraph/agent.ts`) is fully implemented with state machine, but Rust bridge (`src-tauri/src/langgraph/agent_runner.rs`) only returns mock responses.

**Impact**: Scanning works via direct rule engines, but the "LangGraph orchestration" mentioned in docs is non-functional.

### 3. File Watcher Not Integrated

**Status**: `src-tauri/src/scanner/file_watcher.rs` is implemented but never called by scan commands.

**Impact**: "Real-time compliance feedback" feature doesn't work - scans are manual only.

### 4. Weak Test Assertions

**Examples**:
- `commands/scan.rs:590`: `assert!(project.framework.is_some() || project.framework.is_none());` (always true)
- `commands/fix.rs:378`: `assert!(result.is_err() || result.is_ok());` (always true)

**Impact**: Tests pass but don't validate behavior. Needs audit and strengthening.

### 5. E2E Tests Are Fully Mocked

**Location**: `__tests__/e2e/workflow.test.ts` mocks all Tauri commands via `vi.mock("@tauri-apps/api/core")`

**Impact**: No integration tests that actually invoke Rust backend. Real project scanning is untested.

## CI/CD and Platform Support

### GitHub Actions Workflows

**test.yml** - Runs on push/PR to main:
- Frontend: TypeScript check, Vitest, Prettier formatting
- Backend: Rust fmt, clippy (with `-D warnings`), cargo test
- Integration: Full build test
- Security: cargo audit + npm audit

**release.yml** - Triggered on git tags (v*):
- Multi-platform builds: macOS (universal), Linux (x86_64), Windows (x86_64)
- Creates draft GitHub release with binaries

### Platform-Specific Requirements

**Linux Development**:
```bash
# Ubuntu/Debian dependencies for Tauri
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev
```

**macOS**: Xcode Command Line Tools required (`xcode-select --install`)

**Windows**: Visual Studio Build Tools required

## Common Development Tasks

### Adding a New SOC 2 Rule

1. Create `src-tauri/src/rules/your_rule.rs`:
```rust
pub struct YourRule;
impl YourRule {
    pub fn analyze(code: &str, file_path: &str, scan_id: i64) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();
        // Add regex patterns
        Ok(violations)
    }
}
```

2. Add to `src-tauri/src/rules/mod.rs`:
```rust
pub mod your_rule;
pub use your_rule::*;
```

3. Call from `src-tauri/src/commands/scan.rs` in `run_all_rules()` function

4. Add 15+ tests covering all violation patterns and false positives

### Adding a New Tauri Command

1. Define in appropriate command module (e.g., `src-tauri/src/commands/scan.rs`):
```rust
#[tauri::command]
pub async fn your_command(param: String) -> Result<YourType, String> {
    let conn = db::init_db().map_err(|e| format!("DB error: {}", e))?;
    // Implementation
    Ok(result)
}
```

2. Register in `src-tauri/src/main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    your_module::your_command,
])
```

3. Add TypeScript wrapper in `lib/tauri/commands.ts`:
```typescript
export async function your_command(param: string): Promise<YourType> {
  return await invoke<YourType>("your_command", { param })
}
```

4. Add interface to `lib/tauri/commands.ts` matching Rust struct

### Running Single Test

```bash
# Rust: Run specific test function
cd src-tauri && cargo test test_scan_detects_violations

# Rust: Run all tests in a module
cargo test --lib commands::scan::tests

# Rust: Run with output
cargo test -- --nocapture test_name

# Frontend: Run specific test file
pnpm vitest run __tests__/e2e/workflow.test.ts

# Frontend: Watch mode for single file
pnpm vitest watch path/to/test.ts
```

### Debugging

```bash
# Rust: Enable detailed logging
RUST_LOG=debug pnpm tauri dev

# Check database directly
sqlite3 ./data/ryn.db "SELECT * FROM violations LIMIT 10;"

# View Tauri devtools
# In dev mode: Right-click app → Inspect Element

# Test API key
echo $ANTHROPIC_API_KEY
```

## Security Considerations

- **Path Traversal Protection**: All file operations validated via `security::path_validation::validate_project_path()`
- **System Directory Blocking**: Cannot scan `/`, `/etc`, `/usr`, `/bin`, `/var`, etc.
- **SQL Injection**: All queries use parameterized statements (`?` placeholders)
- **Command Injection**: Git operations use `git2` library (no shell execution)
- **API Key Storage**: Read from environment variables only, never stored in database

## Documentation Resources

- **Master Plan**: `rynspec/ryn-master-plan.md` - Complete 20-day implementation plan (1354 lines)
- **README**: `README.md` - User-facing documentation
- **Schema**: `src-tauri/src/db/schema.sql` - Complete database structure
- **Context7 Docs**: Store in `.claude/docs/` (do not add redundant files)

## User Instructions

- Make granulated, unambiguous todo lists
- Use Context7 to fetch documentation (never guess/assume)
- Commit often
- Be grounded in reality - verify implementations before claiming features work
