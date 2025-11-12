# Agent Coordination - Phase 3 & 4 Parallel Work

**Current State**: Phase 2 ✅ Complete, Phase 3 ✅ Complete
**Next**: Phase 3 & 4 work can proceed IN PARALLEL - no blocking dependencies

## Agent Assignments

### Agent 1: Phase 3 Work (COMPLETE)
**Agent Type**: general-purpose or specialized Rust/TypeScript dev
**Work**: ✅ DONE - LangGraph Agent System
**Commit**: `1c944d4`
**Files**: `lib/langgraph/*`, `src-tauri/src/langgraph/*`
**Tests**: 65+ passing (10 Rust + 55 TypeScript)

**What was built**:
- TypeScript StateGraph with 4 nodes
- SOC 2 prompt templates
- Rust-TypeScript bridge
- Comprehensive tests

### Agent 2: Phase 4 Work (READY TO START)
**Agent Type**: Rust specialist
**Work**: Scanning Engine
**Type**: Pure Rust, file system operations
**No dependencies**: Phase 3 is INDEPENDENT of Phase 4

**What to build**:
1. Framework detector (Django, Flask, Express, Next.js, React)
2. File watcher with real-time events
3. Tree-sitter AST parser for Python/JavaScript/TypeScript
4. 30+ tests

---

## Why These Can Work in Parallel

### No Code Dependencies
```
Phase 3 (Agent 1):          Phase 4 (Agent 2):
lib/langgraph/              src-tauri/src/scanner/
  - agent.ts                  - framework_detector.rs
  - prompts.ts                - file_watcher.rs
  - types.ts                  - tree_sitter_utils.rs

NO SHARED FILES - No conflicts possible
```

### Data Flow (One-directional)
```
Phase 4 Output (violations, framework)
    ↓
    ↓ INPUT TO Phase 3
    ↓
Phase 3 (LangGraph agent)
    ↓
Phase 3 Output (fixes)
```

**Phase 3 does NOT depend on Phase 4's implementation.**
- Phase 3 works with mock violations in tests
- Phase 4 will integrate with Phase 3 later (Phase 5+)

### Resource Independence
```
Agent 1: TypeScript/Node.js + Rust (langgraph module)
Agent 2: Pure Rust (scanner module, file system, tree-sitter)

No shared build targets, no compilation conflicts
```

---

## Git Workflow for Parallel Work

### Before Agents Start

```bash
# Current state (both agents)
git log --oneline -1
# 1c944d4 Phase 3: LangGraph Agent System - Complete implementation

# Current branch: main
git branch -a
# * main
```

### Agent 1 (Phase 3) - ALREADY COMPLETE
Branch: `main` (committed directly, Phase 1-3 are foundational)

### Agent 2 (Phase 4) - STARTS NOW
```bash
# Agent 2: Create feature branch for Phase 4
git checkout main
git pull
git checkout -b phase-4-scanning-engine

# Work on Phase 4 implementation
# Files created:
#  - src-tauri/src/scanner/framework_detector.rs
#  - src-tauri/src/scanner/file_watcher.rs
#  - src-tauri/src/scanner/tree_sitter_utils.rs
#  - src-tauri/src/scanner/python_scanner.rs
#  - src-tauri/src/scanner/javascript_scanner.rs

# When done, create comprehensive commit:
git add src-tauri/src/scanner
git commit -m "Phase 4: Scanning Engine - Framework detection, file watching, AST parsing"
git push origin phase-4-scanning-engine

# Create PR or merge to main (per team workflow)
```

---

## What Each Agent Needs

### Agent 1 (Phase 3 - Already Complete)
✅ Complete - provided context: `.claude/docs/phase-3-langgraph-complete.md`

### Agent 2 (Phase 4 - Starting Now)
Complete spec: `.claude/docs/phase-4-scanning-spec.md`

**Key files to reference**:
1. `src-tauri/Cargo.toml` - Dependencies already added
   - notify = "6"
   - tree-sitter = "0.22"
   - tree-sitter-python = "0.21"
   - tree-sitter-javascript = "0.21"
   - tree-sitter-typescript = "0.21"

2. `src-tauri/src/lib.rs` - Module exports
   - `pub mod scanner;` - Already declared, waiting for implementation

3. `src-tauri/src/models/violation.rs` - Already defined
   - Use Violation struct for scanner output

4. `rynspec/ryn-master-plan.md` - Full project spec
   - Reference for Phase 4 requirements

---

## Coordination Points

### Phase 4 Integration with Phase 3 (Phase 5+)
Both modules will work together but no direct integration until Phase 5:

```
Phase 5 (SOC 2 Rules):
  - Takes Phase 4's AST and framework detection
  - Uses Phase 3's agent for fix generation
```

### No Communication Needed Between Agents
- **Agent 1 (Phase 3)**: Works with mock data, doesn't need Scanner output
- **Agent 2 (Phase 4)**: Doesn't depend on Agent 1, pure framework/file detection

### Both Can Test Independently
```
Agent 1: npm test lib/langgraph/
Agent 2: cargo test --lib scanner
```

---

## Success Criteria

### Agent 1 (Phase 3) - COMPLETE ✅
- [x] `cargo build` succeeds
- [x] `cargo test --lib langgraph` passes 10/10 tests
- [x] TypeScript compiles with no errors
- [x] 65+ tests pass
- [x] Committed to main

### Agent 2 (Phase 4) - Success Criteria
- [ ] `cargo build` succeeds with no warnings
- [ ] `cargo test --lib scanner` passes 30+ tests
- [ ] Framework detection works for 5 frameworks
- [ ] File watcher correctly ignores node_modules, .git, etc.
- [ ] Tree-sitter parsing works for Python/JS/TS
- [ ] All functions documented with comments
- [ ] Ready to merge to main

---

## File Locations Reference

### Phase 3 Files (Already Complete)
```
lib/
  langgraph/
    ├── types.ts
    ├── agent.ts
    ├── prompts.ts
    ├── index.ts
    ├── agent.test.ts
    └── prompts.test.ts

src-tauri/src/
  langgraph/
    ├── agent_runner.rs
    └── mod.rs
```

### Phase 4 Files (To Be Created)
```
src-tauri/src/
  scanner/
    ├── mod.rs                    (NEW - module organization)
    ├── framework_detector.rs     (NEW - framework detection)
    ├── file_watcher.rs           (NEW - file watching)
    ├── tree_sitter_utils.rs      (NEW - AST parsing)
    ├── python_scanner.rs         (NEW - stub for Phase 5)
    └── javascript_scanner.rs     (NEW - stub for Phase 5)
```

---

## How to Hand Off Between Phases

### Agent 1 → Agent 2 (After Phase 3)
**Hand-off checklist**:
- [x] Phase 3 code is committed and builds
- [x] All Phase 3 tests pass
- [x] Comprehensive context doc written: `phase-3-langgraph-complete.md`
- [x] Agent 2 has: `phase-4-scanning-spec.md`
- [ ] Agent 2 understands data flow from Phase 4 → Phase 3

### Agent 2 → Agent 3 (After Phase 4)
Will happen after Phase 4 is complete. Agent 3 will work on Phase 5 (SOC 2 Rules).

---

## Emergency Procedures

### If Agent 2 Breaks the Build
1. Check `cargo build` output
2. Verify Cargo.toml dependencies are correct
3. Ensure all use statements are valid
4. File issues clearly (file:line number format)

### If Tests Fail
1. Run: `cargo test --lib scanner -- --nocapture`
2. Check test implementation for errors
3. Fix test or implementation accordingly

### If Git Conflicts Arise (UNLIKELY)
Phase 4 is on completely separate files, conflicts should not occur.

If someone else pushed to main while Phase 4 is in development:
```bash
git fetch origin
git rebase origin/main phase-4-scanning-engine
# If conflicts (very unlikely): resolve and continue
git rebase --continue
```

---

## Communication Points

### Before Starting Phase 4
- [ ] Review `phase-4-scanning-spec.md` completely
- [ ] Check `ryn-master-plan.md` for context
- [ ] Verify all dependencies in `Cargo.toml` exist
- [ ] Ask questions about spec if anything is unclear

### While Working on Phase 4
- [ ] Run `cargo test --lib scanner` frequently (every file)
- [ ] Use `cargo check` to catch errors early
- [ ] Keep commits atomic (one feature = one commit)
- [ ] Write comprehensive test cases as you code

### When Submitting Phase 4
- [ ] All tests pass: `cargo test --lib scanner`
- [ ] Build succeeds: `cargo build`
- [ ] No warnings: check full build output
- [ ] Comprehensive commit message (see example below)
- [ ] Pull request or merge request (per team workflow)

---

## Example Commit Message for Phase 4

```
Phase 4: Scanning Engine - Framework detection, file watching, AST parsing

DELIVERABLES:
- src-tauri/src/scanner/framework_detector.rs: Framework detection (Django, Flask, Express, Next.js, React)
  * Detects frameworks from file patterns and package manager files
  * 10+ tests covering all framework types
  * 250 lines

- src-tauri/src/scanner/file_watcher.rs: Real-time file monitoring
  * Watches project files for changes
  * Filters by extension and ignores patterns
  * Async event channel for file events
  * 10+ tests
  * 300 lines

- src-tauri/src/scanner/tree_sitter_utils.rs: AST parsing
  * Parses Python, JavaScript, TypeScript
  * Extracts functions, classes, imports
  * Position and line number tracking
  * 10+ tests
  * 350 lines

- src-tauri/src/scanner/python_scanner.rs: Python scanning (stub)
  * Placeholder for Phase 5 rule implementation

- src-tauri/src/scanner/javascript_scanner.rs: JavaScript scanning (stub)
  * Placeholder for Phase 5 rule implementation

BUILD STATUS:
✅ cargo build: Success, zero warnings
✅ cargo test --lib scanner: 30+ tests passing
✅ Full documentation and comments

READY FOR:
Phase 5: SOC 2 Rule Engines (uses scanner output)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Token Usage Tips for Agents

### Phase 3 Agent
**Tokens used**: ~70k for planning + implementation + testing
**Remaining from 200k**: ~130k
**For this handoff document**: ~20k (total 140k used)

### Phase 4 Agent (Starting Fresh or Resuming)
**Can request fresh 200k tokens** when starting if continuing from previous context
**Alternative**: Use context from `.claude/docs/phase-4-scanning-spec.md` as the single source of truth

### Recommendation
Each agent should:
1. Read their phase spec from `.claude/docs/`
2. Review Phase 2 database models if needed
3. Ask clarifying questions before coding
4. Run tests frequently to verify correctness
5. Create detailed commit messages

---

## Phase 3 & 4 Are NOW READY FOR SUBAGENTS

**Status Summary**:
```
Phase 2: ✅ COMPLETE - Database (commit: 7cdad23)
Phase 3: ✅ COMPLETE - LangGraph Agent (commit: 1c944d4)
Phase 4: 🚀 READY - Scanning Engine (spec: phase-4-scanning-spec.md)
Phase 5: ⏳ BLOCKED on Phase 4 completion
Phase 6+: ⏳ Sequential dependencies
```

**Agents can proceed with HIGH confidence.**
All blocking work is complete. No circular dependencies.
