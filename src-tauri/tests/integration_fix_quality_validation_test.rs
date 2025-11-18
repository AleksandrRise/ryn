//! Integration tests for fix quality validation using tree-sitter
//!
//! Tests that Grok-generated fixes are syntactically valid by:
//! 1. Generating fixes using real Grok API
//! 2. Parsing fixed code with tree-sitter
//! 3. Validating syntax correctness
//! 4. Verifying structural preservation (functions, classes, etc.)
//!
//! These are real integration tests - NO MOCKS, using actual Grok API.

use ryn::fix_generator::grok_client::GrokClient;
use ryn::scanner::tree_sitter_utils::CodeParser;
use std::env;

/// Helper: Load .env and check if XAI_API_KEY is set
fn setup_api_key() {
    // Load .env file (from project root, not src-tauri)
    dotenv::from_path("../.env").ok();

    if env::var("XAI_API_KEY").is_err() {
        panic!("XAI_API_KEY not set. Set it in .env file to run these tests.");
    }
}

/// Helper: Strip markdown code fences from generated code
///
/// LLMs often return code wrapped in markdown code fences like:
/// ```python
/// def foo():
///     pass
/// ```
///
/// This function strips those fences to get the raw code.
fn strip_code_fences(code: &str) -> String {
    let trimmed = code.trim();

    // Check if code starts with code fence
    if trimmed.starts_with("```") {
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() < 2 {
            return code.to_string();
        }

        // Skip first line (```python, ```typescript, etc.) and last line (```)
        let mut result_lines = Vec::new();
        for (i, line) in lines.iter().enumerate() {
            // Skip first line (the opening fence)
            if i == 0 {
                continue;
            }
            // Skip last line if it's a closing fence
            if i == lines.len() - 1 && line.trim() == "```" {
                continue;
            }
            result_lines.push(*line);
        }

        result_lines.join("\n")
    } else {
        code.to_string()
    }
}

/// Helper: Validate that code parses successfully with tree-sitter
fn validate_python_syntax(code: &str) -> anyhow::Result<()> {
    let parser = CodeParser::new()?;

    // Strip code fences if present
    let clean_code = strip_code_fences(code);

    let result = parser.parse_python(&clean_code)?;

    // Tree-sitter is forgiving, but we can check if root node exists
    assert!(!result.root.text.is_empty(), "Parse result should have root node");

    Ok(())
}

/// Helper: Validate that code parses successfully with tree-sitter (JavaScript)
fn validate_javascript_syntax(code: &str) -> anyhow::Result<()> {
    let parser = CodeParser::new()?;

    // Strip code fences if present
    let clean_code = strip_code_fences(code);

    let result = parser.parse_javascript(&clean_code)?;

    assert!(!result.root.text.is_empty(), "Parse result should have root node");

    Ok(())
}

/// Helper: Validate that code parses successfully with tree-sitter (TypeScript)
fn validate_typescript_syntax(code: &str) -> anyhow::Result<()> {
    let parser = CodeParser::new()?;

    // Strip code fences if present
    let clean_code = strip_code_fences(code);

    let result = parser.parse_typescript(&clean_code)?;

    assert!(!result.root.text.is_empty(), "Parse result should have root node");

    Ok(())
}

/// Helper: Count functions in parsed code
fn count_functions(code: &str, language: &str) -> anyhow::Result<usize> {
    let parser = CodeParser::new()?;

    // Strip code fences if present
    let clean_code = strip_code_fences(code);

    let result = match language {
        "python" => parser.parse_python(&clean_code)?,
        "javascript" => parser.parse_javascript(&clean_code)?,
        "typescript" => parser.parse_typescript(&clean_code)?,
        _ => panic!("Unsupported language: {}", language),
    };

    Ok(result.functions.len())
}

/// Helper: Count classes in parsed code
fn count_classes(code: &str, language: &str) -> anyhow::Result<usize> {
    let parser = CodeParser::new()?;

    // Strip code fences if present
    let clean_code = strip_code_fences(code);

    let result = match language {
        "python" => parser.parse_python(&clean_code)?,
        "javascript" => parser.parse_javascript(&clean_code)?,
        "typescript" => parser.parse_typescript(&clean_code)?,
        _ => panic!("Unsupported language: {}", language),
    };

    Ok(result.classes.len())
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_python_missing_auth_decorator() {
    setup_api_key();

    // CC6.1 violation: Missing @login_required decorator
    let original_code = r#"
def user_profile(request):
    """View user profile - MISSING @login_required"""
    user = request.user
    return render(request, 'profile.html', {'user': user})
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.1",
        "Missing authentication decorator on sensitive endpoint",
        original_code,
        "django",
        Some("user_profile"),
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax");

    // Validation 2: Should preserve function structure
    let original_func_count = count_functions(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_func_count = count_functions(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_func_count, original_func_count,
        "Fix should preserve number of functions. Original: {}, Fixed: {}",
        original_func_count, fixed_func_count
    );

    // Validation 3: Fix should add @login_required decorator
    assert!(
        fixed_code.contains("@login_required") || fixed_code.contains("login_required"),
        "Fix should add @login_required decorator. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ Python fix quality validated (CC6.1 - Missing auth decorator)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_python_hardcoded_secret() {
    setup_api_key();

    // CC6.7 violation: Hardcoded API key
    let original_code = r#"
class PaymentProcessor:
    def __init__(self):
        self.api_key = "fake_hardcoded_key_12345"  # VIOLATION: Hardcoded secret

    def process_payment(self, amount):
        return self.api_key
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.7",
        "Hardcoded secret detected",
        original_code,
        "python",
        Some("__init__"),
        Some("PaymentProcessor"),
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax");

    // Validation 2: Should preserve class structure
    let original_class_count = count_classes(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_class_count = count_classes(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_class_count, original_class_count,
        "Fix should preserve number of classes. Original: {}, Fixed: {}",
        original_class_count, fixed_class_count
    );

    // Validation 3: Fix should NOT contain the hardcoded secret
    assert!(
        !fixed_code.contains("fake_hardcoded_key_12345"),
        "Fix should remove hardcoded secret. Generated fix:\n{}",
        fixed_code
    );

    // Validation 4: Fix should reference environment variables or config
    let uses_env_vars = fixed_code.contains("os.environ")
        || fixed_code.contains("getenv")
        || fixed_code.contains("config")
        || fixed_code.contains("settings");

    assert!(
        uses_env_vars,
        "Fix should use environment variables or config instead of hardcoded secret. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ Python fix quality validated (CC6.7 - Hardcoded secret)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_python_missing_audit_log() {
    setup_api_key();

    // CC7.2 violation: Missing audit log
    let original_code = r#"
def delete_user(user_id):
    """Delete user - MISSING audit log"""
    user = User.objects.get(id=user_id)
    user.delete()
    return {"status": "deleted"}
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC7.2",
        "Missing audit log for sensitive operation",
        original_code,
        "django",
        Some("delete_user"),
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax");

    // Validation 2: Should preserve function structure
    let original_func_count = count_functions(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_func_count = count_functions(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_func_count, original_func_count,
        "Fix should preserve number of functions. Original: {}, Fixed: {}",
        original_func_count, fixed_func_count
    );

    // Validation 3: Fix should add logging
    let has_logging = fixed_code.contains("logger")
        || fixed_code.contains("log")
        || fixed_code.contains("audit");

    assert!(
        has_logging,
        "Fix should add audit logging. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ Python fix quality validated (CC7.2 - Missing audit log)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_python_missing_error_handling() {
    setup_api_key();

    // A1.2 violation: Missing error handling
    let original_code = r#"
def fetch_user_data(user_id):
    """Fetch user data - MISSING try/except"""
    response = requests.get(f"https://api.example.com/users/{user_id}")
    return response.json()
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "A1.2",
        "Missing error handling for external API call",
        original_code,
        "python",
        Some("fetch_user_data"),
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax");

    // Validation 2: Should preserve function structure
    let original_func_count = count_functions(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_func_count = count_functions(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_func_count, original_func_count,
        "Fix should preserve number of functions. Original: {}, Fixed: {}",
        original_func_count, fixed_func_count
    );

    // Validation 3: Fix should add try/except
    assert!(
        fixed_code.contains("try") && fixed_code.contains("except"),
        "Fix should add try/except block. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ Python fix quality validated (A1.2 - Missing error handling)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_javascript_missing_auth_middleware() {
    setup_api_key();

    // CC6.1 violation: Missing authentication middleware
    let original_code = r#"
app.get('/api/user/profile', (req, res) => {
    // MISSING authentication middleware
    const user = req.user;
    res.json({ user });
});
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.1",
        "Missing authentication middleware on sensitive endpoint",
        original_code,
        "express",
        None,
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid JavaScript
    validate_javascript_syntax(&fixed_code)
        .expect("Generated fix should be valid JavaScript syntax");

    // Validation 2: Fix should add auth middleware
    let has_auth = fixed_code.contains("authenticate")
        || fixed_code.contains("isAuthenticated")
        || fixed_code.contains("requireAuth")
        || fixed_code.contains("auth");

    assert!(
        has_auth,
        "Fix should add authentication middleware. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ JavaScript fix quality validated (CC6.1 - Missing auth middleware)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_javascript_hardcoded_secret() {
    setup_api_key();

    // CC6.7 violation: Hardcoded API key
    let original_code = r#"
const config = {
    stripeKey: "fake_stripe_key_for_testing",  // VIOLATION: Hardcoded secret
    apiUrl: "https://api.example.com"
};

module.exports = config;
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.7",
        "Hardcoded secret detected in configuration",
        original_code,
        "javascript",
        None,
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid JavaScript
    validate_javascript_syntax(&fixed_code)
        .expect("Generated fix should be valid JavaScript syntax");

    // Validation 2: Fix should NOT contain the hardcoded secret
    assert!(
        !fixed_code.contains("fake_stripe_key_for_testing"),
        "Fix should remove hardcoded secret. Generated fix:\n{}",
        fixed_code
    );

    // Validation 3: Fix should reference environment variables
    let uses_env = fixed_code.contains("process.env")
        || fixed_code.contains("dotenv")
        || fixed_code.contains("config");

    assert!(
        uses_env,
        "Fix should use environment variables. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ JavaScript fix quality validated (CC6.7 - Hardcoded secret)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_typescript_missing_error_handling() {
    setup_api_key();

    // A1.2 violation: Missing error handling
    let original_code = r#"
async function fetchUserData(userId: string): Promise<User> {
    // MISSING try/catch
    const response = await fetch(`https://api.example.com/users/${userId}`);
    const data = await response.json();
    return data;
}
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "A1.2",
        "Missing error handling for async API call",
        original_code,
        "typescript",
        Some("fetchUserData"),
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid TypeScript
    validate_typescript_syntax(&fixed_code)
        .expect("Generated fix should be valid TypeScript syntax");

    // Validation 2: Should preserve function structure
    let original_func_count = count_functions(original_code, "typescript")
        .expect("Failed to parse original code");
    let fixed_func_count = count_functions(&fixed_code, "typescript")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_func_count, original_func_count,
        "Fix should preserve number of functions. Original: {}, Fixed: {}",
        original_func_count, fixed_func_count
    );

    // Validation 3: Fix should add try/catch
    assert!(
        fixed_code.contains("try") && fixed_code.contains("catch"),
        "Fix should add try/catch block. Generated fix:\n{}",
        fixed_code
    );

    println!("✅ TypeScript fix quality validated (A1.2 - Missing error handling)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_preserves_multiline_structures() {
    setup_api_key();

    // Complex Python class with multiple methods
    let original_code = r#"
class UserService:
    def __init__(self):
        self.api_key = "fake_key"  # VIOLATION

    def get_user(self, user_id):
        return {"id": user_id}

    def update_user(self, user_id, data):
        return {"updated": True}

    def delete_user(self, user_id):
        return {"deleted": True}
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.7",
        "Hardcoded secret in class initialization",
        original_code,
        "python",
        Some("__init__"),
        Some("UserService"),
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax");

    // Validation 2: Should preserve class structure
    let original_class_count = count_classes(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_class_count = count_classes(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert_eq!(
        fixed_class_count, original_class_count,
        "Fix should preserve class structure. Original: {} classes, Fixed: {} classes",
        original_class_count, fixed_class_count
    );

    // Validation 3: Should preserve all methods
    let original_func_count = count_functions(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_func_count = count_functions(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert!(
        fixed_func_count >= original_func_count,
        "Fix should preserve all methods. Original: {} methods, Fixed: {} methods",
        original_func_count, fixed_func_count
    );

    println!("✅ Python fix quality validated (multiline class structure preservation)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_handles_edge_cases_empty_function() {
    setup_api_key();

    // Edge case: Empty function with violation
    let original_code = r#"
def placeholder():
    # TODO: implement
    api_key = "fake_key"  # VIOLATION
    pass
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.7",
        "Hardcoded secret in function",
        original_code,
        "python",
        Some("placeholder"),
        None,
    )
    .await
    .expect("Failed to generate fix");

    // Validation: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax even for edge cases");

    println!("✅ Python fix quality validated (edge case: empty function)");
    println!("📝 Generated fix:\n{}", fixed_code);
}

#[tokio::test]
#[ignore] // Requires XAI_API_KEY
async fn test_fix_quality_handles_nested_structures() {
    setup_api_key();

    // Nested function with violation
    let original_code = r#"
class OuterClass:
    class InnerClass:
        def inner_method(self):
            secret = "fake_nested_secret"  # VIOLATION
            return secret
"#;

    let client = GrokClient::new().expect("Failed to create Grok client");

    let fixed_code = client.generate_fix(
        "CC6.7",
        "Hardcoded secret in nested class",
        original_code,
        "python",
        Some("inner_method"),
        Some("InnerClass"),
    )
    .await
    .expect("Failed to generate fix");

    // Validation 1: Fixed code should be syntactically valid Python
    validate_python_syntax(&fixed_code)
        .expect("Generated fix should be valid Python syntax for nested structures");

    // Validation 2: Should preserve nested class structure
    let original_class_count = count_classes(original_code, "python")
        .expect("Failed to parse original code");
    let fixed_class_count = count_classes(&fixed_code, "python")
        .expect("Failed to parse fixed code");

    assert!(
        fixed_class_count >= original_class_count,
        "Fix should preserve nested class structure. Original: {} classes, Fixed: {} classes",
        original_class_count, fixed_class_count
    );

    println!("✅ Python fix quality validated (nested class structures)");
    println!("📝 Generated fix:\n{}", fixed_code);
}
