# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ryn** is an AI-powered SOC 2 compliance tool that scans application code for violations and generates one-click fixes via Claude. Unlike infrastructure monitoring tools (Vanta, Drata), Ryn scans actual application code for missing audit logs, weak access controls, hardcoded secrets, and error handling issues.

**Tech Stack**: Tauri 2.0 (Rust backend) + Next.js 16.0.1 (React 19 frontend) + SQLite + Claude Haiku 4.5 API

**Current Implementation Status**:
- ✅ **Complete Backend**: 20 Tauri commands fully implemented (not stubs)
- ✅ **Hybrid Scanning**: 3 modes (regex_only, smart, analyze_all) with detection method tracking
- ✅ **LLM Analysis**: Claude Haiku 4.5 integration with prompt caching, concurrent analysis (Semaphore 10), violation deduplication
- ✅ **Cost Tracking**: Real-time token usage, cost limits with user prompts, analytics dashboard
- ✅ **Complete UI**: Dashboard, scan results with detection badges, violation details, settings, analytics (uses real backend data, not mocks)
- ✅ **Database**: 8 tables with v2 migration system (detection_method, confidence_score, scan_costs)
- ✅ **Testing**: 454 Rust tests across 37 files, comprehensive rule engine coverage
- ❌ **File Watcher**: Implemented (`scanner/file_watcher.rs`) but not integrated into commands
- ❌ **LangGraph**: TypeScript agent exists but Rust bridge (`langgraph/agent_runner.rs`) returns mocks
- ❌ **Tree-sitter**: Implemented but rules use regex patterns instead

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
# Rust backend tests (454 tests across 37 files)
cd src-tauri && cargo test              # All tests
cargo test test_name                     # Single test by name
cargo test --lib commands::scan::tests  # All tests in a module
cargo test -- --nocapture               # Show println! output

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

**2. Hybrid Scanning Architecture**

**Three Scanning Modes** (configured in Settings):
- `regex_only`: Free, instant pattern matching only (no AI costs)
- `smart` (recommended): AI analyzes ~30-40% of files (security-critical code only)
- `analyze_all`: AI analyzes every file (maximum accuracy, higher cost)

**Scanning Flow** (scan.rs:179-295):

```
User clicks "Scan" → scan_project() command →
├─ Phase 1: Regex Detection
│  ├─ Walks directory (walkdir crate, skips node_modules/.git)
│  ├─ Runs 4 rule engines in parallel (rayon)
│  ├─ Stores violations with detection_method="regex"
│  └─ Returns early if mode == "regex_only"
├─ Phase 2: File Selection (smart mode only)
│  ├─ Filters security-critical files (auth, db, API, crypto keywords)
│  └─ Uses heuristics in scanner/llm_file_selector.rs (486 lines, 30 tests)
├─ Phase 3: LLM Analysis (if mode != "regex_only")
│  ├─ Concurrent analysis: Semaphore(10) for rate limiting
│  ├─ Claude Haiku 4.5 with prompt caching (2048 token minimum)
│  ├─ 30-second timeout per file
│  ├─ Stores violations with detection_method="llm", confidence_score, llm_reasoning
│  ├─ Cost tracking: Every 10 files, checks cost_limit_per_scan
│  └─ User prompt if limit exceeded: emit "cost-limit-reached" event
├─ Phase 4: Violation Deduplication (scan.rs:526-641)
│  ├─ Matches regex + LLM violations within ±3 lines
│  ├─ Creates detection_method="hybrid" violations
│  └─ Hybrid violations include both regex_reasoning and llm_reasoning
└─ Phase 5: Database Storage
   ├─ Inserts deduplicated violations
   ├─ Stores scan_costs record (tokens, USD cost)
   └─ Creates audit event
```

**Detection Method Field**: `violation.detection_method` is "regex" | "llm" | "hybrid"
- Regex: Found only by pattern matching (has `regex_reasoning`)
- LLM: Found only by AI (has `llm_reasoning` and `confidence_score` 0-100)
- Hybrid: Found by both methods (has both reasoning fields + confidence score)

**Rule Engine Pattern**: Each rule in `src-tauri/src/rules/*.rs` exposes `analyze(code, file_path, scan_id) -> Result<Vec<Violation>>`. All rules use regex patterns for fast detection.

**3. Database Layer**

- **Connection management**: Singleton connection using `once_cell::Lazy` in `db/mod.rs:16-22`
  ```rust
  static DB_CONNECTION: Lazy<Mutex<Connection>> = Lazy::new(|| {
      let conn = create_connection().expect("Failed to initialize database");
      Mutex::new(conn)
  });
  ```
  All commands call `db::get_connection()` which returns `MutexGuard<'static, Connection>`. No connection leaks.

- **Schema**: 8 tables (projects, scans, violations, fixes, audit_events, controls, settings, scan_costs)
  * `violations` table (v2 migration): `detection_method`, `confidence_score`, `llm_reasoning`, `regex_reasoning`
  * `settings` table (v2 migration): `llm_scan_mode`, `cost_limit_per_scan`, `onboarding_completed`
  * `scan_costs` table (v2 migration): Tracks input/output/cache_read/cache_write tokens + total_cost_usd

- **Migrations**: Auto-executed on startup via `migrations.rs:run_migrations()` using PRAGMA user_version pattern (v0→v1→v2)

- **Indexes**: 8 B-tree indexes on foreign keys and status fields for performance

**4. Fix Generation Flow**

**Generate Fix** (fix.rs:45-135):
```
User clicks "Generate Fix" → generate_fix(violation_id) →
├─ Fetch violation + scan + project from DB
├─ Validate file path (security::path_validation)
├─ Build Claude prompt:
│  ├─ SOC 2 control requirements from controls table
│  ├─ File context (surrounding lines)
│  ├─ Framework info (Django/Flask/Express)
│  └─ Original code snippet
├─ Call Claude Haiku 4.5 (fix_generator/claude_client.rs)
│  ├─ Prompt caching enabled (ephemeral, 2048 token min)
│  ├─ Rate limited: 50 requests/minute (rate_limiter.rs)
│  └─ Parse JSON response: {fixed_code, explanation}
├─ Store in fixes table with trust_level="review"
└─ Create audit event
```

**Apply Fix** (fix.rs:147-267):
```
User clicks "Apply Fix" → apply_fix(fix_id) →
├─ Read original file
├─ Line-specific replacement (fix.rs:186-212):
│  ├─ Only replaces code at exact violation.line_number
│  └─ Validates original code exists on target line
├─ Create backup in .ryn-backups/{timestamp}/
├─ Write file to disk
├─ Git operations (git/operations.rs):
│  ├─ Check repo is clean (no uncommitted changes)
│  ├─ Stage changed file
│  ├─ Commit: "fix: {control_id} - {description}"
│  └─ Store commit SHA in fixes.git_commit_sha
├─ Update violation.status = "fixed"
└─ Create audit event
```

**Rate Limiting**: Claude API calls limited to 50 requests/minute via token bucket algorithm in `rate_limiter.rs`

### Module Organization

```
src-tauri/src/  (15,243 lines, 49 Rust files)
├── commands/           # 20 Tauri IPC commands (all fully implemented)
│   ├── analytics.rs    # get_scan_costs
│   ├── audit.rs        # get_audit_events
│   ├── fix.rs          # generate_fix, apply_fix (24 tests)
│   ├── project.rs      # select_project_folder, create_project, get_projects
│   ├── scan.rs         # detect_framework, scan_project, get_scan_progress, get_scans, respond_to_cost_limit (38 tests)
│   ├── settings.rs     # get_settings, update_settings, clear_database, export_data, complete_onboarding
│   └── violation.rs    # get_violations, get_violation, dismiss_violation
├── rules/              # 4 SOC 2 compliance rule engines (all functional)
│   ├── a1_2_resilience.rs        # Missing error handling, timeouts
│   ├── cc6_1_access_control.rs   # Missing @login_required, auth middleware
│   ├── cc6_7_secrets.rs          # Hardcoded passwords, API keys, tokens
│   └── cc7_2_logging.rs          # Missing audit logs
├── scanner/
│   ├── constants.rs              # Supported file extensions, exclusion patterns
│   ├── file_watcher.rs           # ❌ Implemented but NOT integrated
│   ├── framework_detector.rs    # Detects Django/Flask/Express/Next.js
│   ├── javascript_scanner.rs    # ❌ STUB ONLY
│   ├── llm_file_selector.rs     # Smart mode file selection heuristics (30 tests)
│   ├── python_scanner.rs        # ❌ STUB ONLY
│   └── tree_sitter_utils.rs     # ❌ Implemented but NOT used by rules
├── fix_generator/
│   ├── claude_client.rs          # Production Claude API client with caching
│   └── fix_applicator.rs        # Line-specific fix application
├── git/
│   └── operations.rs             # git2-based operations (commit, clean check)
├── db/
│   ├── migrations.rs             # v0→v1→v2 migration system
│   ├── mod.rs                    # Singleton connection with once_cell::Lazy
│   ├── queries.rs                # CRUD operations with parameterized SQL
│   ├── schema.sql                # 8 tables
│   └── test_helpers.rs           # TestDbGuard for isolated tests
├── models/                       # 8 data models matching DB tables
│   ├── audit.rs, control.rs, fix.rs, project.rs, scan.rs, scan_cost.rs, settings.rs, violation.rs
├── security/
│   └── path_validation.rs        # Prevents path traversal, blocks /etc, /usr, etc.
├── langgraph/
│   └── agent_runner.rs           # ❌ STUB - Returns mock responses
├── utils/
│   ├── audit.rs                  # Audit event creation helper
│   └── env.rs                    # Environment variable helpers
├── rate_limiter.rs               # Token bucket (50 req/min default)
└── main.rs                       # Entry point, registers 20 commands
```

### Frontend Architecture

```
app/                    # Next.js 16 App Router (7 pages, all functional)
├── page.tsx            # Dashboard with compliance score, charts
├── scan/page.tsx       # Violations table with filters
├── violation/[id]/     # Violation detail + fix generation
├── audit/page.tsx      # Audit trail timeline
├── analytics/page.tsx  # Cost tracking and token usage
└── settings/page.tsx   # Framework config, scan mode, database management

components/
├── scan/
│   └── scan-results.tsx        # Main scanning UI (calls real scan_project command)
├── violation/
│   └── fix-generator.tsx       # AI fix UI with diff viewer
└── ui/                          # 90+ shadcn/ui components

lib/
├── tauri/commands.ts            # TypeScript wrappers for all 20 Tauri commands
├── types/                       # TypeScript interfaces matching Rust models
├── langgraph/
│   ├── agent.ts                 # ❌ LangGraph state machine (NOT used by backend)
│   ├── prompts.ts               # SOC 2 prompt templates
│   └── types.ts
└── utils/error-handler.ts       # Centralized Tauri error handling
```

**Frontend uses real backend data** via Tauri IPC (scan-results.tsx:62-135 listens to real-time scan-progress and cost-limit-reached events).

## Testing Status

### Rust Backend: 454 Tests Across 37 Files

Comprehensive coverage includes:
- **commands/scan.rs**: 38 tests (hybrid scanning, deduplication, cost limits)
- **commands/fix.rs**: 24 tests (generation, application, git operations)
- **scanner/llm_file_selector.rs**: 30 tests (file selection heuristics)
- **rules/**: Extensive tests per rule engine (pattern matching, false positives)
- **db/**: Schema and migration tests

Test utilities:
- `test_helpers.rs`: Provides `TestDbGuard` for database isolation
- Uses `#[serial_test::serial]` for tests requiring DB
- Async tests with `#[tokio::test]`

### Frontend Tests: 212 Test Files

- Vitest unit tests in `lib/test/`, `lib/langgraph/*.test.ts`
- E2E tests in `__tests__/e2e/workflow.test.ts` **are fully mocked** (mock `@tauri-apps/api/core` invoke, don't call Rust backend)
- **True E2E tests are missing** (no tests that actually invoke Rust from frontend)

## CI/CD and Platform Support

### GitHub Actions Workflows

**test.yml** - Runs on push/PR to main:
- Frontend: TypeScript check, Vitest, Prettier formatting
- Backend: Rust fmt, clippy (with `-D warnings`), cargo test (454 tests)
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

3. Call from `src-tauri/src/commands/scan.rs` in `run_all_rules()` function (scan.rs:179-245)

4. Add comprehensive tests covering all violation patterns and false positives

### Adding a New Tauri Command

1. Define in appropriate command module (e.g., `src-tauri/src/commands/scan.rs`):
```rust
#[tauri::command]
pub async fn your_command(param: String) -> Result<YourType, String> {
    let conn = db::get_connection();  // Use singleton connection
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

# Rust: Run with output (see println!)
cargo test -- --nocapture test_name

# Rust: Run tests matching pattern
cargo test hybrid

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

# Check database migration version
sqlite3 ./data/ryn.db "PRAGMA user_version;"
```

## Security Considerations

- **Path Traversal Protection**: All file operations validated via `security::path_validation::validate_project_path()`
- **System Directory Blocking**: Cannot scan `/`, `/etc`, `/usr`, `/bin`, `/var`, etc.
- **SQL Injection**: All queries use parameterized statements (`?` placeholders)
- **Command Injection**: Git operations use `git2` library (no shell execution)
- **API Key Storage**: Read from environment variables only, never stored in database
- **Backup Files**: Stored in `.ryn-backups/` with timestamps before applying fixes

## Documentation Resources

- **README**: `README.md` - User-facing documentation with setup instructions
- **Testing Guide**: `TESTING.md` - Manual testing procedures with real vulnerable repos
- **Schema**: `src-tauri/src/db/schema.sql` - Complete database structure
- **Context7 Docs**: Store in `.claude/docs/` (do not add redundant files)

## Known Limitations and Future Work

- **File Watcher**: Implemented (`scanner/file_watcher.rs`) but not integrated - scans are manual only
- **LangGraph**: TypeScript agent exists but Rust bridge returns mocks - direct rule engines used instead
- **Tree-sitter**: Implemented but rules use regex patterns instead of AST parsing
- **Language Scanners**: `python_scanner.rs` and `javascript_scanner.rs` are stubs
- **True E2E Tests**: Missing - frontend E2E tests mock Tauri IPC instead of calling Rust backend

## User Instructions

- Make granulated, unambiguous todo lists
- Use Context7 to fetch documentation (never guess/assume)
- Commit often
- Be grounded in reality - verify implementations before claiming features work
