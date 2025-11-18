//! LLM File Selector Integration Tests
//!
//! Tests verify that file selection heuristics work correctly in real scanning scenarios:
//! - Smart mode selects ~30-40% of files (security-critical only)
//! - Regex-only mode selects 0% of files
//! - Analyze-all mode selects 100% of supported files
//! - File selection is deterministic and consistent
//! - Heuristics correctly identify security-relevant code patterns

mod common;

use common::TestProject;

/// Test that regex_only mode never selects files for LLM analysis
#[test]
fn test_regex_only_mode_selects_no_files() {
    let project = TestProject::new("regex_only_selection").unwrap();

    // Create diverse test files (auth, database, API, utility)
    let test_files = vec![
        ("auth.py", "@login_required\ndef admin(): pass"),
        ("database.py", "cursor.execute('SELECT * FROM users')"),
        ("api.py", "@app.route('/users')\ndef list_users(): pass"),
        ("utils.py", "def add(a, b): return a + b"),
    ];

    for (filename, code) in &test_files {
        project.create_file(filename, code).unwrap();
    }

    // Test file selector (import from src)
    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    let mut selected_count = 0;
    for (filename, code) in &test_files {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        if should_analyze_with_llm(&file_path, code, "regex_only") {
            selected_count += 1;
        }
    }

    assert_eq!(selected_count, 0, "regex_only mode should select 0 files for LLM analysis");
}

/// Test that analyze_all mode selects all supported files
#[test]
fn test_analyze_all_mode_selects_all_supported_files() {
    let project = TestProject::new("analyze_all_selection").unwrap();

    // Create test files with various languages
    let test_files = vec![
        ("app.py", "print('hello')"),
        ("server.js", "console.log('hello')"),
        ("component.tsx", "export const App = () => <div></div>"),
        ("main.go", "func main() {}"),
        ("README.md", "# Documentation"), // Unsupported
        ("config.json", "{}"),            // Unsupported
    ];

    for (filename, code) in &test_files {
        project.create_file(filename, code).unwrap();
    }

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    let mut selected_count = 0;
    for (filename, code) in &test_files {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        if should_analyze_with_llm(&file_path, code, "analyze_all") {
            selected_count += 1;
        }
    }

    // Should select 4 files (.py, .js, .tsx, .go) but not .md or .json
    assert_eq!(selected_count, 4, "analyze_all mode should select all supported language files");
}

/// Test that smart mode selects security-relevant files only
#[test]
fn test_smart_mode_selects_security_relevant_files() {
    let project = TestProject::new("smart_mode_selection").unwrap();

    // Create security-relevant files (should be selected)
    let security_files = vec![
        ("auth.py", "@login_required\ndef admin_panel(): pass"),
        ("database.py", "cursor.execute('INSERT INTO users VALUES (?, ?)', data)"),
        ("api.py", "@app.route('/api/users', methods=['POST'])"),
        ("secrets.py", "api_key = os.getenv('STRIPE_API_KEY')"),
        ("uploads.py", "file.write(user_upload_data)"),
        ("client.py", "response = requests.post('https://api.example.com')"),
    ];

    // Create non-security-relevant files (should NOT be selected)
    let utility_files = vec![
        ("utils.py", "def add(a, b): return a + b"),
        ("formatters.py", "def format_date(date): return date.strftime('%Y-%m-%d')"),
        ("constants.py", "MAX_RETRIES = 3\nTIMEOUT = 5000"),
        ("helpers.py", "def calculate_total(items): return sum(item.price for item in items)"),
    ];

    for (filename, code) in &security_files {
        project.create_file(filename, code).unwrap();
    }

    for (filename, code) in &utility_files {
        project.create_file(filename, code).unwrap();
    }

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    // Count selected security files
    let mut security_selected = 0;
    for (filename, code) in &security_files {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        if should_analyze_with_llm(&file_path, code, "smart") {
            security_selected += 1;
        }
    }

    // Count selected utility files
    let mut utility_selected = 0;
    for (filename, code) in &utility_files {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        if should_analyze_with_llm(&file_path, code, "smart") {
            utility_selected += 1;
        }
    }

    // All security files should be selected
    assert_eq!(
        security_selected, 6,
        "Smart mode should select all 6 security-relevant files"
    );

    // No utility files should be selected
    assert_eq!(
        utility_selected, 0,
        "Smart mode should not select non-security utility files"
    );
}

/// Test selection percentage in realistic codebase
#[test]
fn test_smart_mode_realistic_selection_percentage() {
    let project = TestProject::new("realistic_selection").unwrap();

    // Simulate realistic Flask application structure
    // ~30% security-relevant, ~70% utility/business logic

    // Security files (7 files)
    let security_files = vec![
        ("app/__init__.py", "from flask import Flask\napp = Flask(__name__)"),
        ("app/auth/login.py", "@app.route('/login', methods=['POST'])\ndef login(): pass"),
        ("app/auth/middleware.py", "from functools import wraps\n@login_required"),
        ("app/models/user.py", "class User(db.Model):\n    password = db.Column(db.String)"),
        ("app/api/users.py", "@app.route('/api/users')\ndef list_users(): pass"),
        ("app/config.py", "SECRET_KEY = os.getenv('SECRET_KEY')"),
        ("app/database.py", "db = SQLAlchemy(app)\ndb.session.commit()"),
    ];

    // Utility files (16 files - ~70% of total)
    let utility_files = vec![
        ("app/utils/formatters.py", "def format_date(d): return d.strftime('%Y-%m-%d')"),
        ("app/utils/validators.py", "def is_valid_email(email): return '@' in email"),
        ("app/utils/helpers.py", "def truncate(text, length): return text[:length]"),
        ("app/utils/constants.py", "MAX_PAGE_SIZE = 100\nDEFAULT_TIMEOUT = 30"),
        ("app/models/product.py", "class Product:\n    def __init__(self, name): self.name = name"),
        ("app/models/order.py", "class Order:\n    def calculate_total(self): return sum(self.items)"),
        ("app/templates/helpers.py", "def render_template(name, **ctx): pass"),
        ("app/views/home.py", "def home(): return render_template('home.html')"),
        ("app/views/about.py", "def about(): return render_template('about.html')"),
        ("app/forms/contact.py", "class ContactForm(Form): name = StringField()"),
        ("app/forms/validators.py", "def validate_phone(form, field): pass"),
        ("app/static/build.py", "def compile_assets(): pass"),
        ("app/tasks/email.py", "def format_email_body(user): return f'Hello {user.name}'"),
        ("app/tasks/notifications.py", "def create_notification_text(msg): return msg"),
        ("app/serializers/json.py", "def to_json(obj): return json.dumps(obj)"),
        ("app/serializers/xml.py", "def to_xml(obj): return ET.tostring(obj)"),
    ];

    for (filename, code) in &security_files {
        project.create_file(filename, code).unwrap();
    }

    for (filename, code) in &utility_files {
        project.create_file(filename, code).unwrap();
    }

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    let total_files = security_files.len() + utility_files.len();
    let mut selected_count = 0;

    for (filename, code) in security_files.iter().chain(utility_files.iter()) {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        if should_analyze_with_llm(&file_path, code, "smart") {
            selected_count += 1;
        }
    }

    let selection_percentage = (selected_count as f64 / total_files as f64) * 100.0;

    // Smart mode should select ~30% of files (7 security files out of 23 total = 30.4%)
    assert!(
        selection_percentage >= 25.0 && selection_percentage <= 40.0,
        "Smart mode should select ~30-40% of files, got {:.1}% ({}/{})",
        selection_percentage,
        selected_count,
        total_files
    );
}

/// Test authentication pattern detection across different frameworks
#[test]
fn test_auth_pattern_detection_across_frameworks() {
    let project = TestProject::new("auth_patterns").unwrap();

    let test_cases = vec![
        // Django
        ("django_view.py", "@login_required\ndef admin(): pass", true),
        ("django_middleware.py", "if not request.user.is_authenticated: return", true),

        // Flask
        ("flask_view.py", "@login_required\n@admin_required\ndef panel(): pass", true),
        ("flask_auth.py", "session.get('user_id')", true),

        // Express.js
        ("express_middleware.js", "passport.authenticate('local')", true),
        ("express_routes.js", "if (!request.user.is_authenticated) return res.status(401)", true),

        // FastAPI
        ("fastapi_routes.py", "current_user: User = Depends(get_current_user)", true),
        ("fastapi_security.py", "oauth2_scheme = OAuth2PasswordBearer()", true),

        // Non-auth files
        ("utils.py", "def calculate(x, y): return x + y", false),
        ("constants.js", "const MAX_RETRIES = 3", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test database operation pattern detection
#[test]
fn test_database_pattern_detection() {
    let project = TestProject::new("db_patterns").unwrap();

    let test_cases = vec![
        // SQL queries
        ("raw_sql.py", "cursor.execute('INSERT INTO users VALUES (?, ?)')", true),
        ("sql_update.py", "connection.execute('UPDATE users SET name = ?')", true),

        // ORM operations
        ("sqlalchemy.py", "db.session.add(user)\ndb.session.commit()", true),
        ("django_orm.py", "User.objects.filter(id=user_id).delete()", true),
        ("sequelize.js", "sequelize.User.create({ name: 'test' })", true),
        ("mongoose.js", "const schema = new mongoose.Schema({ name: String })", true),
        ("prisma.ts", "prisma.user.create({ data: { name: 'test' } })", true),

        // Non-database files
        ("math_utils.py", "def sum(numbers): return sum(numbers)", false),
        ("formatters.js", "function formatDate(date) { return date.toISOString() }", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test API endpoint pattern detection
#[test]
fn test_api_endpoint_pattern_detection() {
    let project = TestProject::new("api_patterns").unwrap();

    let test_cases = vec![
        // Flask
        ("flask_api.py", "@app.route('/api/users', methods=['POST', 'GET'])", true),
        ("flask_blueprint.py", "@blueprint.route('/admin')", true),

        // FastAPI
        ("fastapi_router.py", "@router.get('/users/{user_id}')", true),
        ("fastapi_app.py", "@app.post('/login')", true),

        // Express
        ("express_routes.js", "router.post('/api/users', async (req, res) => {})", true),
        ("express_app.js", "app.get('/health', (req, res) => res.send('OK'))", true),

        // Go
        ("go_handlers.go", "http.HandleFunc(\"/api/users\", handleUsers)", true),

        // Spring
        ("spring_controller.java", "@RestController\n@RequestMapping(\"/api\")", true),
        ("spring_get.java", "@GetMapping(\"/users/{id}\")", true),

        // Non-API files
        ("helpers.py", "def process_data(data): return data", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test secrets/credentials pattern detection
#[test]
fn test_secrets_pattern_detection() {
    let project = TestProject::new("secrets_patterns").unwrap();

    let test_cases = vec![
        // Environment variables
        ("config.py", "SECRET_KEY = os.getenv('SECRET_KEY')", true),
        ("env.js", "const API_KEY = process.env.STRIPE_API_KEY", true),

        // Credentials handling
        ("auth.py", "password = request.form.get('password')", true),
        ("tokens.js", "const bearer = req.headers.authorization.split(' ')[1]", true),

        // Encryption
        ("crypto.py", "encrypted = encrypt(data, private_key)", true),
        ("vault.py", "secret = vault.read('database/credentials')", true),

        // Non-secrets files
        ("display.py", "def show_message(msg): print(msg)", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test file I/O pattern detection
#[test]
fn test_file_io_pattern_detection() {
    let project = TestProject::new("file_io_patterns").unwrap();

    let test_cases = vec![
        // Python file operations
        ("file_handler.py", "with open(user_path, 'w') as f: f.write(data)", true),
        ("uploads.py", "file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))", true),

        // JavaScript/Node.js file operations
        ("file_ops.js", "fs.readFile(path, 'utf8', callback)", true),
        ("writer.js", "fs.writeFileSync(tempfile, data)", true),

        // Path operations
        ("paths.py", "full_path = os.path.join(base_dir, user_input)", true),

        // Non-file-I/O files
        ("calculator.py", "def multiply(a, b): return a * b", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test network operation pattern detection
#[test]
fn test_network_pattern_detection() {
    let project = TestProject::new("network_patterns").unwrap();

    let test_cases = vec![
        // Python
        ("api_client.py", "response = requests.post('https://api.example.com', data=payload)", true),
        ("http_client.py", "urllib.request.urlopen('https://example.com')", true),

        // JavaScript
        ("fetch_client.js", "fetch('/api/users').then(res => res.json())", true),
        ("axios_client.js", "axios.get('/api/data').then(handleResponse)", true),

        // WebSockets
        ("websocket.py", "ws = websocket.WebSocketApp('wss://example.com')", true),
        ("socket_io.js", "const socket = io('https://server.com')", true),

        // Non-network files
        ("string_utils.py", "def capitalize(text): return text.upper()", false),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "File {} with code {:?} should {}be selected",
            filename,
            code.chars().take(40).collect::<String>(),
            if should_select { "" } else { "NOT " }
        );
    }
}

/// Test unsupported file types are never selected
#[test]
fn test_unsupported_file_types_never_selected() {
    let project = TestProject::new("unsupported_types").unwrap();

    // Create files with security-relevant content but unsupported extensions
    let unsupported_files = vec![
        ("README.md", "@login_required\npassword = 'secret'"),
        ("config.yml", "database: postgresql://user:password@localhost"),
        ("data.json", "{\"api_key\": \"secret\", \"password\": \"test\"}"),
        ("notes.txt", "INSERT INTO users VALUES ('admin', 'password')"),
        ("Dockerfile", "ENV SECRET_KEY=mysecret"),
        ("Makefile", "deploy: git push heroku master"),
    ];

    for (filename, code) in &unsupported_files {
        project.create_file(filename, code).unwrap();
    }

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code) in &unsupported_files {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();

        // Test all modes - none should select unsupported files
        assert!(
            !should_analyze_with_llm(&file_path, code, "regex_only"),
            "{} should not be selected in regex_only mode",
            filename
        );

        assert!(
            !should_analyze_with_llm(&file_path, code, "smart"),
            "{} should not be selected in smart mode",
            filename
        );

        assert!(
            !should_analyze_with_llm(&file_path, code, "analyze_all"),
            "{} should not be selected in analyze_all mode",
            filename
        );
    }
}

/// Test case-insensitive matching works correctly
#[test]
fn test_case_insensitive_matching() {
    let project = TestProject::new("case_insensitive").unwrap();

    let test_cases = vec![
        ("mixed_case.py", "PASSWORD = 'test'\n@LOGIN_REQUIRED\ndef ADMIN(): pass", true),
        ("upper_case.py", "API_KEY = OS.GETENV('SECRET')", true),
        ("camel_case.js", "const ApiKey = process.env.StripeApiKey", true),
    ];

    use ryn::scanner::llm_file_selector::should_analyze_with_llm;

    for (filename, code, should_select) in test_cases {
        let file_path = project.project_dir().join(filename).to_string_lossy().to_string();
        let selected = should_analyze_with_llm(&file_path, code, "smart");

        assert_eq!(
            selected, should_select,
            "Case-insensitive matching failed for {}",
            filename
        );
    }
}
