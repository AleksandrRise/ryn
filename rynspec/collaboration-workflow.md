# Ryn Collaboration Workflow: Sean & Aleksandr

**Simple feature branch workflow aligned with plan.md, maximizing parallel work, zero conflicts.**

---

## Core Strategy

**Parallel work wherever possible, sequential where required.**

- When phases touch different files/languages → work in parallel
- When phases have dependencies → work sequentially
- When phases touch same files → coordinate who goes first

**Key Principle**: One person = one clear module at a time = one branch.

---

## Git Workflow (Simple Feature Branches)

### Initial Setup (Both Developers - Do Once)

```bash
# 1. Ensure you're on latest main
git checkout main
git pull origin main

# 2. Verify remote setup
git remote -v
# Should show: origin  https://github.com/AleksandrRise/ryn.git
```

### Daily Workflow

#### Starting Work Each Day

```bash
# 1. Update main branch
git checkout main
git pull origin main

# 2. Create your feature branch
git checkout -b your-name/phase-X-description
# Example: git checkout -b sean/phase-1-foundation
```

#### During Work

```bash
# Commit frequently (every 30-60 minutes)
git add <files>
git commit -m "Clear description"

# Push to remote regularly (every few commits)
git push origin your-branch-name
```

#### Syncing with Main (Daily)

```bash
# While on your feature branch
git fetch origin main
git merge origin/main

# Fix conflicts if they occur, then:
git add <fixed-files>
git commit
```

#### Finishing Your Work

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

---

## Work Division (Aligned with plan.md)

### Phase 1: Foundation (Day 1-2) - **SEAN ONLY**
**Branch**: `sean/phase-1-foundation`

**Why Sean**: Needs to set up structure for both developers. Sequential blocker for everyone.

**Files to create/modify**:
- `src-tauri/Cargo.toml` (add all dependencies: tree-sitter, git2, notify, tokio, reqwest, rusqlite, etc.)
- `package.json` (add LangGraph: @langchain/core, @langchain/langgraph, @langchain/anthropic, vitest, playwright)
- `.env.example` and `.env`
- `.gitignore` (add .env, *.db)
- Create complete Rust module structure:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/commands/mod.rs` (empty)
  - `src-tauri/src/models/mod.rs` (empty)
  - `src-tauri/src/db/mod.rs` (empty)
  - `src-tauri/src/scanner/mod.rs` (empty)
  - `src-tauri/src/langgraph/mod.rs` (empty)
  - `src-tauri/src/rules/mod.rs` (empty)
  - `src-tauri/src/fix_generator/mod.rs` (empty)
  - `src-tauri/src/git/mod.rs` (empty)
  - `src-tauri/src/utils/mod.rs` (empty)
- `vitest.config.ts` and `vitest.setup.ts`

**Deliverable**: Complete project structure with all dependencies installed. Rust builds successfully. Tests run.

**Aleksandr during Phase 1**: Review plan.md thoroughly. Prepare for Phase 2 database work.

---

### Phase 2: Database Layer (Day 2-3) - **ALEKSANDR ONLY**
**Branch**: `aleksandr/phase-2-database`

**Why Aleksandr**: Pure Rust database work. Sean prepares for Phase 3 (TypeScript).

**Wait for**: Phase 1 merged to main.

**Files to create/modify**:
- `src-tauri/src/db/schema.sql` (complete schema: projects, scans, violations, fixes, audit_events, controls, settings)
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/queries.rs`
- `src-tauri/src/models/project.rs`
- `src-tauri/src/models/scan.rs`
- `src-tauri/src/models/violation.rs`
- `src-tauri/src/models/fix.rs`
- `src-tauri/src/models/audit.rs`
- `src-tauri/src/models/control.rs`
- `src-tauri/src/models/settings.rs`
- `src-tauri/src/models/mod.rs`

**Deliverable**: Complete database schema, all models with serde derives, migrations, query functions with tests.

**Sean during Phase 2**: Review plan.md Phase 3 (LangGraph). Prepare TypeScript agent structure.

---

### Phase 3 & 4: PARALLEL WORK (Day 3-5) - **BOTH**

These phases touch completely different files and languages. Work simultaneously.

#### Phase 3: LangGraph Agent System - **SEAN**
**Branch**: `sean/phase-3-langgraph`

**Why Sean**: TypeScript/Node.js work. Completely separate from Aleksandr's Rust scanning work.

**Wait for**: Phase 2 merged to main.

**Files to create/modify** (all TypeScript):
- `lib/langgraph/agent.ts` (StateGraph, nodes: parse, analyze, generate_fixes, validate)
- `lib/langgraph/types.ts`
- `lib/langgraph/prompts.ts`
- `src-tauri/src/langgraph/agent_runner.rs` (Rust bridge to TypeScript)
- `src-tauri/src/langgraph/mod.rs`

**Deliverable**: Complete LangGraph state machine with nodes, Rust-TypeScript bridge, tests.

#### Phase 4: Scanning Engine - **ALEKSANDR**
**Branch**: `aleksandr/phase-4-scanning`

**Why Aleksandr**: Pure Rust scanning work. Completely separate from Sean's TypeScript agent work.

**Wait for**: Phase 2 merged to main.

**Files to create/modify** (all Rust):
- `src-tauri/src/scanner/framework_detector.rs` (detect Django, Flask, Express, Next.js, React)
- `src-tauri/src/scanner/file_watcher.rs` (notify-based file watching)
- `src-tauri/src/scanner/tree_sitter_utils.rs` (AST parsing helpers)
- `src-tauri/src/scanner/python_scanner.rs` (tree-sitter Python)
- `src-tauri/src/scanner/javascript_scanner.rs` (tree-sitter JS/TS)
- `src-tauri/src/scanner/mod.rs`

**Deliverable**: Framework detection, file watching, tree-sitter AST parsing for Python and JS/TS with tests.

**Coordination**: None needed. Different files, different languages. Merge both when done.

---

### Phase 5: SOC 2 Rule Engines (Day 8-12) - **SPLIT PARALLEL**

Both work on Rust rules in `src-tauri/src/rules/` but different files.

**Wait for**: Both Phase 3 and Phase 4 merged to main.

#### Phase 5a: Access Control & Secrets - **SEAN**
**Branch**: `sean/phase-5-rules-cc6`

**Files to create/modify**:
- `src-tauri/src/rules/mod.rs` (Sean creates this FIRST, then pushes)
- `src-tauri/src/rules/cc6_1_access_control.rs` (missing auth, RBAC checks)
- `src-tauri/src/rules/cc6_7_secrets.rs` (hardcoded secrets, vault integration)

**Deliverable**: CC6.1 and CC6.7 rule engines with regex patterns, tests (30+ test cases).

#### Phase 5b: Logging & Resilience - **ALEKSANDR**
**Branch**: `aleksandr/phase-5-rules-cc7-a1`

**Wait for**: Sean to create and push `rules/mod.rs` first (coordinate on Slack/Discord).

**Files to create/modify**:
- `src-tauri/src/rules/cc7_2_logging.rs` (missing audit logs, PII in logs)
- `src-tauri/src/rules/a1_2_resilience.rs` (error handling, circuit breakers)

**Deliverable**: CC7.2 and A1.2 rule engines with regex patterns, tests (30+ test cases).

**Coordination Required**: Sean creates `rules/mod.rs`, commits, and pushes. Aleksandr waits for that commit, then pulls and adds his rules to the module. Merge both when done (Sean first, then Aleksandr).

---

### Phase 6: Fix Generation with Claude (Day 12-15) - **SEAN ONLY**
**Branch**: `sean/phase-6-claude-client`

**Why Sean**: Claude API integration, LLM prompts. Sequential after rules are done.

**Wait for**: Both Phase 5a and 5b merged to main.

**Files to create/modify**:
- `src-tauri/src/fix_generator/claude_client.rs` (Anthropic API client with streaming, error handling, prompt caching)
- `src-tauri/src/fix_generator/mod.rs`
- `src-tauri/src/utils/env.rs` (load ANTHROPIC_API_KEY from .env)
- `lib/langgraph/prompts.ts` (prompt templates for each SOC 2 control)

**Deliverable**: Claude Haiku 4.5 API client with streaming, error handling, prompt templates for all 4 controls, tests.

**Aleksandr during Phase 6**: Review plan.md Phase 7 (Git operations). Prepare for git2 integration.

---

### Phase 7: Git Integration (Day 15-16) - **ALEKSANDR ONLY**
**Branch**: `aleksandr/phase-7-git-ops`

**Why Aleksandr**: Pure Rust git2 work. Sequential after Claude client is done.

**Wait for**: Phase 6 merged to main.

**Files to create/modify**:
- `src-tauri/src/fix_generator/fix_applicator.rs` (apply fixes to files, validation)
- `src-tauri/src/git/operations.rs` (git2: commit, clean check, branch detection)
- `src-tauri/src/git/mod.rs`

**Deliverable**: File modification, git commit functionality, tests.

**Sean during Phase 7**: Review plan.md Phase 8 (Tauri commands). Prepare to wire everything together.

---

### Phase 8: Tauri Commands (Day 16-17) - **SEAN ONLY**
**Branch**: `sean/phase-8-tauri-commands`

**Why Sean**: Wiring all backend modules together. Needs everything from previous phases.

**Wait for**: Phase 7 merged to main.

**Files to create/modify**:
- `src-tauri/src/commands/project.rs` (create_project, get_projects, select_project)
- `src-tauri/src/commands/scan.rs` (start_scan, get_scans, get_violations)
- `src-tauri/src/commands/violation.rs` (get_violation_detail)
- `src-tauri/src/commands/fix.rs` (generate_fix, apply_fix)
- `src-tauri/src/commands/audit.rs` (get_audit_events)
- `src-tauri/src/commands/settings.rs` (get_settings, update_settings)
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/main.rs` (register all commands in invoke_handler)

**Deliverable**: All 14 Tauri commands implemented and registered. Backend fully functional.

**Aleksandr during Phase 8**: Review plan.md Phase 9 (Frontend integration). Prepare to connect frontend.

---

### Phase 9: Frontend Integration (Day 17-19) - **ALEKSANDR ONLY**
**Branch**: `aleksandr/phase-9-frontend`

**Why Aleksandr**: Frontend TypeScript work. Sequential after backend is complete.

**Wait for**: Phase 8 merged to main.

**Files to create/modify**:
- `lib/tauri/commands.ts` (update from stubs to real Tauri command calls)
- Update frontend pages to use real data instead of mocks
- Remove mock data from components

**Deliverable**: Fully integrated frontend with real backend. All pages functional.

**Sean during Phase 9**: Review plan.md Phase 10 (Testing). Prepare E2E test scenarios.

---

### Phase 10: Comprehensive Testing (Day 19-20) - **BOTH (PAIR)**
**Branch**: `shared/phase-10-e2e-tests`

**Why Both**: Pair programming on E2E tests. Work together in real-time.

**Wait for**: Phase 9 merged to main.

**Files to create/modify**:
- `tests/e2e/scan-workflow.spec.ts` (complete scan workflow)
- `tests/e2e/fix-application.spec.ts` (fix generation and application)
- `tests/e2e/git-integration.spec.ts` (git commit workflow)
- Additional Playwright tests as needed

**Work together**: Both developers on same branch, communicating in real-time (Slack/Discord screen share).

**Deliverable**: E2E tests passing, 99% coverage verified, all edge cases tested.

---

## Communication Protocol

### Before Starting Work
**Message the other person**: "Starting [branch name], working on [phase description]"

### During Parallel Work (Phase 3-4, Phase 5a-5b)
- **Push frequently**: Every 2-3 commits
- **Status updates**: Quick message when major component done
- **No coordination needed**: Different files = no conflicts

### During Sequential Work
- **Wait for PR merge**: Don't start your phase until previous is merged
- **Pull main immediately**: Get latest changes before creating branch

### Conflict Prevention
1. **Never work on same file simultaneously** (except Phase 10 pairing)
2. **Phase 5 coordination**: Sean creates `rules/mod.rs` first, Aleksandr waits
3. **Pull main daily**: Prevents drift

---

## Example Timeline (First Week)

### Day 1
- **Sean**: Phase 1 foundation, sets up all dependencies and structure
- **Aleksandr**: Reviews plan.md, prepares for database work

### Day 2
- **Sean**: Finishes Phase 1, creates PR, gets it merged. Prepares for Phase 3.
- **Aleksandr**: Pulls main with Phase 1, starts Phase 2 database branch

### Day 3
- **Sean**: Starts Phase 3 (LangGraph TypeScript)
- **Aleksandr**: Finishes Phase 2 database, creates PR. Starts Phase 4 (Scanning Rust)

**Both working in parallel now** - different files, different languages

### Day 4
- **Sean**: Continues Phase 3 (LangGraph)
- **Aleksandr**: Continues Phase 4 (Scanning)

### Day 5
- **Sean**: Finishes Phase 3, creates PR
- **Aleksandr**: Finishes Phase 4, creates PR

**Both PRs merged** - ready for Phase 5

### Day 6-8
- **Sean**: Phase 5a (CC6.1, CC6.7 rules) - creates `rules/mod.rs` first
- **Aleksandr**: Phase 5b (CC7.2, A1.2 rules) - waits for `rules/mod.rs`, then adds his rules

**Pattern**: Maximize parallel work, minimize waiting, clear handoffs for sequential phases.

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

## Summary

**Simple workflow maximizing parallel work**:
1. Phase 1: Sean only (foundation)
2. Phase 2: Aleksandr only (database)
3. Phase 3 + 4: PARALLEL - Sean (LangGraph TypeScript) + Aleksandr (Scanning Rust)
4. Phase 5: PARALLEL SPLIT - Sean (CC6.1, CC6.7) + Aleksandr (CC7.2, A1.2)
5. Phase 6: Sean only (Claude client)
6. Phase 7: Aleksandr only (Git ops)
7. Phase 8: Sean only (Tauri commands)
8. Phase 9: Aleksandr only (Frontend)
9. Phase 10: BOTH PAIR (E2E tests)

**Zero conflicts**: Different files when parallel, clear handoffs when sequential.
