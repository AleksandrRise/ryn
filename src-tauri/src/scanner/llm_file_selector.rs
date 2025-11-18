//! LLM File Selection Logic
//!
//! Determines which files should be analyzed with LLM vs regex-only scanning.
//! Smart mode analyzes ~30-40% of files by focusing on security-relevant code.

use std::path::Path;

/// Determines if a file should be analyzed with LLM based on content
///
/// # Arguments
/// * `file_path` - Path to the file being scanned
/// * `code` - Full file contents
/// * `scan_mode` - Scanning mode (regex_only/smart/analyze_all)
///
/// # Returns
/// `true` if file should be sent to Claude for analysis
///
/// # Modes
/// - `regex_only`: Always returns false (no LLM analysis)
/// - `smart`: Returns true if file contains security-relevant patterns
/// - `analyze_all`: Always returns true (analyze every file)
pub fn should_analyze_with_llm(file_path: &str, code: &str, scan_mode: &str) -> bool {
    match scan_mode {
        "regex_only" => false,
        "analyze_all" => is_supported_language(file_path),
        "smart" => is_supported_language(file_path) && is_security_relevant(code),
        _ => false, // Unknown mode defaults to regex-only
    }
}

/// Check if file extension is supported for LLM analysis
fn is_supported_language(file_path: &str) -> bool {
    let path = Path::new(file_path);
    if let Some(ext) = path.extension() {
        matches!(
            ext.to_str().unwrap_or(""),
            "py" | "js" | "ts" | "tsx" | "jsx" | "go" | "java" | "rb" | "php" | "rs"
        )
    } else {
        false
    }
}

/// Heuristic analysis to determine if code is security-relevant
///
/// Scans for patterns indicating:
/// - Authentication/authorization logic
/// - Database operations
/// - API endpoints
/// - Secrets/credentials handling
/// - File I/O operations
/// - Network requests
/// - Admin/privileged operations
///
/// # Returns
/// `true` if code appears to be security-sensitive
pub fn is_security_relevant(code: &str) -> bool {
    let code_lower = code.to_lowercase();

    // Category 1: Authentication & Authorization (highest priority)
    if contains_auth_patterns(&code_lower) {
        return true;
    }

    // Category 2: Database Operations
    if contains_database_patterns(&code_lower) {
        return true;
    }

    // Category 3: API Endpoints & Routes
    if contains_endpoint_patterns(&code_lower) {
        return true;
    }

    // Category 4: Secrets & Credentials
    if contains_secrets_patterns(&code_lower) {
        return true;
    }

    // Category 5: File I/O & System Operations
    if contains_file_io_patterns(&code_lower) {
        return true;
    }

    // Category 6: Network Operations
    if contains_network_patterns(&code_lower) {
        return true;
    }

    false
}

/// Check for authentication/authorization patterns
fn contains_auth_patterns(code: &str) -> bool {
    let auth_keywords = [
        "login_required",
        "permission_required",
        "requires_auth",
        "authenticate",
        "authorize",
        "check_permission",
        "is_authenticated",
        "current_user",
        "session.get",
        "session.set",
        "request.user",
        "jwt.decode",
        "verify_token",
        "middleware",
        "passport",
        "auth0",
        "oauth",
        "saml",
        "role_required",
        "admin_required",
    ];

    auth_keywords.iter().any(|keyword| code.contains(keyword))
}

/// Check for database operation patterns
fn contains_database_patterns(code: &str) -> bool {
    let db_keywords = [
        "insert into",
        "update ",
        "delete from",
        "create table",
        "drop table",
        "alter table",
        "select ",
        ".execute(",
        ".query(",
        ".filter(",
        ".create(",
        ".update(",
        ".delete(",
        ".save(",
        "session.commit",
        "db.session",
        "connection.execute",
        "cursor.execute",
        "orm.",
        "sqlalchemy",
        "sequelize",
        "mongoose",
        "prisma",
    ];

    db_keywords.iter().any(|keyword| code.contains(keyword))
}

/// Check for API endpoint patterns
fn contains_endpoint_patterns(code: &str) -> bool {
    let endpoint_keywords = [
        "@app.route",
        "@api.route",
        "@router.",
        "router.get",
        "router.post",
        "router.put",
        "router.delete",
        "app.get(",
        "app.post(",
        "app.put(",
        "app.delete(",
        "express.router",
        "fastapi",
        "@blueprint",
        "flask.request",
        "request.method",
        "http.handlefunc",
        "@restcontroller",
        "@requestmapping",
        "@getmapping",
        "@postmapping",
    ];

    endpoint_keywords.iter().any(|keyword| code.contains(keyword))
}

/// Check for secrets/credentials patterns
fn contains_secrets_patterns(code: &str) -> bool {
    let secrets_keywords = [
        "password",
        "secret",
        "api_key",
        "apikey",
        "access_token",
        "private_key",
        "client_secret",
        "auth_token",
        "bearer",
        "credentials",
        "config.get(",
        "os.getenv(",
        "process.env",
        "vault",
        "aws_secret",
        "encryption",
        "decrypt",
    ];

    secrets_keywords.iter().any(|keyword| code.contains(keyword))
}

/// Check for file I/O patterns
fn contains_file_io_patterns(code: &str) -> bool {
    let file_keywords = [
        "open(",
        "file.read",
        "file.write",
        "fs.readfile",
        "fs.writefile",
        "path.join",
        "os.path",
        "upload",
        "download",
        "tmpfile",
        "tempfile",
    ];

    file_keywords.iter().any(|keyword| code.contains(keyword))
}

/// Check for network operation patterns
fn contains_network_patterns(code: &str) -> bool {
    let network_keywords = [
        "requests.",
        "http.get",
        "http.post",
        "fetch(",
        "axios.",
        "urllib",
        "httplib",
        "curl",
        "websocket",
        "socket",
    ];

    network_keywords.iter().any(|keyword| code.contains(keyword))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_analyze_regex_only_mode() {
        let code = "password = 'hardcoded'; user.authenticate()";
        assert!(!should_analyze_with_llm("app.py", code, "regex_only"));
    }

    #[test]
    fn test_should_analyze_analyze_all_mode() {
        let code = "print('hello world')"; // Not security-relevant
        assert!(should_analyze_with_llm("app.py", code, "analyze_all"));
    }

    #[test]
    fn test_should_analyze_smart_mode_security_relevant() {
        let code = "@login_required\ndef admin_panel(): pass";
        assert!(should_analyze_with_llm("views.py", code, "smart"));
    }

    #[test]
    fn test_should_analyze_smart_mode_not_relevant() {
        let code = "def add(a, b): return a + b";
        assert!(!should_analyze_with_llm("utils.py", code, "smart"));
    }

    #[test]
    fn test_should_analyze_unsupported_file_type() {
        let code = "@login_required\ndef admin(): pass";
        assert!(!should_analyze_with_llm("README.md", code, "analyze_all"));
    }

    #[test]
    fn test_should_analyze_unknown_mode() {
        let code = "password = 'test'";
        assert!(!should_analyze_with_llm("app.py", code, "unknown_mode"));
    }

    #[test]
    fn test_is_supported_language_python() {
        assert!(is_supported_language("app.py"));
    }

    #[test]
    fn test_is_supported_language_javascript() {
        assert!(is_supported_language("index.js"));
        assert!(is_supported_language("App.tsx"));
        assert!(is_supported_language("component.jsx"));
    }

    #[test]
    fn test_is_supported_language_unsupported() {
        assert!(!is_supported_language("README.md"));
        assert!(!is_supported_language("config.yml"));
        assert!(!is_supported_language("test.txt"));
    }

    #[test]
    fn test_is_security_relevant_auth_decorators() {
        let code = "@login_required\ndef admin_dashboard(): pass";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_authentication() {
        let code = "user.authenticate(username, password)";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_jwt_token() {
        let code = "token = jwt.decode(request.headers['Authorization'])";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_database_insert() {
        let code = "cursor.execute('INSERT INTO users VALUES (?, ?)', (name, email))";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_database_query() {
        let code = "User.query.filter(User.id == user_id).first()";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_sqlalchemy() {
        let code = "session.commit(); db.session.add(user)";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_api_route() {
        let code = "@app.route('/api/users', methods=['POST'])";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_express_endpoint() {
        let code = "router.post('/login', async (req, res) => {})";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_fastapi() {
        let code = "@router.get('/users/{user_id}')";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_password_keyword() {
        let code = "password = request.form.get('password')";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_api_key() {
        let code = "api_key = config.get('STRIPE_API_KEY')";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_env_vars() {
        let code = "secret = os.getenv('DATABASE_PASSWORD')";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_file_operations() {
        let code = "with open(user_upload_path, 'w') as f: f.write(data)";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_network_requests() {
        let code = "response = requests.post('https://api.example.com', data=payload)";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_security_relevant_axios() {
        let code = "axios.get('/api/user').then(res => setUser(res.data))";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_is_not_security_relevant_simple_function() {
        let code = "def calculate_total(items): return sum(item.price for item in items)";
        assert!(!is_security_relevant(code));
    }

    #[test]
    fn test_is_not_security_relevant_utility() {
        let code = "function formatDate(date) { return date.toISOString(); }";
        assert!(!is_security_relevant(code));
    }

    #[test]
    fn test_is_not_security_relevant_constants() {
        let code = "const MAX_RETRIES = 3; const TIMEOUT = 5000;";
        assert!(!is_security_relevant(code));
    }

    #[test]
    fn test_case_insensitive_matching() {
        // Should match even with different casing
        let code = "PASSWORD = 'test'; @LOGIN_REQUIRED";
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_multiple_patterns_in_file() {
        let code = r#"
            @login_required
            def delete_user(user_id):
                user = User.query.filter(User.id == user_id).first()
                db.session.delete(user)
                db.session.commit()
        "#;
        assert!(is_security_relevant(code));
    }

    #[test]
    fn test_smart_mode_real_world_auth_file() {
        let code = r#"
from flask import request, session
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function
        "#;
        assert!(should_analyze_with_llm("auth.py", code, "smart"));
    }

    #[test]
    fn test_smart_mode_real_world_utility_file() {
        let code = r#"
def format_currency(amount):
    return f"${amount:.2f}"

def truncate_string(text, max_length=50):
    if len(text) > max_length:
        return text[:max_length] + "..."
    return text
        "#;
        assert!(!should_analyze_with_llm("utils.py", code, "smart"));
    }

    #[test]
    fn test_smart_mode_real_world_api_endpoint() {
        let code = r#"
@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'}), 200
        "#;
        assert!(should_analyze_with_llm("views.py", code, "smart"));
    }

    #[test]
    fn test_golang_file_support() {
        let code = "func handleRequest(w http.ResponseWriter, r *http.Request) {}";
        assert!(should_analyze_with_llm("handlers.go", code, "analyze_all"));
    }

    #[test]
    fn test_typescript_file_support() {
        let code = "export const API_KEY = process.env.STRIPE_KEY;";
        assert!(should_analyze_with_llm("config.ts", code, "smart"));
    }
}
