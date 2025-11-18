# Ryn Manual Testing Guide

## Setup

```bash
# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-api03-xxxxx" >> .env

# Clean database
rm -f ./data/ryn.db

# Run app
pnpm tauri dev
```

---

## Test Projects (Real GitHub Repos)

Clone and test on real code instead of synthetic examples. Start small, increase complexity.

**Important:** Clone repos OUTSIDE the ryn directory to avoid git conflicts:

```bash
mkdir -p ~/test-repos
cd ~/test-repos
# Then clone repos below
```

### SMALL (50-200 files) - Start Here

**1. Vulnerable Flask App**
```bash
git clone https://github.com/we45/Vulnerable-Flask-App ~/test-repos/vulnerable-flask
```
- Framework: Flask
- Contains: Hardcoded credentials, missing auth, SQL injection
- Good for: CC6.7 (Secrets), CC6.1 (Access Control)

**2. Vulnerable Django App**
```bash
git clone https://github.com/lambrou/vulnerable-django-app ~/test-repos/vulnerable-django
```
- Framework: Django
- Contains: Missing @login_required, weak auth, missing audit logs
- Good for: CC6.1 (Access Control), CC7.2 (Logging)

**3. Vulnerable Node.js Express**
```bash
git clone https://github.com/samoylenko/vulnerable-app-nodejs-express ~/test-repos/vulnerable-express
```
- Framework: Express
- Contains: Multiple vulnerability patterns
- Good for: All rule engines

**4. Insecure Web App**
```bash
git clone https://github.com/BrenesRM/insecure-web ~/test-repos/insecure-web
```
- Framework: Flask + Docker
- Contains: Explicit hardcoded admin credentials
- Good for: CC6.7 (Secrets)

### MEDIUM (200-500 files) - Scale Up

**5. NodeGoat (OWASP)**
```bash
git clone https://github.com/OWASP/NodeGoat ~/test-repos/nodegoat
```
- Framework: Express
- Contains: All OWASP Top 10, missing auth middleware, hardcoded secrets, poor error handling
- Good for: All rule engines, official OWASP project

**6. DVNA - Damn Vulnerable NodeJS**
```bash
git clone https://github.com/appsecco/dvna ~/test-repos/dvna
```
- Framework: Express + Passport + Sequelize
- Contains: Real-world vulnerable patterns
- Good for: CC6.1 (Access Control), A1.2 (Resilience)

**7. Flask RealWorld Example**
```bash
git clone https://github.com/gothinkster/flask-realworld-example-app ~/test-repos/flask-realworld
```
- Framework: Flask
- Contains: Medium.com clone, may have missing audit logs, incomplete error handling
- Good for: CC7.2 (Logging), A1.2 (Resilience)

**8. Django RealWorld Example**
```bash
git clone https://github.com/gothinkster/django-realworld-example-app ~/test-repos/django-realworld
```
- Framework: Django
- Contains: Production-style code, missing access controls on some endpoints
- Good for: CC6.1 (Access Control), CC7.2 (Logging)

**9. Next.js RealWorld Example**
```bash
git clone https://github.com/reck1ess/next-realworld-example-app ~/test-repos/nextjs-realworld
```
- Framework: Next.js + TypeScript
- Contains: Client-side auth gaps, potential API key exposure, missing error boundaries
- Good for: CC6.7 (Secrets), A1.2 (Resilience)

### MEDIUM-LARGE (500-1000 files) - Final Tests

**10. Very Vulnerable Express App**
```bash
git clone https://github.com/SirAppSec/vuln-node.js-express.js-app ~/test-repos/very-vulnerable-express
```
- Framework: Express + TypeScript + Swagger
- Contains: Multiple exploit chains, missing auth on APIs, weak error handling
- Good for: All rule engines, comprehensive test

**11. Flask Blog**
```bash
git clone https://github.com/bgtti/blog_flask ~/test-repos/flask-blog
```
- Framework: Flask
- Contains: Full blog with admin dashboard, missing audit logs on admin actions
- Good for: CC7.2 (Logging), CC6.1 (Access Control)

**12. Next.js E-commerce**
```bash
git clone https://github.com/mohammadoftadeh/next-ecommerce-shopco ~/test-repos/nextjs-ecommerce
```
- Framework: Next.js + TypeScript + Redux
- Contains: Complex state, may expose API keys, missing error boundaries
- Good for: CC6.7 (Secrets), A1.2 (Resilience)

### Testing Strategy

**Week 1:** Test repos 1-4 (small, deliberately vulnerable)
**Week 2:** Test repos 5-9 (medium, real-world examples)
**Week 3:** Test repos 10-12 (larger, production-style)

---

## 1. Project Management

### Create Project
1. Clone a test repo (start with #1: Vulnerable Flask App)
2. Click "Select Project" → choose `~/test-repos/vulnerable-flask`
3. Enter name "Vulnerable Flask"
4. Click "Create Project"

**Expected:** Project listed, framework detected as "flask", database record created

### List Projects
1. Add 2-3 repos from the list above
2. View projects list

**Expected:** All projects shown with correct names and frameworks

---

## 2. Framework Detection

Test on the real repos - framework should auto-detect:

- `~/test-repos/vulnerable-flask` → Framework = "flask"
- `~/test-repos/vulnerable-django` → Framework = "django"
- `~/test-repos/vulnerable-express` → Framework = "express"
- `~/test-repos/nextjs-realworld` → Framework = "next"

---

## 3. Code Scanning

### Run Scan
1. Select a project (e.g., "Vulnerable Flask")
2. Click "Scan Project"
3. Wait for completion

**Expected:** Progress updates, scan completes, violations counted by severity

The real repos should trigger violations automatically. No need to create test files.

---

## 4. Violation Detection

Test on real repos to verify all rule engines work:

### What to Expect from Test Repos

**Vulnerable Flask App** should detect:
- CC6.7: Hardcoded credentials, API keys
- CC6.1: Missing authentication decorators
- A1.2: Missing error handling

**Vulnerable Django App** should detect:
- CC6.1: Missing @login_required decorators
- CC7.2: Missing audit logs on sensitive operations
- CC6.7: Potential hardcoded secrets

**NodeGoat (OWASP)** should detect:
- CC6.1: Missing auth middleware on routes
- CC6.7: Hardcoded secrets in config
- CC7.2: Missing audit logs
- A1.2: Poor error handling, missing timeouts

**DVNA** should detect:
- CC6.1: Authentication bypass vulnerabilities
- A1.2: Missing try/catch blocks
- CC7.2: Incomplete logging

### Manual Test Cases (If Needed)

If you want to test specific patterns, create a test file in any repo:

**CC6.1: Access Control**
```python
# test_access.py
def user_profile(request):
    return render(request, 'profile.html')  # Missing @login_required
```

**CC6.7: Secrets**
```python
# test_secrets.py
stripe_key = 'sk_live_testkey1234567890'  # Hardcoded key
```

**CC7.2: Logging**
```python
# test_logging.py
def update_user(user_id, data):
    user.save()  # Missing audit log
```

**A1.2: Resilience**
```python
# test_resilience.py
def fetch_data():
    response = requests.get('https://api.example.com/data')  # No try/catch, no timeout
    return response.json()
```

---

## 5. Violation Management

### Filter Violations
1. Run scan
2. Filter by severity: "Critical"
3. Filter by control: "CC6.7"
4. Filter by status: "open"

**Expected:** Filtered results match criteria

### View Violation Details
1. Click violation in list
2. View detail page

**Expected:** File path, line number, code snippet, control ID, severity, description shown

### Dismiss Violation
1. Open violation detail
2. Click "Dismiss"
3. Enter reason (optional)
4. Confirm

**Expected:** Status = "dismissed", audit event created, no longer in "open" filter

---

## 6. Fix Generation

### Generate Fix
**Prerequisites:** `ANTHROPIC_API_KEY` set

1. Open violation detail
2. Click "Generate Fix"
3. Wait for response

**Expected:** Fix generated (5-15 sec), contains `fixed_code` + `explanation`, diff shown, trust_level = "review"

### Apply Fix
**Prerequisites:** Git repo initialized (test repos already have git)

1. Generate fix
2. Review diff
3. Click "Apply Fix"
4. Confirm

**Expected:** File updated, git commit created, violation status = "fixed", audit event logged

Verify:
```bash
cd ~/test-repos/vulnerable-flask  # or whichever repo you're testing
git log --oneline
git show HEAD
```

---

## 7. Fix Errors

### Dirty Git Repo
```bash
cd ~/test-repos/vulnerable-flask
echo "change" >> test.py
```

**Expected:** Error "uncommitted changes", fix NOT applied

### Missing API Key
```bash
unset ANTHROPIC_API_KEY
```

**Expected:** Error "API key not configured"

---

## 8. Audit Trail

1. Perform actions (create project, scan, generate fix, apply fix, dismiss)
2. Navigate to Audit page

**Expected:** All actions logged with timestamp, event type, metadata

---

## 9. Settings

### View Settings
1. Navigate to Settings

**Expected:** Framework, exclusions, model preference shown

### Update Settings
1. Change setting (e.g., framework to "django")
2. Save
3. Refresh

**Expected:** Setting persisted, value shown after reload

### Clear Database
1. Create test data
2. Settings → "Clear All Data"
3. Confirm

**Expected:** Scans, violations, fixes, audit events deleted

### Export Data
1. Create test data
2. Click "Export Data"

**Expected:** JSON file downloaded with all projects, scans, violations, fixes, audit events

Verify:
```bash
cat ~/Downloads/ryn-export-*.json | jq .
```

---

## 10. Edge Cases

### Invalid Path
1. Try to create project with `/etc` or non-existent path

**Expected:** Validation error, no database record

### Empty Project
```bash
mkdir -p ~/test-repos/empty-project
```
Test scanning empty directory

**Expected:** Scan completes, 0 violations, no crashes

### Large Project
Test on larger repos (#10, #11, #12 from list above)

**Expected:** Scan completes, progress updates smoothly

### Binary Files
Real repos contain binary files (images, compiled files)

**Expected:** Binary files skipped, no errors

### Unicode
Real repos may contain unicode comments/strings

**Expected:** File scanned, violations detected, unicode preserved

### Network Error
1. Set invalid API key
2. Generate fix

**Expected:** Clear error, no crash

### File Permissions
```bash
cd ~/test-repos/vulnerable-flask
touch readonly_test.py
chmod 000 readonly_test.py
```

**Expected:** Scan handles gracefully, fix shows permission error

---

## 11. Known Issues

### Database Connection Leak
1. Run 10+ scans rapidly
2. Monitor: `lsof -p $(pgrep ryn)`

**Expected (Bug):** File descriptors increase, eventual `[Tauri Error] {}`

### File Watcher Not Working
1. Start scan
2. Create new file during scan

**Expected (Bug):** New file NOT detected until next manual scan

---

## Diagnostics

```bash
# Database integrity
sqlite3 ./data/ryn.db "PRAGMA integrity_check;"

# Recent errors
sqlite3 ./data/ryn.db "SELECT * FROM audit_events WHERE event_type LIKE '%error%' ORDER BY created_at DESC LIMIT 10;"

# Debug logs
RUST_LOG=debug pnpm tauri dev 2>&1 | tee ryn-debug.log
```
