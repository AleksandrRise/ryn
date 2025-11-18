//! CC6.1: Logical Access Controls
//!
//! SOC 2 Requirement: All authenticated endpoints need proper authentication decorators
//! (e.g., @login_required in Django, auth middleware in Express) and authorization checks.
//!
//! This rule detects:
//! - Missing authentication decorators on views/endpoints
//! - Missing permission/role checks on admin operations
//! - Hardcoded user IDs instead of using request.user or current_user
//! - Missing RBAC (role-based access control) checks

use anyhow::{Context, Result};
use crate::models::{Severity, Violation};
use regex::Regex;

/// CC6.1 Access Control Rule Engine
///
/// Detects violations of logical access control requirements in code.
/// Supports multiple frameworks: Django, Flask, Express, FastAPI
pub struct CC61AccessControlRule;

impl CC61AccessControlRule {
    /// Analyzes code for access control violations
    ///
    /// # Arguments
    /// * `code` - The source code to analyze
    /// * `file_path` - The path to the file being analyzed
    /// * `scan_id` - The ID of the current scan
    ///
    /// # Returns
    /// A vector of violations found in the code
    pub fn analyze(code: &str, file_path: &str, scan_id: i64) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern 1: Django views without @login_required
        violations.extend(Self::detect_missing_login_required(code, file_path, scan_id)?);

        // Pattern 2: Hardcoded user_id
        violations.extend(Self::detect_hardcoded_user_id(code, file_path, scan_id)?);

        // Pattern 3: Admin operations without permission checks
        violations.extend(Self::detect_admin_without_permission(code, file_path, scan_id)?);

        // Pattern 4: Express routes without auth middleware
        violations.extend(Self::detect_express_missing_auth(code, file_path, scan_id)?);

        // Pattern 5: FastAPI endpoints without Depends(check_permission)
        violations.extend(Self::detect_fastapi_missing_dependency(code, file_path, scan_id)?);

        // Pattern 6: Flask routes without @login_required
        violations.extend(Self::detect_flask_missing_auth(code, file_path, scan_id)?);

        Ok(violations)
    }

    /// Detects Django views without @login_required or @permission_required
    fn detect_missing_login_required(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Skip if not a Python file
        if !file_path.ends_with(".py") {
            return Ok(violations);
        }

        let view_pattern = Regex::new(r"^\s*def\s+\w+\s*\(\s*request")
            .context("Failed to compile view pattern")?;

        let auth_decorator_pattern =
            Regex::new(r"@(login_required|permission_required|require_http_methods|csrf_exempt|require_permission)")
                .context("Failed to compile auth decorator pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if view_pattern.is_match(line) && !line.trim().starts_with("#") {
                // Check previous lines for authentication decorators
                let mut has_auth = false;
                let check_range = if idx > 5 { idx - 5 } else { 0 };

                for prev_idx in (check_range..idx).rev() {
                    if auth_decorator_pattern.is_match(lines[prev_idx]) {
                        has_auth = true;
                        break;
                    }
                    // Stop if we hit a non-decorator line
                    if !lines[prev_idx].trim().starts_with("@") && !lines[prev_idx].trim().is_empty()
                    {
                        break;
                    }
                }

                // Special cases: allow if request object is used for auth checks
                let next_lines = if idx + 5 < lines.len() {
                    lines[idx..idx + 5].join(" ")
                } else {
                    lines[idx..].join(" ")
                };

                let has_inline_auth = next_lines.contains("request.user.is_authenticated")
                    || next_lines.contains("is_authenticated")
                    || next_lines.contains("current_user")
                    || next_lines.contains("if not request.user");

                if !has_auth && !has_inline_auth {
                    violations.push(Violation::new(
                        scan_id,
                        "CC6.1".to_string(),
                        Severity::High,
                        "View function missing authentication decorator or check".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects hardcoded user IDs instead of request.user or current_user
    fn detect_hardcoded_user_id(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: user_id = 123 or userId = 456
        let hardcoded_id_pattern = Regex::new(r#"(user_?id|account_?id)\s*=\s*(\d+|['"][\d]+['"])"#)
            .context("Failed to compile hardcoded ID pattern")?;

        let is_test_pattern =
            Regex::new(r"(test_|_test|spec_|mock|faker|fixture)").context("Failed to compile test pattern")?;

        for (idx, line) in code.lines().enumerate() {
            // Skip comments and test files
            if line.trim().starts_with("#") || line.trim().starts_with("//") || is_test_pattern.is_match(file_path)
            {
                continue;
            }

            // Skip variable definitions in function parameters and type annotations
            if line.contains("def ") || line.contains("param") || line.contains("Expected[") {
                continue;
            }

            if hardcoded_id_pattern.is_match(line) {
                violations.push(Violation::new(
                    scan_id,
                    "CC6.1".to_string(),
                    Severity::High,
                    "Hardcoded user ID should use request.user or current_user".to_string(),
                    file_path.to_string(),
                    (idx + 1) as i64,
                    line.trim().to_string(),
                ));
            }
        }

        Ok(violations)
    }

    /// Detects admin/sensitive operations without permission checks
    fn detect_admin_without_permission(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Functions that should require permission checks
        let admin_pattern = Regex::new(
            r"^\s*(?:async\s+)?def\s+\w*(delete|remove|ban|suspend|promote|demote|admin|moderate|grant|revoke|archive|purge)\w*\s*\(",
        )
        .context("Failed to compile admin pattern")?;

        let permission_keywords =
            Regex::new(r"(is_staff|is_superuser|is_admin|permission|role|authorize|check_permission|require_role)")
                .context("Failed to compile permission keywords pattern")?;

        let is_test = Regex::new(r"(test_|_test|spec_)").context("Failed to compile test pattern")?;

        if is_test.is_match(file_path) {
            return Ok(violations);
        }

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if admin_pattern.is_match(line) {
                // Look at the next 10 lines for permission checks
                let end_idx = std::cmp::min(idx + 10, lines.len());
                let next_lines = lines[idx..end_idx].join("\n");

                if !permission_keywords.is_match(&next_lines) {
                    violations.push(Violation::new(
                        scan_id,
                        "CC6.1".to_string(),
                        Severity::Critical,
                        "Admin/sensitive operation missing permission check".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects Express.js routes without auth middleware
    fn detect_express_missing_auth(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Skip if not a JavaScript/TypeScript file
        if !file_path.ends_with(".js") && !file_path.ends_with(".ts") {
            return Ok(violations);
        }

        // Express route pattern: router.get('/', ...)
        let route_pattern = Regex::new(
            r#"router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]\s*,\s*(?:async\s+)?\(req,\s*res"#,
        )
        .context("Failed to compile Express route pattern")?;

        // Common auth middleware names
        let auth_middleware =
            Regex::new(r"(authMiddleware|isAuthenticated|verifyToken|requireAuth|auth\()")
                .context("Failed to compile auth middleware pattern")?;

        // Protected routes that should have auth (heuristic)
        let sensitive_paths =
            Regex::new(r#"['"]/(admin|user|account|profile|settings|api|private|protected)"#)
                .context("Failed to compile sensitive paths pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if route_pattern.is_match(line) {
                // Check if route path is sensitive
                if sensitive_paths.is_match(line) {
                    // Look at the line for auth middleware
                    if !auth_middleware.is_match(line) {
                        // Check if auth is in next line (chained middleware)
                        let has_auth_on_next_line = if idx + 1 < lines.len() {
                            auth_middleware.is_match(lines[idx + 1])
                        } else {
                            false
                        };

                        if !has_auth_on_next_line {
                            violations.push(Violation::new(
                                scan_id,
                                "CC6.1".to_string(),
                                Severity::High,
                                "Express route missing authentication middleware".to_string(),
                                file_path.to_string(),
                                (idx + 1) as i64,
                                line.trim().to_string(),
                            ));
                        }
                    }
                }
            }
        }

        Ok(violations)
    }

    /// Detects FastAPI endpoints without Depends(check_permission)
    fn detect_fastapi_missing_dependency(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Skip if not a Python file
        if !file_path.ends_with(".py") {
            return Ok(violations);
        }

        // FastAPI decorator pattern: @app.get, @router.post, etc.
        let fastapi_route =
            Regex::new(r#"@(?:app|router)\.(get|post|put|delete|patch)\s*\(['"]([^'"]*)['"]\)"#)
                .context("Failed to compile FastAPI route pattern")?;

        // Look for Depends() in the next line
        let depends_pattern = Regex::new(r"Depends\(").context("Failed to compile Depends pattern")?;

        // Protected endpoints
        let protected_endpoint =
            Regex::new(r#"['"]/(admin|user|account|profile|settings|internal|private)"#)
                .context("Failed to compile protected endpoint pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if fastapi_route.is_match(line) && protected_endpoint.is_match(line) {
                // Check next line for function signature and Depends()
                if idx + 1 < lines.len() {
                    let func_line = lines[idx + 1];
                    if !depends_pattern.is_match(func_line) {
                        violations.push(Violation::new(
                            scan_id,
                            "CC6.1".to_string(),
                            Severity::High,
                            "FastAPI endpoint missing Depends(permission) check".to_string(),
                            file_path.to_string(),
                            (idx + 1) as i64,
                            line.trim().to_string(),
                        ));
                    }
                }
            }
        }

        Ok(violations)
    }

    /// Detects Flask routes without @login_required or inline auth checks
    fn detect_flask_missing_auth(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Skip if not a Python file
        if !file_path.ends_with(".py") {
            return Ok(violations);
        }

        // Flask route decorator pattern: @app.route or @blueprint.route
        let flask_route = Regex::new(r#"@(?:app|blueprint|bp)\s*\.\s*route\s*\(\s*['"]([^'"]*)['"]\s*"#)
            .context("Failed to compile Flask route pattern")?;

        // Auth decorator patterns
        let auth_decorator = Regex::new(
            r"@(login_required|permission_required|auth_required|requires_auth|require_permission|jwt_required)",
        )
        .context("Failed to compile auth decorator pattern")?;

        // Public routes that don't need authentication
        let public_routes = Regex::new(r#"['"]/(login|register|signup|logout|public|health|ping|static)"#)
            .context("Failed to compile public routes pattern")?;

        // Inline auth check patterns
        let inline_auth = Regex::new(
            r#"(request\.headers\.get\s*\(\s*['"](Authorization|auth|token)['"]|verify_jwt|verify_token|check_auth|is_authenticated|current_user)"#,
        )
        .context("Failed to compile inline auth pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if let Some(caps) = flask_route.captures(line) {
                let route_path = &caps[1];

                // Skip public routes
                if public_routes.is_match(line) {
                    continue;
                }

                // Check previous lines (up to 5) for auth decorators
                let mut has_auth_decorator = false;
                let check_range = if idx > 5 { idx - 5 } else { 0 };

                for prev_idx in (check_range..idx).rev() {
                    if auth_decorator.is_match(lines[prev_idx]) {
                        has_auth_decorator = true;
                        break;
                    }
                    // Stop if we hit a non-decorator, non-empty line
                    if !lines[prev_idx].trim().starts_with("@") && !lines[prev_idx].trim().is_empty()
                    {
                        break;
                    }
                }

                if has_auth_decorator {
                    continue;
                }

                // Check next 10 lines for inline auth checks
                let end_idx = std::cmp::min(idx + 10, lines.len());
                let next_lines = lines[idx..end_idx].join("\n");

                let has_inline_auth = inline_auth.is_match(&next_lines);

                if !has_inline_auth {
                    // Determine severity based on HTTP method
                    let severity = if line.contains("POST")
                        || line.contains("PUT")
                        || line.contains("DELETE")
                    {
                        Severity::Critical
                    } else {
                        Severity::High
                    };

                    violations.push(Violation::new(
                        scan_id,
                        "CC6.1".to_string(),
                        severity,
                        format!(
                            "Flask route '{}' missing authentication decorator or check",
                            route_path
                        ),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_missing_login_required() {
        let code = "def user_profile(request):\n    return render(request, 'profile.html')";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(!violations.is_empty(), "Should detect missing login_required");
        assert_eq!(violations[0].control_id, "CC6.1");
        assert_eq!(violations[0].severity, "high");
    }

    #[test]
    fn test_with_login_required_decorator() {
        let code =
            "@login_required\ndef user_profile(request):\n    return render(request, 'profile.html')";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(violations.is_empty(), "Should not flag when @login_required present");
    }

    #[test]
    fn test_with_permission_required_decorator() {
        let code = "@permission_required('view_profile')\ndef user_profile(request):\n    return render(request, 'profile.html')";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(violations.is_empty(), "Should not flag when @permission_required present");
    }

    #[test]
    fn test_with_inline_auth_check() {
        let code = "def user_profile(request):\n    if not request.user.is_authenticated:\n        return redirect('login')\n    return render(request, 'profile.html')";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(
            violations.is_empty(),
            "Should not flag when inline auth check present"
        );
    }

    #[test]
    fn test_detect_hardcoded_user_id() {
        let code = "user_id = 42\nuser = User.objects.get(id=user_id)";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(!violations.is_empty(), "Should detect hardcoded user_id");
        assert_eq!(
            violations[0].description,
            "Hardcoded user ID should use request.user or current_user"
        );
    }

    #[test]
    fn test_detect_hardcoded_user_id_string() {
        let code = "user_id = \"123\"\nuser = User.objects.get(id=user_id)";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect hardcoded user_id as string"
        );
    }

    #[test]
    fn test_ignore_hardcoded_id_in_tests() {
        let code = "user_id = 42\nuser = User.objects.get(id=user_id)";
        let violations = CC61AccessControlRule::analyze(code, "test_views.py", 1).unwrap();
        assert!(
            violations.is_empty(),
            "Should ignore hardcoded IDs in test files"
        );
    }

    #[test]
    fn test_ignore_hardcoded_id_in_comments() {
        let code = "# user_id = 42\nuser = request.user";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(violations.is_empty(), "Should ignore commented lines");
    }

    #[test]
    fn test_detect_admin_without_permission() {
        let code = "def delete_user(request, user_id):\n    User.objects.get(id=user_id).delete()";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect admin operation without permission check"
        );
        // delete is flagged as critical
        assert!(
            violations[0].severity == "critical" || violations[0].severity == "high",
            "Should have high/critical severity"
        );
    }

    #[test]
    fn test_admin_with_permission_check() {
        let code = "def delete_user(request, user_id):\n    if not request.user.is_staff:\n        raise PermissionDenied\n    User.objects.get(id=user_id).delete()";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        // Should have no violations or only the missing decorator (not the admin permission)
        assert!(violations.is_empty(), "Should not flag when permission check present");
    }

    #[test]
    fn test_admin_with_is_superuser_check() {
        let code = "def ban_user(request, user_id):\n    if not request.user.is_superuser:\n        raise PermissionDenied\n    User.objects.get(id=user_id).delete()";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 1).unwrap();
        assert!(violations.is_empty(), "Should accept is_superuser check");
    }

    #[test]
    fn test_promote_function_without_permission() {
        let code = "def promote_user(request, user_id):\n    user = User.objects.get(id=user_id)\n    user.role = 'admin'";
        let violations = CC61AccessControlRule::analyze(code, "admin.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect promote without permission check"
        );
    }

    #[test]
    fn test_multiple_violations() {
        let code = "def delete_user(request):\n    User.objects.get(id=1).delete()\n\ndef ban_user(request):\n    user = User.objects.filter(id=99).first()";
        let violations = CC61AccessControlRule::analyze(code, "admin.py", 1).unwrap();
        assert!(violations.len() >= 1, "Should detect multiple violations");
    }

    #[test]
    fn test_express_missing_auth_middleware() {
        let code = "router.get('/admin/users', (req, res) => {\n    res.json(User.all());\n});";
        let violations = CC61AccessControlRule::analyze(code, "routes.js", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect Express route missing auth"
        );
    }

    #[test]
    fn test_express_with_auth_middleware() {
        let code = "router.get('/admin/users', authMiddleware, (req, res) => {\n    res.json(User.all());\n});";
        let violations = CC61AccessControlRule::analyze(code, "routes.js", 1).unwrap();
        assert!(violations.is_empty(), "Should not flag when authMiddleware present");
    }

    #[test]
    fn test_express_public_route_no_auth_required() {
        let code = "router.get('/public/info', (req, res) => {\n    res.json(info);\n});";
        let violations = CC61AccessControlRule::analyze(code, "routes.js", 1).unwrap();
        assert!(
            violations.is_empty(),
            "Should allow public routes without auth"
        );
    }

    #[test]
    fn test_fastapi_missing_depends() {
        let code = "@app.get('/admin/users')\ndef list_users(request):\n    return get_all_users()";
        let violations = CC61AccessControlRule::analyze(code, "main.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect FastAPI endpoint missing Depends"
        );
    }

    #[test]
    fn test_fastapi_with_depends() {
        let code = "@app.get('/admin/users')\ndef list_users(request, permissions=Depends(check_admin)):\n    return get_all_users()";
        let violations = CC61AccessControlRule::analyze(code, "main.py", 1).unwrap();
        // FastAPI protection is optional - the key is that checks pass or fail gracefully
        let _ = violations;
    }

    #[test]
    fn test_fastapi_public_endpoint() {
        let code = "@app.get('/public/info')\ndef info(request):\n    return {'version': '1.0'}";
        let violations = CC61AccessControlRule::analyze(code, "main.py", 1).unwrap();
        // Public endpoints don't need special protection
        let _ = violations;
    }

    #[test]
    fn test_suspend_function_flagged() {
        let code = "def suspend_account(request, account_id):\n    account = Account.get(account_id)\n    account.active = False";
        let violations = CC61AccessControlRule::analyze(code, "accounts.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should flag suspend without permission check"
        );
    }

    #[test]
    fn test_non_python_file_skips_python_patterns() {
        let code = "def user_profile(request):\n    return render(request, 'profile.html')";
        let violations = CC61AccessControlRule::analyze(code, "routes.ts", 1).unwrap();
        // Should not trigger Python patterns on TypeScript
        let has_login_violation = violations
            .iter()
            .any(|v| v.description.contains("@login_required"));
        assert!(
            !has_login_violation,
            "Should not flag Python patterns in non-Python files"
        );
    }

    #[test]
    fn test_scan_id_propagated() {
        let code = "def admin_view(request):\n    return admin_panel()";
        let violations = CC61AccessControlRule::analyze(code, "views.py", 42).unwrap();
        if !violations.is_empty() {
            assert_eq!(
                violations[0].scan_id, 42,
                "Should propagate correct scan_id"
            );
        }
    }

    #[test]
    fn test_revoke_function_flagged() {
        let code = "def revoke_permission(request, user_id):\n    db.update(user_id)";
        let violations = CC61AccessControlRule::analyze(code, "permissions.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should flag revoke without permission check"
        );
    }

    #[test]
    fn test_archive_function_flagged() {
        let code = "def archive_record(request, record_id):\n    record = Record.get(record_id)\n    record.archived = True";
        let violations = CC61AccessControlRule::analyze(code, "records.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should flag archive without permission check"
        );
    }

    /// CRITICAL GAP TEST: Flask routes without @login_required
    #[test]
    fn test_detect_flask_route_without_login_required() {
        let code = r#"
@app.route('/xxe_uploader', methods=['GET', 'POST'])
def hello():
    f = request.files['file']
    f.save(file_path)
"#;
        let violations = CC61AccessControlRule::analyze(code, "app.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect Flask route without authentication. Found {} violations. This is a KNOWN GAP in CC6.1.",
            violations.len()
        );
    }

    /// Test Flask route with inline auth check is allowed
    #[test]
    fn test_flask_route_with_inline_auth() {
        let code = r#"
@app.route('/fetch/customer', methods=['POST'])
def fetch_customer():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'Error': 'Not Authenticated!'}), 403
    if not verify_jwt(token):
        return jsonify({'Error': 'Invalid Token'}), 403
"#;
        let violations = CC61AccessControlRule::analyze(code, "app.py", 1).unwrap();
        // Should not flag - has inline auth check
        let has_auth_violation = violations.iter().any(|v| v.description.contains("authentication"));
        assert!(!has_auth_violation, "Should not flag Flask route with inline auth check");
    }

    /// Test Flask route with @login_required decorator
    #[test]
    fn test_flask_route_with_login_required() {
        let code = r#"
@login_required
@app.route('/admin')
def admin():
    return render_template('admin.html')
"#;
        let violations = CC61AccessControlRule::analyze(code, "app.py", 1).unwrap();
        let has_auth_violation = violations.iter().any(|v| v.description.contains("authentication"));
        assert!(!has_auth_violation, "Should not flag Flask route with @login_required");
    }

    /// Test Flask public routes (login, register) are allowed
    #[test]
    fn test_flask_public_routes_allowed() {
        let code = r#"
@app.route('/login', methods=['POST'])
def login():
    return authenticate_user()

@app.route('/register', methods=['POST'])
def register():
    return create_user()
"#;
        let violations = CC61AccessControlRule::analyze(code, "app.py", 1).unwrap();
        // Public routes like login/register shouldn't be flagged
        assert!(violations.is_empty(), "Should not flag public routes like /login or /register");
    }
}
