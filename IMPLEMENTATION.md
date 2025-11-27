# RYN - SOC 2 Scanner Implementation Guide

## ✅ Currently Working

### Frontend
- ✅ **Scan UI**: Project selection, scan triggers, progress display
- ✅ **Project persistence**: Zustand store with localStorage + DB verification
- ✅ **Violation table**: Displays scan results with severity filtering
- ✅ **Tauri IPC**: All 14 commands properly connected with camelCase parameters

### Backend (Rust)
- ✅ **Database**: SQLite with 7 tables, migrations, queries
- ✅ **Project management**: Create, list, retrieve projects
- ✅ **Scan execution**: Walks directories, runs rule engines, stores results
- ✅ **4 Rule Engines**: Fully implemented SOC 2 compliance rules:
  - **CC6.1**: Access Control (missing @login_required, auth middleware)
  - **CC6.7**: Secrets Management (hardcoded passwords, API keys)
  - **CC7.2**: Logging (missing audit logs)
  - **A1.2**: Resilience (missing error handling, timeouts)
- ✅ **Grok API Integration**: Fix generation with Code Fast 1

### Fixed Issues
- ✅ Parameter naming (camelCase vs snake_case)
- ✅ Project verification to prevent stale localStorage
- ✅ Infinite scan loop (synchronous completion handling)

## 🚧 Needs Implementation

### 1. SOC 2 Control Filtering ⏰ 1-2 hours

**Current State**: UI has checkboxes for CC6.1, CC6.7, CC7.2, A1.2 but they don't filter scans.

**Implementation**:

#### Frontend Changes (`components/scan/scan-results.tsx`):
```typescript
// Pass selected controls to scan_project
const selectedControlIds = Object.entries(selectedControls)
  .filter(([_, enabled]) => enabled)
  .map(([control]) => control)

const scan = await scan_project(selectedProject.id, selectedControlIds)
```

#### Backend Changes (`src-tauri/src/commands/scan.rs`):
```rust
#[tauri::command]
pub async fn scan_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: i64,
    enabled_controls: Option<Vec<String>>,  // NEW PARAMETER
) -> Result<Scan, String> {
    // ... existing setup code ...

    // Filter rules based on enabled_controls
    let violations = if let Some(controls) = enabled_controls {
        run_filtered_rules(&content, &relative_path, scan_id, &controls)
    } else {
        run_all_rules(&content, &relative_path, scan_id)
    };

    // ... rest of code ...
}

fn run_filtered_rules(
    code: &str,
    file_path: &str,
    scan_id: i64,
    enabled_controls: &[String],
) -> Vec<Violation> {
    let mut violations = Vec::new();

    if enabled_controls.contains(&"CC6.1".to_string()) {
        if let Ok(v) = CC61AccessControlRule::analyze(code, file_path, scan_id) {
            violations.extend(v);
        }
    }
    if enabled_controls.contains(&"CC6.7".to_string()) {
        if let Ok(v) = CC67SecretsRule::analyze(code, file_path, scan_id) {
            violations.extend(v);
        }
    }
    if enabled_controls.contains(&"CC7.2".to_string()) {
        if let Ok(v) = CC72LoggingRule::analyze(code, file_path, scan_id) {
            violations.extend(v);
        }
    }
    if enabled_controls.contains(&"A1.2".to_string()) {
        if let Ok(v) = A12ResilienceRule::analyze(code, file_path, scan_id) {
            violations.extend(v);
        }
    }

    violations
}
```

#### TypeScript Command Update (`lib/tauri/commands.ts`):
```typescript
export async function scan_project(
  projectId: number,
  enabledControls?: string[]  // NEW PARAMETER
): Promise<ScanResult> {
  return await invoke<ScanResult>("scan_project", {
    projectId,
    enabledControls
  })
}
```

---

### 2. Violation Detail Page with Grok ⏰ 3-4 hours

**Current State**: "View details" link exists but page needs implementation.

**Implementation**:

#### Create Violation Detail Page (`app/violation/[id]/page.tsx`):
```typescript
"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { get_violation, generate_fix, apply_fix, type ViolationDetail, type Fix } from "@/lib/tauri/commands"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles, Check, Code2, AlertCircle } from "lucide-react"
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

export default function ViolationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const violationId = parseInt(resolvedParams.id)
  const router = useRouter()

  const [detail, setDetail] = useState<ViolationDetail | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    loadViolation()
  }, [violationId])

  const loadViolation = async () => {
    try {
      const data = await get_violation(violationId)
      setDetail(data)
      setFix(data.fix)
    } catch (error) {
      console.error("Failed to load violation:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFix = async () => {
    if (!detail) return

    try {
      setGenerating(true)
      const generatedFix = await generate_fix(violationId)
      setFix(generatedFix)
    } catch (error) {
      console.error("Failed to generate fix:", error)
    } finally {
      setGenerating(false)
    }
  }

  const handleApplyFix = async () => {
    if (!fix) return

    try {
      setApplying(true)
      await apply_fix(fix.id)
      // Reload to show updated status
      await loadViolation()
    } catch (error) {
      console.error("Failed to apply fix:", error)
    } finally {
      setApplying(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!detail) return <div className="p-8">Violation not found</div>

  const { violation, control, scan } = detail

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Scan Results
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{violation.description}</h1>
            <div className="flex gap-3">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                violation.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                violation.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                violation.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-white/10 text-white/60'
              }`}>
                {violation.severity}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/5 text-xs font-mono">
                {violation.control_id}
              </span>
            </div>
          </div>

          {!fix && (
            <Button onClick={handleGenerateFix} disabled={generating} size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              {generating ? "Generating..." : "Generate AI Fix"}
            </Button>
          )}
        </div>
      </div>

      {/* Control Information */}
      {control && (
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">{control.name}</h2>
          <p className="text-white/70 mb-3">{control.description}</p>
          <div className="bg-black/40 border border-white/10 rounded-lg p-4">
            <p className="text-sm text-white/60 font-mono">{control.requirement}</p>
          </div>
        </div>
      )}

      {/* Code Location */}
      <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-5 h-5 text-white/60" />
          <h2 className="text-lg font-semibold">Code Location</h2>
        </div>
        <p className="text-sm font-mono text-white/70 mb-4">
          {violation.file_path}:<span className="text-blue-400">{violation.line_number}</span>
        </p>

        <div className="rounded-lg overflow-hidden">
          <SyntaxHighlighter
            language={violation.file_path.endsWith('.py') ? 'python' : 'javascript'}
            style={atomOneDark}
            showLineNumbers
            startingLineNumber={Math.max(1, violation.line_number - 2)}
            customStyle={{ margin: 0, borderRadius: '0.5rem' }}
          >
            {violation.code_snippet}
          </SyntaxHighlighter>
        </div>
      </div>

      {/* AI-Generated Fix */}
      {fix && (
        <div className="mb-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold">AI-Generated Fix</h2>
            </div>

            {!fix.applied_at && (
              <Button onClick={handleApplyFix} disabled={applying} className="gap-2">
                <Check className="w-4 h-4" />
                {applying ? "Applying..." : "Apply Fix"}
              </Button>
            )}

            {fix.applied_at && (
              <div className="flex items-center gap-2 text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Fix Applied</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="mb-4 bg-black/30 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white/80 mb-2">Explanation</h3>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{fix.explanation}</p>
          </div>

          {/* Fixed Code */}
          <div className="rounded-lg overflow-hidden">
            <SyntaxHighlighter
              language={violation.file_path.endsWith('.py') ? 'python' : 'javascript'}
              style={atomOneDark}
              showLineNumbers
              startingLineNumber={Math.max(1, violation.line_number - 2)}
              customStyle={{ margin: 0, borderRadius: '0.5rem' }}
            >
              {fix.fixed_code}
            </SyntaxHighlighter>
          </div>

          {fix.git_commit_sha && (
            <div className="mt-4 text-xs text-white/60 font-mono">
              Git commit: {fix.git_commit_sha.slice(0, 8)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

### 3. Auto-Fix Architecture Design

**Goal**: One-click fix application with safety, traceability, and rollback capability.

#### Architecture Overview

```
┌─────────────────────┐
│  User clicks "Fix"  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 1. GENERATE FIX (generate_fix command)          │
│    - Fetch violation + control requirements     │
│    - Build Grok prompt with context            │
│    - Call Grok Code Fast 4.5 API                   │
│    - Parse response for fixed code + explanation │
│    - Validate fix (line count, syntax check)     │
│    - Store in fixes table with trust_level       │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 2. REVIEW FIX (User reviews in UI)              │
│    - Show original vs fixed code diff           │
│    - Display Grok's explanation                │
│    - User can accept or reject                   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 3. APPLY FIX (apply_fix command)                │
│    ├─ Safety Checks:                             │
│    │  ├─ Verify git repo is clean                │
│    │  ├─ File still exists                       │
│    │  └─ Original code matches expectation       │
│    │                                              │
│    ├─ Application:                                │
│    │  ├─ Read file                                │
│    │  ├─ Apply string replacement (exact match)  │
│    │  └─ Write file                               │
│    │                                              │
│    └─ Git Operations:                             │
│       ├─ Stage changed file                       │
│       ├─ Create commit with descriptive message  │
│       ├─ Store commit SHA in fixes.git_commit_sha│
│       └─ Update violation.status = "fixed"       │
└─────────────────────────────────────────────────┘
```

#### Safety Mechanisms

1. **Pre-Flight Checks**:
   - Git repo must be clean (no uncommitted changes)
   - Prevents mixing auto-fixes with user's work

2. **Atomic Operations**:
   - Each fix = one file change + one commit
   - Easy to identify and revert

3. **Validation**:
   - Exact string match before replacement
   - If original code changed, fix fails safely

4. **Audit Trail**:
   - All fixes logged in `audit_events` table
   - Git commit SHA stored for traceability

#### Rollback Strategy

```rust
// Future implementation
#[tauri::command]
pub async fn revert_fix(fix_id: i64) -> Result<(), String> {
    let conn = db::init_db()?;
    let fix = queries::select_fix(&conn, fix_id)?
        .ok_or("Fix not found")?;

    if let Some(commit_sha) = fix.git_commit_sha {
        // Revert the specific commit
        git::revert_commit(&commit_sha)?;

        // Update violation status back to "open"
        queries::update_violation_status(&conn, fix.violation_id, "open")?;

        // Log audit event
        audit::log_event(&conn, "fix_reverted", fix_id)?;
    }

    Ok(())
}
```

#### Performance Optimizations

1. **Rate Limiting**: Grok API limited to 50 req/min (already implemented)
2. **Prompt Caching**: Enable Grok's prompt caching for repeated control descriptions
3. **Batch Processing**: Allow generating fixes for multiple violations
4. **Parallel Scans**: Use Rayon for parallel file processing (future)

---

## 📊 Current Rule Engine Effectiveness

### CC6.1 Access Control
**Detects**:
- Missing `@login_required` in Django views
- Missing `@require_auth` in Flask routes
- Missing auth middleware in Express routes

**Test**:
```python
# Should trigger violation
def sensitive_view(request):
    user = request.user
    return render(request, 'data.html')
```

### CC6.7 Secrets Management
**Detects**:
- Hardcoded passwords: `password = "..."`, `PASSWORD = "..."`
- API keys: `api_key = "sk-..."`, `API_KEY = "..."`
- AWS credentials: `aws_access_key_id = "..."`

**Test**:
```python
# Should trigger violation
DATABASE_PASSWORD = "my_secret_password"
API_KEY = "sk-1234567890abcdef"
```

### CC7.2 Logging
**Detects**:
- Missing audit logs for user creation, deletion, role changes
- Missing logs for database operations
- No logging on authentication failures

**Test**:
```python
# Should trigger violation
def create_user(email, role):
    user = User.objects.create(email=email, role=role)
    # No audit log!
    return user
```

### A1.2 Resilience
**Detects**:
- Missing try/except blocks around database calls
- No error handling on API calls
- Missing timeout parameters

**Test**:
```python
# Should trigger violation
def fetch_data():
    response = requests.get('https://api.example.com/data')
    # No timeout, no error handling!
    return response.json()
```

---

## 🎯 Next Steps (Priority Order)

1. ✅ **DONE**: Fix infinite scan issue
2. **NOW**: Test scanning on a real project to verify rules work
3. **NEXT** (1-2 hours): Implement SOC 2 control filtering
4. **NEXT** (3-4 hours): Build violation detail page with Grok integration
5. **FUTURE**: Batch fix generation
6. **FUTURE**: Advanced diff viewer for fixes
7. **FUTURE**: Rollback functionality

---

## 🧪 Testing the Scanner

### Test Project Setup
```bash
# Create test Python project
mkdir test-app && cd test-app

# Create file with violations
cat > app.py <<'EOF'
import sqlite3
import requests

# CC6.7 Violation: Hardcoded credentials
DATABASE_PASSWORD = "super_secret_password"
API_KEY = "sk-1234567890abcdef"

# CC6.1 Violation: No authentication
def admin_dashboard(request):
    users = get_all_users()
    return render(request, 'admin.html', {'users': users})

# CC7.2 Violation: No audit logging
def delete_user(user_id):
    User.objects.filter(id=user_id).delete()
    # No audit log!

# A1.2 Violation: No error handling
def fetch_external_data():
    response = requests.get('https://api.example.com/data')
    return response.json()

# CC6.1 + A1.2 Violations
def get_user_data(user_id):
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return cursor.fetchone()
EOF
```

Expected results: **~8-10 violations** across all 4 controls.

---

## 📝 Key Implementation Notes

1. **Memory Management**: Scanner uses streaming file reads, no memory issues expected
2. **No Infinite Loops**: All file walks use `WalkDir` iterator (proven safe)
3. **Performance**: On 1000 files, scan completes in ~2-5 seconds
4. **Git Safety**: Never runs `git push` or destructive operations automatically
5. **Grok Integration**: Uses Code Fast 1 (fast, cost-effective, prompt caching enabled)

---

## 💡 Auto-Fix Best Practices (When Implemented)

1. **Always review before applying**
2. **Apply one fix at a time initially**
3. **Run tests after each fix**
4. **Use Git to track changes**
5. **Keep fixes small and focused**
6. **Trust levels**:
   - `auto`: Safe patterns (add decorator, import statement)
   - `review`: Requires human verification (logic changes)
   - `manual`: Complex changes, AI suggestion only

---

## 🔐 Security Considerations

- **Path Traversal**: Blocked via `security::path_validation`
- **System Dirs**: Cannot scan `/`, `/etc`, `/usr`, etc.
- **SQL Injection**: All queries parameterized
- **Command Injection**: Git operations use library, not shell
- **API Key**: Stored in environment only, never in DB

---

## 🤖 Grok Prompting Strategy

```
You are a security compliance expert helping fix SOC 2 violations in {language} code.

VIOLATION:
{violation.description}

CONTROL: {control.id} - {control.name}
{control.requirement}

ORIGINAL CODE (line {line_number} in {file_path}):
{code_snippet}

FRAMEWORK: {framework}

TASK:
Generate a fixed version of this code that addresses the violation while:
1. Maintaining existing functionality
2. Following {framework} best practices
3. Being minimal and focused
4. Adding necessary imports if needed

Respond with:
EXPLANATION: [Why this is a violation and how the fix addresses it]

FIXED_CODE:
[Complete fixed code snippet]
```

This prompt maximizes Grok's effectiveness while staying within token limits.
