# Ryn Manual Testing Guide

## Setup

```bash
# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-api03-xxxxx" >> .env

# Create test project
mkdir -p ~/ryn-test-project

# Clean database
rm -f ./data/ryn.db

# Run app
pnpm tauri dev
```

---

## 1. Project Management

### Create Project
1. Click "Select Project" → choose `~/ryn-test-project`
2. Enter name "Test Project"
3. Click "Create Project"

**Expected:** Project listed, framework detected, database record created

### List Projects
1. Create 2-3 projects
2. View projects list

**Expected:** All projects shown with correct names and frameworks

---

## 2. Framework Detection

### Django
```bash
cd ~/ryn-test-project
touch manage.py
echo "INSTALLED_APPS = ['django']" > settings.py
```
**Expected:** Framework = "django"

### Flask
```bash
rm -f manage.py settings.py
echo "from flask import Flask" > app.py
echo "Flask==2.0" > requirements.txt
```
**Expected:** Framework = "flask"

### Next.js
```bash
rm -f app.py requirements.txt
echo '{"dependencies":{"next":"14.0","react":"19.0"}}' > package.json
```
**Expected:** Framework = "next"

### Express
```bash
echo '{"dependencies":{"express":"4.18"}}' > package.json
```
**Expected:** Framework = "express"

---

## 3. Code Scanning

### Run Scan
1. Select project
2. Click "Scan Project"
3. Wait for completion

**Expected:** Progress updates, scan completes, violations counted by severity

### Scan Exclusions
```bash
mkdir -p node_modules .git
echo "secret='test'" > node_modules/bad.js
```

**Expected:** Excluded directories skipped, no violations from `node_modules/`

---

## 4. Violation Detection

### CC6.1: Access Control

**Test 1:** Missing @login_required (Django)
```python
# views.py
def user_profile(request):
    return render(request, 'profile.html')
```
**Expected:** High severity, "missing @login_required"

**Test 2:** Hardcoded user ID
```python
# admin.py
def get_user_data(request):
    user_id = 42
    return User.objects.get(id=user_id)
```
**Expected:** Medium severity, "hardcoded user_id"

**Test 3:** Admin operation without permission
```python
# admin_views.py
def delete_user(request, user_id):
    User.objects.get(id=user_id).delete()
```
**Expected:** Critical/High severity, "permission check"

**Test 4:** Express route without auth
```javascript
// routes.js
router.get('/admin/users', (req, res) => {
    res.json(User.all());
});
```
**Expected:** High severity, "missing auth middleware"

**Test 5:** FastAPI without Depends
```python
# api.py
@app.get('/admin/users')
def list_users(request):
    return get_all_users()
```
**Expected:** High severity, "Depends" or "authorization"

---

### CC6.7: Secrets

**Test 1:** Stripe key
```python
# config.py
stripe_key = 'sk_live_testkey1234567890'
```
**Expected:** Critical severity, "Stripe", code redacted

**Test 2:** GitHub token
```python
# github_config.py
github_token = 'ghp_1234567890abcdefghijklmnopqrst'
```
**Expected:** Critical severity, "GitHub token"

**Test 3:** AWS credentials
```python
# aws_config.py
aws_access_key = "AKIAIOSFODNN7EXAMPLE"
aws_secret_key = "wJalrXUtnFEMI/K7MDENGtest1234EXAMPLEKEY"
```
**Expected:** 2 critical violations

**Test 4:** Hardcoded password
```python
# database.py
password = 'admin123'
db_password = 'secret'
```
**Expected:** 1-2 high severity violations

**Test 5:** Database connection string
```python
# db_config.py
database_url = 'postgresql://user:pass123@localhost:5432/mydb'
```
**Expected:** Critical severity, "database credentials"

**Test 6:** Insecure HTTP
```python
# api_client.py
api_url = 'http://api.example.com/sensitive-data'
```
**Expected:** Medium severity, "use HTTPS"

**Test 7:** Environment variables (should PASS)
```python
# good_config.py
api_key = os.getenv('API_KEY')
db_url = f'postgresql://user:{os.getenv("DB_PASSWORD")}@host/db'
```
**Expected:** NO violations

---

### CC7.2: Logging

**Test 1:** Save without audit log
```python
# models.py
def update_user(user_id, data):
    user = User.objects.get(id=user_id)
    user.email = data['email']
    user.save()
```
**Expected:** Medium severity, "audit log"

**Test 2:** Delete without logging
```python
# admin_actions.py
def remove_account(account_id):
    Account.objects.get(id=account_id).delete()
```
**Expected:** Medium severity

**Test 3:** SQL without logging
```python
# database_ops.py
def bulk_update():
    cursor.execute("UPDATE users SET status='inactive'")
```
**Expected:** Medium severity

**Test 4:** Logging password
```python
# bad_logger.py
logger.info(f"User password: {user.password}")
```
**Expected:** Critical severity, "logging sensitive data"

**Test 5:** Logging credit card
```python
# payment_logger.py
print(f"Processing card: {card_number}")
```
**Expected:** Critical severity

**Test 6:** Login without logging
```python
# auth.py
def login(username, password):
    if check_credentials(username, password):
        return create_session(username)
```
**Expected:** High severity, "authentication event"

**Test 7:** With logging (should PASS)
```python
# good_logging.py
def update_user(user_id, data):
    user = User.objects.get(id=user_id)
    user.email = data['email']
    user.save()
    logger.info(f"User {user_id} updated by {current_user}")
```
**Expected:** NO violations

---

### A1.2: Resilience

**Test 1:** API call without error handling
```python
# api_service.py
def fetch_data():
    response = requests.get('https://api.example.com/data')
    return response.json()
```
**Expected:** Medium severity, "error handling"

**Test 2:** Request without timeout
```python
# http_client.py
def get_user_data(user_id):
    return requests.get(f'https://api.example.com/users/{user_id}')
```
**Expected:** 2 violations (no error handling + no timeout)

**Test 3:** Fetch without catch
```javascript
// client.js
async function loadData() {
    const response = await fetch('https://api.example.com/data');
    return response.json();
}
```
**Expected:** Medium severity, "try/catch"

**Test 4:** Database query without error handling
```python
# db_operations.py
def get_record(id):
    result = db.query('SELECT * FROM users WHERE id = ?', id)
    return result
```
**Expected:** Medium severity

**Test 5:** Missing retry logic
```python
# unreliable_service.py
def call_external_api():
    try:
        return requests.get('https://flaky-api.com/endpoint')
    except Exception as e:
        raise e
```
**Expected:** Low severity, "retry logic"

**Test 6:** With proper error handling (should PASS)
```python
# good_resilience.py
def fetch_data():
    try:
        response = requests.get('https://api.example.com/data', timeout=5)
        return response.json()
    except requests.RequestException as e:
        logger.error(f"API call failed: {e}")
        return None
```
**Expected:** NO violations

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
**Prerequisites:** Git repo initialized

```bash
cd ~/ryn-test-project
git init
git add .
git commit -m "Initial commit"
```

1. Generate fix
2. Review diff
3. Click "Apply Fix"
4. Confirm

**Expected:** File updated, git commit created, violation status = "fixed", audit event logged

Verify:
```bash
cd ~/ryn-test-project
git log --oneline
git show HEAD
```

---

## 7. Fix Errors

### Dirty Git Repo
```bash
cd ~/ryn-test-project
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
1. Create project with `/etc` or non-existent path

**Expected:** Validation error, no database record

### Empty Project
```bash
mkdir -p ~/ryn-empty
```

**Expected:** Scan completes, 0 violations, no crashes

### Large Project
```bash
mkdir -p ~/ryn-large
for i in {1..500}; do echo "def func_$i(): pass" > ~/ryn-large/file_$i.py; done
```

**Expected:** Scan completes, progress updates smoothly

### Binary Files
```bash
echo -e '\x00\x01\x02' > ~/ryn-test-project/binary.dat
```

**Expected:** Binary files skipped, no errors

### Unicode
```python
# unicode_test.py
# 日本語コメント
def test_函数():
    password = "test123"  # Secret🔐
    return "résultat"
```

**Expected:** File scanned, violations detected, unicode preserved

### Network Error
1. Set invalid API key
2. Generate fix

**Expected:** Clear error, no crash

### File Permissions
```bash
touch ~/ryn-test-project/readonly.py
chmod 000 ~/ryn-test-project/readonly.py
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

### LangGraph Not Integrated
1. Check logs during scan

**Expected (Bug):** No LangGraph mentions, direct rule engines used

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
