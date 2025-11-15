# Ryn Master Plan: The Single Source of Truth

## Executive Summary

Ryn is an AI-powered desktop application that automates SOC 2 compliance by scanning application code for violations and generating one-click fixes via AI. Unlike infrastructure monitoring platforms (Vanta, Drata), Ryn scans actual codebases using hybrid detection (regex + AI), detects missing audit logs, weak access controls, and hardcoded secrets, then uses Claude Haiku 4.5 to generate context-aware fixes and apply them via git commit.

**Current State**: Hybrid scanning architecture complete with three scanning modes (regex_only, smart, analyze_all), cost tracking, analytics dashboard, and full UI integration. Testing and E2E verification in progress.

**Goal**: Production-ready desktop app with 99% test coverage in 20 days.

**Market Opportunity**: $15B SOC 2 market, zero tools scan application code, developers spend 100-300+ hours on manual compliance work.

**Tech Stack**: Tauri 2.0 (Rust + React/TypeScript), LangGraph agents, Claude Haiku 4.5, tree-sitter parsing, SQLite database.

---

## Architecture Overview

### Core Technology Decisions

**Framework**: Tauri 2.0
- Native performance: Under 500ms startup, 85% less memory than Electron
- Distribution size: 2.5-10 MB vs Electron's 80-150 MB
- Security: "Deny by default" with explicit OS access
- Cross-platform: macOS, Linux, Windows from single codebase
- AI-assisted development: Works excellently with Cursor and Claude Code

**Agent Orchestration**: LangGraph
- 6.17M monthly downloads vs CrewAI's 1.38M
- Fastest framework with lowest latency (Nov 2025 benchmarks)
- Production-proven: Klarna (2.3M conversations/month), AppFolio, LinkedIn
- Control mechanisms: Custom breakpoints, time-travel debugging, cyclical workflows
- Critical for semi-autonomous code modification with human approval gates

**Code Analysis**: Hybrid Detection Architecture
- **Three Scanning Modes**:
  * `regex_only`: Free, instant pattern matching only (no AI costs)
  * `smart` (recommended): AI analyzes ~30-40% of files (security-critical code only)
  * `analyze_all`: AI analyzes every file (maximum accuracy, higher cost)
- **Regex Engine**: Fast pattern matching for known SOC 2 violations (hardcoded secrets, missing auth, etc.)
- **LLM Analysis**: Claude Haiku 4.5 for semantic understanding of complex violations
- **Hybrid Detection**: Violations found by both methods are merged with ±3 line matching
  * `detection_method`: "regex" | "llm" | "hybrid"
  * Hybrid violations include both `regex_reasoning` and `llm_reasoning` with AI `confidence_score`
- **LLM File Selection**: Heuristic-based filtering identifies security-critical files:
  * Authentication/authorization keywords (login, auth, session, permission)
  * Database operations (cursor, execute, query, ORM methods)
  * API endpoints (route decorators, HTTP methods)
  * Security-sensitive imports (crypto, jwt, bcrypt, secrets)
- **Cost Tracking**: Real-time token usage calculation with 2025 Claude Haiku pricing
  * $0.80/MTok input, $4.00/MTok output, $0.08/MTok cache read, $1.00/MTok cache write
  * Cost limit enforcement with user prompts to continue or stop
  * Analytics dashboard showing daily cost breakdown
- **Prompt Caching**: SOC 2 controls cached in system prompt (90% cost reduction on repeated scans)

**LLM Integration**: Claude Haiku 4.5 with Prompt Caching
- API Key Storage: .env files with macOS Keychain integration (MVP)
- Production path: Server-side API gateway (key rotation, rate limiting, logging)
- Cost Optimization: 90% cost reduction on cached tokens ($0.30 vs $3 per million)
- Context: 200K token capacity, cache system prompts and file structure
- Streaming: Server-Sent Events with 300-500ms debounce for responsive UX
- Citations: Returns exact code passages used in analysis

**Database**: SQLite
- Local storage with manual SQL migrations
- Vector extensions for semantic search
- Manual migrations in src-tauri/src/db/migrations.rs

**Languages Supported**: Python (Django/Flask), JavaScript/TypeScript (Node.js/Express/React)

**SOC 2 Controls**: CC6.1 (Access Control), CC6.7 (Secrets), CC7.2/7.3 (Logging), A1.2 (Resilience)

### File Watching Strategy

Desktop app with continuous file monitoring provides real-time compliance feedback as developers code. This "IDE-adjacent" behavior catches violations immediately upon save rather than during audit months later.

**Implementation**: notify crate in Rust with async-channel for event handling.

---

## Project Structure

```
app/                              # Next.js 15.5.6 frontend
├── layout.tsx                    # Root layout with dark theme
├── page.tsx                      # Dashboard (compliance metrics)
├── scan/page.tsx                 # Violations table
├── violation/[id]/page.tsx       # Violation detail + AI fix
├── audit/page.tsx                # Audit trail
└── settings/page.tsx             # Framework & scan config

components/                       # React components (shadcn/ui + Radix)
├── dashboard/                    # Compliance metrics, charts
├── scan/                         # Violation table, filters
├── violation/                    # Detail view, code preview, diff
├── audit/                        # Timeline, event cards
├── settings/                     # Framework, database, preferences
├── layout/                       # Top nav, sidebar
└── ui/                           # 90+ shadcn/ui components

lib/
├── types/                        # violation.ts, audit.ts, fix.ts
├── tauri/commands.ts             # IPC interfaces (currently stubs)
└── langgraph/                    # LangGraph agent system
    ├── agent.ts                  # State machine
    ├── prompts.ts                # SOC 2 prompt templates
    └── types.ts                  # Agent types

src-tauri/src/                    # Rust backend
├── main.rs                       # Tauri app entry point
├── lib.rs                        # Module re-exports
├── commands/                     # Tauri commands (IPC)
│   ├── project.rs
│   ├── scan.rs
│   ├── violation.rs
│   ├── fix.rs
│   ├── audit.rs
│   └── settings.rs
├── models/                       # Data models
│   ├── project.rs
│   ├── scan.rs
│   ├── violation.rs
│   ├── fix.rs
│   ├── audit.rs
│   ├── control.rs
│   └── settings.rs
├── db/                           # Database layer
│   ├── schema.sql
│   ├── migrations.rs
│   └── queries.rs
├── scanner/                      # Code scanning
│   ├── framework_detector.rs
│   ├── file_watcher.rs
│   ├── python_scanner.rs
│   ├── javascript_scanner.rs
│   └── tree_sitter_utils.rs
├── langgraph/                    # LangGraph bridge
│   ├── agent_runner.rs
│   ├── nodes.rs
│   └── state.rs
├── rules/                        # SOC 2 rule engines
│   ├── cc6_1_access_control.rs
│   ├── cc6_7_secrets.rs
│   ├── cc7_2_logging.rs
│   └── a1_2_resilience.rs
├── fix_generator/                # AI fix generation
│   ├── claude_client.rs
│   └── fix_applicator.rs
├── git/                          # Git operations
│   └── operations.rs
└── utils/
    ├── mod.rs
    └── env.rs
```

---

## Implementation Phases (20 Days)

### Phase 1: Foundation (Day 1-2) - SEAN ONLY

**Why Sean**: Sets up structure for both developers. Sequential blocker.

**Branch**: `sean/phase-1-foundation`

**Tasks**:

1. Update `src-tauri/Cargo.toml` with dependencies:
   ```toml
   [dependencies]
   tauri = "2.0"
   tauri-plugin-sql = { version = "2.0", features = ["sqlite"] }
   tauri-plugin-fs = "2.0"
   tauri-plugin-dialog = "2.0"
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   chrono = { version = "0.4", features = ["serde"] }
   tree-sitter = "0.22"
   tree-sitter-python = "0.21"
   tree-sitter-javascript = "0.21"
   tree-sitter-typescript = "0.21"
   walkdir = "2"
   regex = "1"
   git2 = "0.19"
   dotenv = "0.15"
   thiserror = "1"
   anyhow = "1"
   tokio = { version = "1", features = ["full"] }
   reqwest = { version = "0.12", features = ["json", "stream"] }
   rusqlite = { version = "0.31", features = ["bundled"] }
   notify = "6"
   async-channel = "2"

   [dev-dependencies]
   rstest = "0.21"
   tempfile = "3"
   mockall = "0.12"
   serial_test = "3"
   ```

2. Update `package.json` with LangGraph dependencies:
   ```json
   {
     "dependencies": {
       "@langchain/core": "^0.2.0",
       "@langchain/langgraph": "^0.0.20",
       "@langchain/anthropic": "^0.2.0",
       "zod": "^3.23.0"
     },
     "devDependencies": {
       "vitest": "^2.0.0",
       "@testing-library/react": "^15.0.0",
       "@testing-library/jest-dom": "^6.4.0",
       "@testing-library/user-event": "^14.5.0",
       "@tauri-apps/api": "^2.0.0",
       "playwright": "^1.45.0",
       "happy-dom": "^14.12.0"
     }
   }
   ```

3. Create `.env.example`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

4. Create `.env` (add to .gitignore):
   ```
   ANTHROPIC_API_KEY=
   OPENAI_API_KEY=
   ```

5. Update `.gitignore`:
   ```
   .env
   *.db
   *.db-*
   src-tauri/target/
   ```

6. Create Rust module structure (all mod.rs files empty initially):
   - `src-tauri/src/lib.rs`
   - `src-tauri/src/commands/mod.rs`
   - `src-tauri/src/models/mod.rs`
   - `src-tauri/src/db/mod.rs`
   - `src-tauri/src/scanner/mod.rs`
   - `src-tauri/src/langgraph/mod.rs`
   - `src-tauri/src/rules/mod.rs`
   - `src-tauri/src/fix_generator/mod.rs`
   - `src-tauri/src/git/mod.rs`
   - `src-tauri/src/utils/mod.rs`

7. Create test configuration:

   `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'happy-dom',
       setupFiles: ['./vitest.setup.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         thresholds: {
           lines: 99,
           functions: 99,
           branches: 99,
           statements: 99
         }
       }
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './'),
       },
     },
   })
   ```

   `vitest.setup.ts`:
   ```typescript
   import '@testing-library/jest-dom'
   import { mockIPC } from '@tauri-apps/api/mocks'
   import { beforeAll } from 'vitest'

   beforeAll(() => {
     Object.defineProperty(window, 'crypto', {
       value: {
         getRandomValues: (buffer: any) => {
           return crypto.getRandomValues(buffer)
         },
       },
     })
   })
   ```

**Deliverable**: Complete project structure with all dependencies installed. Rust builds successfully. Tests run.

**Aleksandr during Phase 1**: Review plan thoroughly. Prepare for Phase 2 database work.

---

### Phase 2: Database Layer (Day 2-3) - ALEKSANDR ONLY

**Why Aleksandr**: Pure Rust database work. Sean prepares for Phase 3 (TypeScript).

**Wait for**: Phase 1 merged to main.

**Branch**: `aleksandr/phase-2-database`

**Tasks**:

1. Create `src-tauri/src/db/schema.sql`:
   ```sql
   -- Projects table
   CREATE TABLE IF NOT EXISTS projects (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       path TEXT NOT NULL UNIQUE,
       framework TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );

   -- Scans table
   CREATE TABLE IF NOT EXISTS scans (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       project_id INTEGER NOT NULL,
       started_at TEXT NOT NULL DEFAULT (datetime('now')),
       completed_at TEXT,
       files_scanned INTEGER DEFAULT 0,
       violations_found INTEGER DEFAULT 0,
       status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running',
       FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
   );

   -- Violations table
   CREATE TABLE IF NOT EXISTS violations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       scan_id INTEGER NOT NULL,
       control_id TEXT NOT NULL,
       severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
       description TEXT NOT NULL,
       file_path TEXT NOT NULL,
       line_number INTEGER NOT NULL,
       code_snippet TEXT NOT NULL,
       status TEXT NOT NULL CHECK(status IN ('open', 'fixed', 'dismissed')) DEFAULT 'open',
       detected_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
   );

   -- Fixes table
   CREATE TABLE IF NOT EXISTS fixes (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       violation_id INTEGER NOT NULL,
       original_code TEXT NOT NULL,
       fixed_code TEXT NOT NULL,
       explanation TEXT NOT NULL,
       trust_level TEXT NOT NULL CHECK(trust_level IN ('auto', 'review', 'manual')),
       applied_at TEXT,
       applied_by TEXT NOT NULL DEFAULT 'ryn-ai',
       git_commit_sha TEXT,
       FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE
   );

   -- Audit events table
   CREATE TABLE IF NOT EXISTS audit_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       event_type TEXT NOT NULL CHECK(event_type IN ('scan', 'violation', 'fix', 'project_selected', 'settings_changed')),
       project_id INTEGER,
       violation_id INTEGER,
       fix_id INTEGER,
       description TEXT NOT NULL,
       metadata TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
       FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE SET NULL,
       FOREIGN KEY (fix_id) REFERENCES fixes(id) ON DELETE SET NULL
   );

   -- SOC 2 Controls reference table
   CREATE TABLE IF NOT EXISTS controls (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       description TEXT NOT NULL,
       requirement TEXT NOT NULL,
       category TEXT NOT NULL
   );

   -- Settings table
   CREATE TABLE IF NOT EXISTS settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );

   -- Indexes for performance
   CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
   CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
   CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
   CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
   CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
   ```

2. Implement database models (see plan.md lines 312-428 for complete violation.rs example)
   - `src-tauri/src/models/mod.rs`
   - `src-tauri/src/models/project.rs`
   - `src-tauri/src/models/scan.rs`
   - `src-tauri/src/models/violation.rs` (with Severity, ViolationStatus enums)
   - `src-tauri/src/models/fix.rs`
   - `src-tauri/src/models/audit.rs`
   - `src-tauri/src/models/control.rs`
   - `src-tauri/src/models/settings.rs`

3. Implement database operations (see plan.md lines 430-562 for complete implementations):
   - `src-tauri/src/db/mod.rs` (init_db, get_db_path)
   - `src-tauri/src/db/migrations.rs` (run_migrations, seed controls)
   - `src-tauri/src/db/queries.rs` (CRUD operations)

4. Write comprehensive tests (20+ tests minimum):
   - Test database initialization
   - Test migrations create all tables
   - Test seed data
   - Test foreign key constraints
   - Test model serialization/deserialization
   - Test enum conversions

**Deliverable**: Complete database schema, all models with serde derives, migrations with tests, query functions.

**Sean during Phase 2**: Review plan Phase 3 (LangGraph). Prepare TypeScript agent structure.

---

### Phase 3: LangGraph Agent System (Day 3-5) - SEAN ONLY

**Why Sean**: TypeScript/Node.js work. Completely separate from Aleksandr's Rust scanning work.

**Wait for**: Phase 2 merged to main.

**Branch**: `sean/phase-3-langgraph`

**Tasks**:

1. Create `lib/langgraph/agent.ts`:
   ```typescript
   import { StateGraph, Annotation } from "@langchain/langgraph"
   import { ChatAnthropic } from "@langchain/anthropic"
   import { ToolNode } from "@langchain/langgraph/prebuilt"

   // Agent state definition
   const AgentState = Annotation.Root({
     filePath: Annotation<string>,
     code: Annotation<string>,
     framework: Annotation<string>,
     violations: Annotation<Array<any>>({
       default: () => [],
       reducer: (x: any, y: any) => y || x,
     }),
     fixes: Annotation<Array<any>>({
       default: () => [],
       reducer: (x: any, y: any) => y || x,
     }),
     currentStep: Annotation<string>,
   })

   // Node implementations
   async function parseNode(state: typeof AgentState.State) {
     return {
       ...state,
       currentStep: "parsed",
     }
   }

   async function analyzeNode(state: typeof AgentState.State) {
     return {
       ...state,
       currentStep: "analyzed",
     }
   }

   async function generateFixesNode(state: typeof AgentState.State) {
     return {
       ...state,
       currentStep: "fixes_generated",
     }
   }

   async function validateNode(state: typeof AgentState.State) {
     return {
       ...state,
       currentStep: "validated",
     }
   }

   // Build graph
   const workflow = new StateGraph(AgentState)
     .addNode("parse", parseNode)
     .addNode("analyze", analyzeNode)
     .addNode("generate_fixes", generateFixesNode)
     .addNode("validate", validateNode)
     .addEdge("parse", "analyze")
     .addEdge("analyze", "generate_fixes")
     .addEdge("generate_fixes", "validate")
     .setEntryPoint("parse")
     .addEdge("validate", "__end__")

   export const agent = workflow.compile()
   ```

2. Create `lib/langgraph/prompts.ts` (see plan.md lines 1576-1659 for complete SOC2_PROMPTS)

3. Create `src-tauri/src/langgraph/agent_runner.rs` (Rust-TypeScript bridge, see plan.md lines 638-702)

4. Create `lib/langgraph/types.ts` (agent types)

5. Write tests for agent state machine

**Deliverable**: Complete LangGraph state machine with nodes, Rust-TypeScript bridge, prompt templates, tests.

**Coordination**: None needed with Phase 4 - different files, different languages.

---

### Phase 4: Scanning Engine (Day 3-5) - ALEKSANDR ONLY

**Why Aleksandr**: Pure Rust scanning work. Completely separate from Sean's TypeScript agent work.

**Wait for**: Phase 2 merged to main.

**Branch**: `aleksandr/phase-4-scanning`

**Tasks**:

1. Create `src-tauri/src/scanner/framework_detector.rs` (see plan.md lines 710-860 for complete implementation):
   - Detect Django (requirements.txt, Pipfile, manage.py)
   - Detect Flask (requirements.txt, Pipfile)
   - Detect Express (package.json)
   - Detect Next.js (package.json)
   - Detect React (package.json)
   - Include 10+ tests covering all framework detection patterns

2. Create `src-tauri/src/scanner/file_watcher.rs` (see plan.md lines 864-992 for complete implementation):
   - Use notify crate for file system events
   - Async-channel for event handling
   - Support FileModified, FileCreated, FileDeleted events
   - Include tests with tokio::test

3. Create `src-tauri/src/scanner/tree_sitter_utils.rs` (see plan.md lines 996-1078 for complete implementation):
   - CodeParser with Python, JavaScript, TypeScript parsers
   - FFI bindings to tree-sitter language parsers
   - Include parsing tests

4. Create `src-tauri/src/scanner/python_scanner.rs` (stub for Phase 5)

5. Create `src-tauri/src/scanner/javascript_scanner.rs` (stub for Phase 5)

6. Update `src-tauri/src/scanner/mod.rs` to export all modules

**Deliverable**: Framework detection, file watching, tree-sitter AST parsing for Python and JS/TS with 20+ tests.

**Coordination**: None needed with Phase 3 - different files, different languages. Merge both when done.

---

### Phase 5: SOC 2 Rule Engines (Day 8-12) - SPLIT PARALLEL

**Wait for**: Both Phase 3 and Phase 4 merged to main.

Both work on Rust rules in `src-tauri/src/rules/` but different files.

#### Phase 5a: Access Control & Secrets - SEAN

**Branch**: `sean/phase-5-rules-cc6`

**Tasks**:

1. Create `src-tauri/src/rules/mod.rs` (SEAN CREATES THIS FIRST, then pushes):
   ```rust
   pub mod cc6_1_access_control;
   pub mod cc6_7_secrets;

   pub use cc6_1_access_control::*;
   pub use cc6_7_secrets::*;
   ```

2. Create `src-tauri/src/rules/cc6_1_access_control.rs` (see plan.md lines 1086-1165 for complete implementation):
   - Detect missing authentication decorators on Django views
   - Detect missing RBAC checks
   - Include 15+ test cases

3. Create `src-tauri/src/rules/cc6_7_secrets.rs` (see plan.md lines 1167-1256 for complete implementation):
   - Detect hardcoded secrets (passwords, API keys, tokens)
   - Detect missing TLS enforcement (http:// vs https://)
   - Include 15+ test cases

**Deliverable**: CC6.1 and CC6.7 rule engines with regex patterns, 30+ test cases.

**Coordination Required**: Sean creates and pushes `rules/mod.rs` first.

#### Phase 5b: Logging & Resilience - ALEKSANDR

**Branch**: `aleksandr/phase-5-rules-cc7-a1`

**Wait for**: Sean to create and push `rules/mod.rs` first (coordinate on Slack/Discord).

**Tasks**:

1. Pull latest from Sean's pushed `rules/mod.rs`

2. Update `src-tauri/src/rules/mod.rs` to add:
   ```rust
   pub mod cc7_2_logging;
   pub mod a1_2_resilience;

   pub use cc7_2_logging::*;
   pub use a1_2_resilience::*;
   ```

3. Create `src-tauri/src/rules/cc7_2_logging.rs` (see plan.md lines 1258-1355 for complete implementation):
   - Detect missing audit logs on sensitive operations
   - Detect logging sensitive data (passwords, tokens, secrets, SSN)
   - Include 15+ test cases

4. Create `src-tauri/src/rules/a1_2_resilience.rs` (see plan.md lines 1357-1461 for complete implementation):
   - Detect missing error handling
   - Detect missing circuit breakers or retries on external calls
   - Include 15+ test cases

**Deliverable**: CC7.2 and A1.2 rule engines with regex patterns, 30+ test cases.

**Coordination**: Aleksandr waits for Sean's `rules/mod.rs` commit, then pulls and adds his rules. Merge both when done (Sean first, then Aleksandr).

---

### Phase 6: Fix Generation with Claude (Day 12-15) - SEAN ONLY

**Why Sean**: Claude API integration, LLM prompts. Sequential after rules are done.

**Wait for**: Both Phase 5a and 5b merged to main.

**Branch**: `sean/phase-6-claude-client`

**Tasks**:

1. Create `src-tauri/src/fix_generator/claude_client.rs` (see plan.md lines 1468-1573 for complete implementation):
   - ClaudeClient with API key from env
   - generate_fix method
   - Anthropic API request/response structs
   - Include tests (mock HTTP client in production tests)

2. Create `src-tauri/src/fix_generator/mod.rs`:
   ```rust
   pub mod claude_client;
   pub use claude_client::*;
   ```

3. Create `src-tauri/src/utils/env.rs`:
   ```rust
   use anyhow::Result;
   use dotenv::dotenv;
   use std::env;

   pub fn load_env() -> Result<()> {
       dotenv().ok();
       Ok(())
   }

   pub fn get_anthropic_key() -> Result<String> {
       env::var("ANTHROPIC_API_KEY")
           .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY not set"))
   }
   ```

4. Update prompt templates in `lib/langgraph/prompts.ts` if needed (already created in Phase 3)

**Deliverable**: Claude Haiku 4.5 API client with streaming, error handling, prompt templates for all 4 controls, tests.

**Aleksandr during Phase 6**: Review plan Phase 7 (Git operations). Prepare for git2 integration.

---

### Phase 7: Git Integration (Day 15-16) - ALEKSANDR ONLY

**Why Aleksandr**: Pure Rust git2 work. Sequential after Claude client is done.

**Wait for**: Phase 6 merged to main.

**Branch**: `aleksandr/phase-7-git-ops`

**Tasks**:

1. Create `src-tauri/src/fix_generator/fix_applicator.rs`:
   ```rust
   use anyhow::Result;
   use std::fs;
   use std::path::Path;

   pub struct FixApplicator;

   impl FixApplicator {
       pub fn apply_fix(file_path: &Path, fixed_code: &str) -> Result<()> {
           fs::write(file_path, fixed_code)?;
           Ok(())
       }

       pub fn validate_fix(file_path: &Path) -> Result<bool> {
           // TODO: Run static analysis, compile checks
           Ok(true)
       }
   }

   #[cfg(test)]
   mod tests {
       use super::*;
       use tempfile::TempDir;

       #[test]
       fn test_apply_fix() {
           let dir = TempDir::new().unwrap();
           let file = dir.path().join("test.py");

           FixApplicator::apply_fix(&file, "print('fixed')").unwrap();

           let content = fs::read_to_string(&file).unwrap();
           assert_eq!(content, "print('fixed')");
       }
   }
   ```

2. Create `src-tauri/src/git/operations.rs` (see plan.md lines 1668-1756 for complete implementation):
   - commit_fix (stage file, create commit)
   - is_clean (check if repo is clean)
   - get_current_branch
   - Include 5+ tests

3. Create `src-tauri/src/git/mod.rs`:
   ```rust
   pub mod operations;
   pub use operations::*;
   ```

**Deliverable**: File modification, git commit functionality, tests.

**Sean during Phase 7**: Review plan Phase 8 (Tauri commands). Prepare to wire everything together.

---

### Phase 8: Tauri Commands (Day 16-17) - SEAN ONLY

**Why Sean**: Wiring all backend modules together. Needs everything from previous phases.

**Wait for**: Phase 7 merged to main.

**Branch**: `sean/phase-8-tauri-commands`

**Tasks**:

Implement all 14 Tauri commands in separate files:

1. `src-tauri/src/commands/project.rs`:
   - `select_project_folder()` - Opens folder picker
   - `create_project(path: String)` - Creates project in DB
   - `get_projects()` - Lists all projects

2. `src-tauri/src/commands/scan.rs`:
   - `detect_framework(path: String)` - Detects framework
   - `scan_project(project_id: i64)` - Starts scan
   - `get_scan_progress(scan_id: i64)` - Returns progress
   - `get_scans(project_id: i64)` - Lists scans

3. `src-tauri/src/commands/violation.rs`:
   - `get_violations(scan_id: i64, filters: Option<ViolationFilters>)` - Lists violations
   - `get_violation(id: i64)` - Gets violation detail
   - `dismiss_violation(id: i64)` - Dismisses violation

4. `src-tauri/src/commands/fix.rs`:
   - `generate_fix(violation_id: i64)` - Generates fix using Claude
   - `apply_fix(fix_id: i64)` - Applies fix and creates git commit

5. `src-tauri/src/commands/audit.rs`:
   - `get_audit_events(filters: Option<AuditFilters>)` - Lists audit events

6. `src-tauri/src/commands/settings.rs`:
   - `get_settings()` - Gets all settings
   - `update_settings(settings: Settings)` - Updates settings

7. `src-tauri/src/commands/mod.rs`:
   ```rust
   pub mod project;
   pub mod scan;
   pub mod violation;
   pub mod fix;
   pub mod audit;
   pub mod settings;

   pub use project::*;
   pub use scan::*;
   pub use violation::*;
   pub use fix::*;
   pub use audit::*;
   pub use settings::*;
   ```

8. Update `src-tauri/src/main.rs` to register all commands:
   ```rust
   use commands::*;

   fn main() {
       tauri::Builder::default()
           .invoke_handler(tauri::generate_handler![
               // Project commands
               select_project_folder,
               create_project,
               get_projects,
               // Scan commands
               detect_framework,
               scan_project,
               get_scan_progress,
               get_scans,
               // Violation commands
               get_violations,
               get_violation,
               dismiss_violation,
               // Fix commands
               generate_fix,
               apply_fix,
               // Audit commands
               get_audit_events,
               // Settings commands
               get_settings,
               update_settings,
           ])
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```

9. Write 20+ tests per command module (minimum 280 tests total)

**Deliverable**: All 14 Tauri commands implemented, registered, and tested. Backend fully functional.

**Aleksandr during Phase 8**: Review plan Phase 9 (Frontend integration). Prepare to connect frontend.

---

### Phase 9: Frontend Integration (Day 17-19) - ALEKSANDR ONLY

**Why Aleksandr**: Frontend TypeScript work. Sequential after backend is complete.

**Wait for**: Phase 8 merged to main.

**Branch**: `aleksandr/phase-9-frontend`

**Tasks**:

1. Update `lib/tauri/commands.ts` from stubs to real Tauri command calls:
   ```typescript
   import { invoke } from '@tauri-apps/api/core'

   // Project commands
   export async function selectProjectFolder(): Promise<string> {
     return await invoke('select_project_folder')
   }

   export async function createProject(path: string): Promise<Project> {
     return await invoke('create_project', { path })
   }

   export async function getProjects(): Promise<Project[]> {
     return await invoke('get_projects')
   }

   // Scan commands
   export async function detectFramework(path: string): Promise<string> {
     return await invoke('detect_framework', { path })
   }

   export async function scanProject(projectId: number): Promise<ScanResult> {
     return await invoke('scan_project', { projectId })
   }

   export async function getScanProgress(scanId: number): Promise<ScanProgress> {
     return await invoke('get_scan_progress', { scanId })
   }

   export async function getScans(projectId: number): Promise<Scan[]> {
     return await invoke('get_scans', { projectId })
   }

   // Violation commands
   export async function getViolations(
     scanId: number,
     filters?: ViolationFilters
   ): Promise<Violation[]> {
     return await invoke('get_violations', { scanId, filters })
   }

   export async function getViolation(id: number): Promise<Violation> {
     return await invoke('get_violation', { id })
   }

   export async function dismissViolation(id: number): Promise<void> {
     return await invoke('dismiss_violation', { id })
   }

   // Fix commands
   export async function generateFix(violationId: number): Promise<Fix> {
     return await invoke('generate_fix', { violationId })
   }

   export async function applyFix(fixId: number): Promise<void> {
     return await invoke('apply_fix', { fixId })
   }

   // Audit commands
   export async function getAuditEvents(
     filters?: AuditFilters
   ): Promise<AuditEvent[]> {
     return await invoke('get_audit_events', { filters })
   }

   // Settings commands
   export async function getSettings(): Promise<Settings> {
     return await invoke('get_settings')
   }

   export async function updateSettings(settings: Settings): Promise<void> {
     return await invoke('update_settings', { settings })
   }
   ```

2. Update frontend pages to use real data:
   - `app/page.tsx` - Connect to real compliance calculations
   - `app/scan/page.tsx` - Connect to real scan commands
   - `app/violation/[id]/page.tsx` - Real violation data + fix generation
   - `app/audit/page.tsx` - Real audit events
   - `app/settings/page.tsx` - Persist to database

3. Remove mock data from components

4. Add real-time updates using Tauri events:
   ```typescript
   import { listen } from '@tauri-apps/api/event'

   useEffect(() => {
     const unlisten = listen('scan-progress', (event) => {
       setScanProgress(event.payload)
     })
     return () => { unlisten.then(fn => fn()) }
   }, [])
   ```

5. Write component tests with @testing-library/react

**Deliverable**: Fully integrated frontend with real backend. All pages functional. Mock data removed.

**Sean during Phase 9**: Review plan Phase 10 (Testing). Prepare E2E test scenarios.

---

### Phase 10: Comprehensive Testing (Day 19-20) - BOTH (PAIR)

**Why Both**: Pair programming on E2E tests. Work together in real-time.

**Wait for**: Phase 9 merged to main.

**Branch**: `shared/phase-10-e2e-tests`

**Tasks**:

1. Create `tests/e2e/scan-workflow.spec.ts`:
   ```typescript
   import { test, expect } from '@playwright/test'

   test('complete scan workflow', async ({ page }) => {
     // 1. Launch app
     await page.goto('/')

     // 2. Select project folder
     await page.click('button:has-text("Select Project")')
     // Handle native file dialog...

     // 3. Verify framework detection
     await expect(page.locator('text=Django')).toBeVisible()

     // 4. Run scan
     await page.click('button:has-text("Start Scan")')

     // 5. Wait for scan completion
     await page.waitForSelector('text=Scan Complete', { timeout: 30000 })

     // 6. Verify violations displayed
     await expect(page.locator('[data-testid="violation-row"]')).toHaveCount(
       3
     )

     // 7. Click into violation
     await page.click('[data-testid="violation-row"]:first-child')

     // 8. Verify violation detail
     await expect(
       page.locator('text=Missing authentication decorator')
     ).toBeVisible()

     // 9. Generate fix
     await page.click('button:has-text("Generate Fix")')

     // 10. Wait for fix generation
     await page.waitForSelector('text=Fix Generated', { timeout: 10000 })

     // 11. Apply fix
     await page.click('button:has-text("Apply Fix")')

     // 12. Verify git commit
     await expect(page.locator('text=Fix applied')).toBeVisible()
     await expect(page.locator('text=commit:')).toBeVisible()
   })
   ```

2. Create `tests/e2e/fix-application.spec.ts`:
   - Test fix generation for all 4 SOC 2 controls
   - Verify fix quality
   - Test fix rejection workflow

3. Create `tests/e2e/git-integration.spec.ts`:
   - Test git commit creation
   - Verify commit message format
   - Test clean repository check
   - Test branch detection

4. Integration tests:
   - Scan Python Django project
   - Scan JavaScript Express project
   - File watcher triggers scan
   - Real-time violation updates

5. Verify 99% test coverage:
   ```bash
   cargo test --workspace
   pnpm vitest --coverage
   pnpm playwright test
   ```

**Deliverable**: E2E tests passing, 99% coverage verified, all edge cases tested.

**Work together**: Both developers on same branch, communicating in real-time (Slack/Discord screen share).

---

## Team Collaboration Workflow

### Git Workflow (Simple Feature Branches)

**Initial Setup (Both Developers - Do Once)**:
```bash
git checkout main
git pull origin main
git remote -v  # Verify: origin https://github.com/AleksandrRise/ryn.git
```

**Starting Work Each Day**:
```bash
git checkout main
git pull origin main
git checkout -b your-name/phase-X-description
# Example: git checkout -b sean/phase-1-foundation
```

**During Work**:
```bash
# Commit frequently (every 30-60 minutes)
git add <files>
git commit -m "Clear description"

# Push regularly (every few commits)
git push origin your-branch-name
```

**Syncing with Main (Daily)**:
```bash
# While on your feature branch
git fetch origin main
git merge origin/main

# Fix conflicts if they occur, then:
git add <fixed-files>
git commit
```

**Finishing Your Work**:
```bash
# 1. Final push
git push origin your-branch-name

# 2. Create Pull Request on GitHub
# Go to: https://github.com/AleksandrRise/ryn/pulls
# Click "New Pull Request"
# Select your branch -> main
# Request review from other person

# 3. After PR is merged, delete local branch
git checkout main
git pull origin main
git branch -d your-branch-name
```

### Communication Protocol

**Before Starting Work**:
Message the other person: "Starting [branch name], working on [phase description]"

**During Parallel Work** (Phase 3-4, Phase 5a-5b):
- Push frequently: Every 2-3 commits
- Status updates: Quick message when major component done
- No coordination needed: Different files = no conflicts

**During Sequential Work**:
- Wait for PR merge: Don't start your phase until previous is merged
- Pull main immediately: Get latest changes before creating branch

**Conflict Prevention**:
1. Never work on same file simultaneously (except Phase 10 pairing)
2. Phase 5 coordination: Sean creates `rules/mod.rs` first, Aleksandr waits
3. Pull main daily: Prevents drift

### Division of Labor Summary

**Sean's Responsibilities**:
- Phase 1: Foundation (structure, dependencies)
- Phase 3: LangGraph agent system (TypeScript)
- Phase 5a: Access Control & Secrets rules (Rust)
- Phase 6: Claude API client (Rust + prompts)
- Phase 8: Tauri commands (wire everything together)

**Aleksandr's Responsibilities**:
- Phase 2: Database layer (schema, models, migrations)
- Phase 4: Scanning engine (framework detection, file watching, tree-sitter)
- Phase 5b: Logging & Resilience rules (Rust)
- Phase 7: Git integration (git2, fix application)
- Phase 9: Frontend integration (connect UI to backend)

**Both Together**:
- Phase 10: E2E testing (pair programming)

---

## Testing Requirements (99% Coverage)

### Rust Unit Tests
- Target: 99% coverage across all modules
- Run: `cargo test --workspace`
- Each module has dedicated test file
- Edge cases documented

**Minimum Test Coverage Per Module**:
- Database: 20+ tests (schema, migrations, queries, constraints)
- Models: 15+ tests per model (serialization, enums, validation)
- Scanner: 30+ tests (framework detection, file watching, parsing)
- Rules: 30+ tests per control (all violation patterns, false positives)
- Fix Generator: 15+ tests (API client, prompt building, error handling)
- Git Operations: 10+ tests (commit, clean check, branch detection)
- Tauri Commands: 20+ tests per command (280+ total)

### Frontend Component Tests
- Create `*.test.tsx` for all components with @testing-library/react
- Test user interactions
- Test error states
- Test loading states

### E2E Tests with Playwright
- Complete scan workflow (select project → scan → view violations → apply fix)
- Fix application for each SOC 2 control
- Git integration verification
- File watcher real-time updates

### Integration Tests
- Scan Python Django project → Detect violations → Generate fixes → Apply → Git commit
- Scan JavaScript Express project → Detect violations → Generate fixes → Apply → Git commit
- File watcher triggers scan → Real-time violation updates → Frontend displays

---

## Development Commands

### Quick Start
```bash
# Install dependencies (runs once)
pnpm install

# Run Tauri desktop app with hot-reload (recommended for development)
pnpm tauri dev

# Build production
pnpm build              # Next.js static export
pnpm tauri build        # Desktop app bundle

# Development only
pnpm dev                # Next.js dev server (http://localhost:3000)
pnpm lint               # Run ESLint
```

### Testing
```bash
# Rust tests
cargo test --workspace

# Frontend tests
pnpm vitest --coverage

# E2E tests
pnpm playwright test

# Verify 99% coverage
cargo tarpaulin --out Html
pnpm vitest --coverage
```

### Tauri Development Notes
- `pnpm tauri dev` runs Next.js in static export mode and launches Tauri window
- Next.js dev server (`pnpm dev`) is separate and useful for isolated frontend testing
- MCP plugin only enabled in debug builds, exposes Unix socket at `/tmp/tauri-mcp.sock`
- Rebuild Rust code: changes to `src-tauri/src/*.rs` require restarting `pnpm tauri dev`

---

## Success Criteria

All must be completed before considering the project done:

- [ ] All 14 Tauri commands fully implemented and tested
- [ ] 99% test coverage across all Rust modules
- [ ] File watcher provides real-time compliance feedback
- [ ] All 4 SOC 2 controls (CC6.1, CC6.7, CC7.2, A1.2) detected and fixed
- [ ] Claude Haiku 4.5 fix generation working
- [ ] Git commit integration working
- [ ] Frontend progressively updated with real backend data
- [ ] E2E tests passing for complete workflows
- [ ] No TypeScript errors (remove ignoreBuildErrors from next.config.mjs)
- [ ] Complete CI/CD ready for production

---

## Known Issues to Address

1. **TypeScript Errors Ignored**: `next.config.mjs` has `ignoreBuildErrors: true` - TypeScript errors don't block builds but should be addressed during Phase 9
2. **Backend Stub Implementation**: All Tauri commands in `main.rs` are TODO stubs returning mock data - will be replaced in Phase 8
3. **Incorrect Package Name**: `package.json` lists `"name": "my-v0-project"` instead of `"ryn"` - fix in Phase 1

---

## Assumptions

- User has ANTHROPIC_API_KEY set in .env
- Project uses Python (Django/Flask) or JavaScript/TypeScript (Express/Next.js)
- Git repository is initialized and clean before fixes applied
- Claude Haiku 4.5 API is accessible
- Tauri dev environment working (pnpm tauri dev)
- macOS development environment (cross-platform support via Tauri)

---

## Quick Reference Commands

```bash
# Start new phase
git checkout main && git pull origin main
git checkout -b your-name/phase-X-description

# Save work
git add . && git commit -m "description"
git push origin your-name/phase-X-description

# Sync with main
git fetch origin main && git merge origin/main

# Finish phase
git push origin your-name/phase-X-description
# Create PR on GitHub
# After merge: git checkout main && git pull origin main

# See what other person is working on
git fetch origin
git branch -r
git log origin/aleksandr/phase-2-database
```

---

## Timeline Summary

| Phase | Days | Who | Description | Dependencies |
|-------|------|-----|-------------|--------------|
| 1 | 1-2 | Sean | Foundation, dependencies, structure | None |
| 2 | 2-3 | Aleksandr | Database schema, models, migrations | Phase 1 |
| 3 | 3-5 | Sean | LangGraph agent system (TypeScript) | Phase 2 |
| 4 | 3-5 | Aleksandr | Scanning engine (Rust) | Phase 2 |
| 5a | 8-12 | Sean | Access Control & Secrets rules | Phase 3 & 4 |
| 5b | 8-12 | Aleksandr | Logging & Resilience rules | Phase 3 & 4 |
| 6 | 12-15 | Sean | Claude API client | Phase 5 |
| 7 | 15-16 | Aleksandr | Git integration | Phase 6 |
| 8 | 16-17 | Sean | Tauri commands | Phase 7 |
| 9 | 17-19 | Aleksandr | Frontend integration | Phase 8 |
| 10 | 19-20 | Both | E2E testing (pair) | Phase 9 |

**Total: 20 days for production-ready implementation with 99% test coverage**

**Parallel Opportunities**:
- Phases 3 & 4: Run simultaneously (different languages, no conflicts)
- Phases 5a & 5b: Run simultaneously (different files, coordinate on mod.rs)

---

## The 10x Value Proposition (Market Context)

### What Makes Ryn Different

**Current State** (Vanta, Drata, Secureframe):
- Infrastructure monitoring only (AWS config, employee laptops)
- Manual screenshot evidence collection ("screenshot tax")
- Zero application code scanning
- Developers spend 100-300+ hours on manual compliance work

**Ryn's Innovation**:
1. Real-time compliance checking as you code (file watching)
2. AI-powered automated remediation (LangGraph + Claude Haiku 4.5)
3. Framework-specific scanners (Django, Flask, Express patterns)
4. Automated audit logging verification
5. Secrets management validation
6. RBAC permission matrix testing

### Developer Pain Points Ryn Solves

**Before Ryn** (manual compliance):
- 2-4 hours per violation to manually implement fix
- 6-12 months to get SOC 2 ready
- Discover gaps during audit, not during development
- 10-25% engineering capacity drop during active compliance
- $20-50K first-year total cost (platform + audit + engineering time)

**After Ryn** (automated compliance):
- 15 minutes to review AI-generated fix
- Catch violations on save (2 minutes) vs in production (2 hours)
- Continuous compliance feedback during development
- One-click fix application via git commit
- Transform SOC 2 from 6-12 month burden into continuous automated process

**Time Savings**:
- 150-400 hours saved per 100 violations (from 2-4 hours each to 15 minutes each)
- 95+ hours saved catching compliance drift early (5 min vs 2 hours per finding)
- Eliminate weeks of manual evidence collection

### Market Opportunity

- $15B SOC 2 market growing 12-25% CAGR
- Zero tools scan application code (100% focus on infrastructure)
- 70% of enterprises require SOC 2 in procurement
- Only 7% of seed startups have SOC 2, but it's mandatory for enterprise deals
- Developer sentiment: "Security theater", "#1 feature request: tools should fix issues"

---

This is the single source of truth. Reference this document for all implementation details, collaboration workflow, and phase dependencies.
