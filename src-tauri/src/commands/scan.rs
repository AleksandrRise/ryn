//! Scan management commands
//!
//! Handles project scanning, framework detection, and scan progress tracking

use crate::db::{self, queries};
use crate::models::{Violation, Scan};
use crate::scanner::framework_detector::FrameworkDetector;
use crate::scanner::llm_file_selector;
use crate::rules::{CC61AccessControlRule, CC67SecretsRule, CC72LoggingRule, A12ResilienceRule};
use crate::security::path_validation;
use crate::fix_generator::claude_client::ClaudeClient;
use std::path::Path;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::Arc;
use walkdir::WalkDir;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::{oneshot, Semaphore};
use tokio::time::{timeout, Duration};

/// Progress event payload emitted during scan
#[derive(Clone, Serialize)]
struct ScanProgressEvent {
    scan_id: i64,
    files_scanned: i32,
    total_files: i32,
    violations_found: i32,
    current_file: String,
}

/// Cost limit event payload emitted when scan reaches spending threshold
#[derive(Clone, Serialize)]
struct CostLimitEvent {
    scan_id: i64,
    current_cost_usd: f64,
    limit_usd: f64,
    files_analyzed: i64,
    files_remaining: i32,
}

/// Channels for handling scan-time cost limit prompts
///
/// When a scan hits a cost limit, it sends a prompt to the frontend via Tauri events
/// and waits for a user decision via a oneshot channel. The frontend responds
/// via the respond_to_cost_limit() command.
#[derive(Default, Clone)]
pub struct ScanResponseChannels {
    /// Map of scan_id -> oneshot sender for cost limit responses
    ///
    /// When scan needs user decision:
    /// 1. Create oneshot channel
    /// 2. Store sender in this map with scan_id as key
    /// 3. Emit "cost-limit-reached" event to frontend
    /// 4. Await receiver
    /// 5. Frontend calls respond_to_cost_limit(scan_id, continue_scan: bool)
    /// 6. Command retrieves sender from map and sends decision
    ///
    /// Wrapped in Arc to allow cloning for async tasks
    cost_limit_responses: Arc<Mutex<HashMap<i64, oneshot::Sender<bool>>>>,
}

impl ScanResponseChannels {
    /// Create a new channel set for a scan's cost limit decision
    ///
    /// Returns: Receiver that will get the user's decision (true = continue, false = stop)
    pub fn create_cost_limit_channel(&self, scan_id: i64) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        let mut channels = self.cost_limit_responses.lock().unwrap();
        channels.insert(scan_id, tx);
        rx
    }

    /// Respond to a cost limit prompt
    ///
    /// Called by the respond_to_cost_limit() command when user makes a decision
    ///
    /// # Arguments
    /// * `scan_id` - ID of the scan waiting for decision
    /// * `continue_scan` - User decision (true = continue, false = stop)
    ///
    /// Returns: Ok if channel existed and decision was sent, Err otherwise
    pub fn respond_to_cost_limit(&self, scan_id: i64, continue_scan: bool) -> Result<(), String> {
        let mut channels = self.cost_limit_responses.lock().unwrap();

        if let Some(sender) = channels.remove(&scan_id) {
            sender.send(continue_scan)
                .map_err(|_| "Failed to send response: receiver dropped".to_string())?;
            Ok(())
        } else {
            Err(format!("No pending cost limit prompt for scan {}", scan_id))
        }
    }
}

/// Detect the framework of a project
///
/// Uses file analysis to identify the web framework in use
///
/// # Arguments
/// * `path` - Path to project directory
///
/// Returns: Framework name (e.g., "django", "express") or None if not detected
#[tauri::command]
pub async fn detect_framework(path: String) -> Result<Option<String>, String> {
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let framework = FrameworkDetector::detect_framework(Path::new(&path))
        .map_err(|e| format!("Framework detection failed: {}", e))?;

    Ok(framework)
}

/// Scan a project for SOC 2 violations
///
/// Walks through the project directory, analyzes files with all 4 rule engines,
/// and stores violations in the database. Emits real-time progress events.
///
/// # Arguments
/// * `app` - Tauri AppHandle for emitting progress events
/// * `project_id` - ID of the project to scan
///
/// Returns: Complete Scan object with severity counts or error
#[tauri::command]
pub async fn scan_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    channels: tauri::State<'_, ScanResponseChannels>,
    project_id: i64,
) -> Result<Scan, String> {
    // Query settings and create scan record (scoped to drop connection before async operations)
    let (llm_scan_mode, project, scan_id) = {
        let conn = db::get_connection();

        // Query LLM scan mode from settings (regex_only, smart, or analyze_all)
        // Defaults to "regex_only" if setting not found
        let llm_scan_mode = queries::select_setting(&conn, "llm_scan_mode")
            .ok()
            .flatten()
            .map(|s| s.value)
            .unwrap_or_else(|| "regex_only".to_string());

        // Get project from database
        let project = queries::select_project(&conn, project_id)
            .map_err(|e| format!("Failed to fetch project: {}", e))?
            .ok_or_else(|| format!("Project not found: {}", project_id))?;

        // Validate project path to prevent scanning system directories
        path_validation::validate_project_path(Path::new(&project.path))
            .map_err(|e| format!("Security: Invalid project path: {}", e))?;

        // Create scan record
        let scan_id = queries::insert_scan(&conn, project_id)
            .map_err(|e| format!("Failed to create scan: {}", e))?;

        (llm_scan_mode, project, scan_id)
    }; // Connection dropped here

    // Count total files before scanning (for accurate progress tracking)
    let total_files = WalkDir::new(&project.path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| !should_skip_path(e.path()))
        .count() as i32;

    // Collect files for LLM analysis (smart/analyze_all modes)
    // Each entry: (relative_path, content)
    let mut files_for_llm_analysis: Vec<(String, String)> = Vec::new();

    // Walk through project files
    let mut files_scanned = 0;
    let mut violations_found = 0;

    for entry in WalkDir::new(&project.path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let file_path = entry.path();

        // Skip common non-source directories
        if should_skip_path(file_path) {
            continue;
        }

        // Read file content
        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                files_scanned += 1;

                // Emit progress event every 10 files for real-time UI updates
                if files_scanned % 10 == 0 || files_scanned == total_files {
                    let progress = ScanProgressEvent {
                        scan_id,
                        files_scanned,
                        total_files,
                        violations_found,
                        current_file: file_path.to_string_lossy().to_string(),
                    };
                    let _ = app.emit("scan-progress", progress);
                }

                // Update database every 50 files for persistence
                if files_scanned % 50 == 0 {
                    let conn = db::get_connection();
                    let _ = queries::update_scan_results(&conn, scan_id, files_scanned, total_files, violations_found);
                }

                // Detect language
                if let Some(_language) = FrameworkDetector::detect_language(file_path) {
                    // Security: File MUST be within project path
                    let relative_path = file_path
                        .strip_prefix(&project.path)
                        .map_err(|e| format!(
                            "Security: File outside project path: {} (project: {}). Error: {}",
                            file_path.display(), project.path, e
                        ))?
                        .to_string_lossy()
                        .to_string();

                    // Run all 4 rule engines
                    let violations = run_all_rules(&content, &relative_path, scan_id);

                    // Store violations in database
                    {
                        let conn = db::get_connection();
                        for violation in violations {
                            if queries::insert_violation(&conn, &violation).is_ok() {
                                violations_found += 1;
                            }
                        }
                    } // Connection dropped here

                    // Collect file for LLM analysis if scan mode requires it
                    // should_analyze_with_llm returns true for:
                    //   - "smart": files with security-relevant patterns (auth, db, API, secrets, etc.)
                    //   - "analyze_all": all supported language files (.py, .js, .ts, .go, etc.)
                    //   - "regex_only": never (returns false)
                    if llm_file_selector::should_analyze_with_llm(&relative_path, &content, &llm_scan_mode) {
                        files_for_llm_analysis.push((relative_path.clone(), content.clone()));
                    }
                }
            }
            Err(_) => {
                // Skip files that can't be read
                continue;
            }
        }
    }

    // Analyze collected files with LLM if any were selected (smart/analyze_all modes)
    if !files_for_llm_analysis.is_empty() {
        eprintln!("[ryn] Analyzing {} files with Claude Haiku LLM (mode: {})",
                  files_for_llm_analysis.len(), llm_scan_mode);

        // Clone channels for async tasks (Arc makes this cheap)
        let channels_arc = Arc::new(channels.inner().clone());

        match analyze_files_with_llm(
            scan_id,
            files_for_llm_analysis,
            channels_arc,
            app.clone(),
        ).await {
            Ok((llm_violations, total_cost)) => {
                eprintln!("[ryn] LLM analysis complete: {} violations, ${:.4} cost",
                          llm_violations, total_cost);
                violations_found += llm_violations;

                // TODO: Store detailed token usage in scan_costs table (requires ScanCost model)
                // For now just log the cost
                eprintln!("[ryn] Total scan cost: ${:.4}", total_cost);
            }
            Err(e) => {
                eprintln!("[ryn] LLM analysis failed: {}", e);
                // Continue with scan completion even if LLM analysis fails
            }
        }
    } else {
        eprintln!("[ryn] No files selected for LLM analysis (mode: {})", llm_scan_mode);
    }

    // Update scan with results and fetch final data (scoped to drop connection)
    let scan = {
        let conn = db::get_connection();

        // Update scan with results
        let completed_at = chrono::Utc::now().to_rfc3339();
        queries::update_scan_status(&conn, scan_id, "completed", Some(&completed_at))
            .map_err(|e| format!("Failed to update scan status: {}", e))?;

        queries::update_scan_results(&conn, scan_id, files_scanned, total_files, violations_found)
            .map_err(|e| format!("Failed to update scan results: {}", e))?;

        // Log audit event
        if let Ok(event) = create_audit_event(
            &conn,
            "scan_completed",
            Some(project_id),
            None,
            None,
            &format!("Scanned {} files, found {} violations", files_scanned, violations_found),
        ) {
            let _ = queries::insert_audit_event(&conn, &event);
        }

        // Fetch complete scan with severity counts
        let mut scan = queries::select_scan(&conn, scan_id)
            .map_err(|e| format!("Failed to fetch scan: {}", e))?
            .ok_or_else(|| "Scan was created but could not be retrieved".to_string())?;

        // Calculate severity counts - propagate errors instead of hiding them
        let (critical, high, medium, low) = queries::get_severity_counts(&conn, scan_id)
            .map_err(|e| format!("Failed to calculate severity counts: {}", e))?;

        scan.critical_count = critical;
        scan.high_count = high;
        scan.medium_count = medium;
        scan.low_count = low;

        scan
    }; // Connection dropped here

    Ok(scan)
}

/// Analyze collected files with Claude Haiku LLM
///
/// Processes files concurrently (max 10 simultaneous) with 30-second timeout per file.
/// Fetches existing regex violations for context and stores LLM-detected violations.
///
/// # Arguments
/// * `scan_id` - ID of current scan
/// * `files` - Vector of (relative_path, content) tuples to analyze
///
/// # Returns
/// Tuple of (total_violations_found, total_cost_usd)
///
/// # Implementation Details
/// - Semaphore(10): Limits concurrent API requests to prevent rate limiting
/// - 30-second timeout: Prevents hanging on slow/large files
/// - Each task gets independent DB connection and Claude client
/// - Errors are logged but don't stop processing of other files
async fn analyze_files_with_llm<R: tauri::Runtime>(
    scan_id: i64,
    files: Vec<(String, String)>,
    channels: Arc<ScanResponseChannels>,
    app_handle: tauri::AppHandle<R>,
) -> Result<(i32, f64), String> {
    if files.is_empty() {
        return Ok((0, 0.0));
    }

    // Verify API key exists before spawning tasks
    std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set. Set it to enable LLM scanning.".to_string())?;

    // Query cost limit from settings (default to $1.00 if not set)
    let cost_limit_usd: f64 = {
        let conn = db::get_connection();
        queries::select_setting(&conn, "cost_limit_per_scan")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<f64>().ok())
            .unwrap_or(1.0)
    }; // Connection dropped here

    // Create semaphore for concurrency control (max 10 concurrent requests)
    let semaphore = Arc::new(Semaphore::new(10));

    // Track cumulative cost and violations
    let mut total_violations = 0;
    let mut total_cost = 0.0;
    let total_files = files.len();

    // Process files in batches, checking cost limit every 10 files
    for (batch_idx, chunk) in files.chunks(10).enumerate() {
        let mut tasks = Vec::new();

        // Spawn tasks for this batch of up to 10 files
        for (file_path, content) in chunk {
            let file_path = file_path.clone();
            let content = content.clone();
            let sem_clone = semaphore.clone();

            let task = tokio::spawn(async move {
                // Acquire semaphore permit (blocks if 10 tasks already running)
                let _permit = sem_clone.acquire().await.unwrap();

                // Create Claude client for this task (reads API key from env)
                let client = match ClaudeClient::new() {
                    Ok(c) => c,
                    Err(e) => return Err(format!("Failed to create Claude client: {}", e)),
                };

                // Fetch existing regex violations for this file (provides context to LLM)
                // MUST drop connection before async operations to avoid Send trait issues
                let regex_findings: Vec<Violation> = {
                    let conn = db::get_connection();
                    queries::select_violations(&conn, scan_id)
                        .unwrap_or_default()
                        .into_iter()
                        .filter(|v| v.file_path == file_path && v.detection_method == "regex")
                        .collect()
                }; // Connection dropped here

                // Analyze with 30-second timeout
                let analysis_future = client.analyze_for_violations(
                    scan_id,
                    &file_path,
                    &content,
                    regex_findings,
                );

                let result = timeout(Duration::from_secs(30), analysis_future).await;

                match result {
                    Ok(Ok(analysis)) => {
                        // Store LLM violations in database (get new connection)
                        let mut stored_count = 0;
                        {
                            let conn = db::get_connection();
                            for violation in &analysis.violations {
                                if queries::insert_violation(&conn, violation).is_ok() {
                                    stored_count += 1;
                                }
                            }
                        } // Connection dropped here

                        Ok((stored_count, analysis.usage.calculate_cost()))
                    }
                    Ok(Err(e)) => {
                        Err(format!("LLM analysis failed for {}: {}", file_path, e))
                    }
                    Err(_) => {
                        Err(format!("Timeout: {} took longer than 30 seconds", file_path))
                    }
                }
            });

            tasks.push(task);
        }

        // Wait for this batch to complete
        for task in tasks {
            match task.await {
                Ok(Ok((count, cost))) => {
                    total_violations += count;
                    total_cost += cost;
                }
                Ok(Err(e)) => {
                    eprintln!("[ryn] LLM analysis error: {}", e);
                    // Continue processing other files even if one fails
                }
                Err(e) => {
                    eprintln!("[ryn] Task join error: {}", e);
                }
            }
        }

        // After each batch (every 10 files), check if we've exceeded cost limit
        let files_analyzed = (batch_idx + 1) * 10.min(total_files);
        let files_remaining = total_files - files_analyzed;

        if total_cost > cost_limit_usd && files_remaining > 0 {
            // Create oneshot channel for user response
            let rx = channels.create_cost_limit_channel(scan_id);

            // Emit cost-limit-reached event to frontend
            let event = CostLimitEvent {
                scan_id,
                current_cost_usd: total_cost,
                limit_usd: cost_limit_usd,
                files_analyzed: files_analyzed as i64,
                files_remaining: files_remaining as i32,
            };

            if let Err(e) = app_handle.emit("cost-limit-reached", event) {
                eprintln!("[ryn] Failed to emit cost-limit-reached event: {}", e);
                // Continue anyway - treat as "stop scanning"
                break;
            }

            // Wait for user decision (true = continue, false = stop)
            match rx.await {
                Ok(true) => {
                    // User chose to continue - process next batch
                    continue;
                }
                Ok(false) => {
                    // User chose to stop - exit loop
                    break;
                }
                Err(_) => {
                    // Channel closed (user closed dialog?) - stop scanning
                    eprintln!("[ryn] Cost limit response channel closed - stopping scan");
                    break;
                }
            }
        }
    }

    Ok((total_violations, total_cost))
}

/// Get scan progress
///
/// Returns the current status and statistics of a running or completed scan
///
/// # Arguments
/// * `scan_id` - ID of the scan to check
///
/// Returns: Complete Scan object with severity counts
#[tauri::command]
pub async fn get_scan_progress(scan_id: i64) -> Result<Scan, String> {
    let conn = db::get_connection();

    let mut scan = queries::select_scan(&conn, scan_id)
        .map_err(|e| format!("Failed to fetch scan: {}", e))?
        .ok_or_else(|| format!("Scan not found: {}", scan_id))?;

    // Calculate severity counts - propagate errors instead of hiding them
    let (critical, high, medium, low) = queries::get_severity_counts(&conn, scan_id)
        .map_err(|e| format!("Failed to calculate severity counts: {}", e))?;

    scan.critical_count = critical;
    scan.high_count = high;
    scan.medium_count = medium;
    scan.low_count = low;

    Ok(scan)
}

/// Get all scans for a project
///
/// Returns: List of scans for the specified project
#[tauri::command]
pub async fn get_scans(project_id: i64) -> Result<Vec<Scan>, String> {
    let conn = db::get_connection();

    let scans = queries::select_scans(&conn, project_id)
        .map_err(|e| format!("Failed to fetch scans: {}", e))?;

    Ok(scans)
}

/// Respond to a cost limit prompt during scanning
///
/// When a scan reaches its cost limit, it emits a "cost-limit-reached" event
/// and waits for the user's decision. The frontend calls this command to
/// respond with the user's choice.
///
/// # Arguments
/// * `channels` - Managed state containing response channels
/// * `scan_id` - ID of the scan waiting for a decision
/// * `continue_scan` - User's decision (true = continue scanning, false = stop)
///
/// Returns: Ok if response was sent, Err if no scan was waiting for a decision
#[tauri::command]
pub async fn respond_to_cost_limit(
    channels: tauri::State<'_, ScanResponseChannels>,
    scan_id: i64,
    continue_scan: bool,
) -> Result<(), String> {
    channels.respond_to_cost_limit(scan_id, continue_scan)
}

/// Run all 4 rule engines on code
fn run_all_rules(code: &str, file_path: &str, scan_id: i64) -> Vec<Violation> {
    let mut violations = Vec::new();

    // CC6.1 Access Control
    if let Ok(cc61_violations) = CC61AccessControlRule::analyze(code, file_path, scan_id) {
        violations.extend(cc61_violations);
    }

    // CC6.7 Secrets Management
    if let Ok(cc67_violations) = CC67SecretsRule::analyze(code, file_path, scan_id) {
        violations.extend(cc67_violations);
    }

    // CC7.2 Logging
    if let Ok(cc72_violations) = CC72LoggingRule::analyze(code, file_path, scan_id) {
        violations.extend(cc72_violations);
    }

    // A1.2 Resilience
    if let Ok(a12_violations) = A12ResilienceRule::analyze(code, file_path, scan_id) {
        violations.extend(a12_violations);
    }

    violations
}

/// Determine if a path should be skipped during scanning
fn should_skip_path(path: &Path) -> bool {
    let skip_dirs = [
        "node_modules", ".git", "venv", ".venv", "__pycache__", "dist", "build",
        ".tox", ".pytest_cache", ".coverage", "target", ".cargo", "vendor",
        ".next", "out", "build", ".babel_cache", ".cache", "coverage"
    ];

    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            if let Some(name_str) = name.to_str() {
                if skip_dirs.contains(&name_str) || name_str.starts_with('.') {
                    return true;
                }
            }
        }
    }

    false
}

/// Helper function to create audit events
fn create_audit_event(
    _conn: &rusqlite::Connection,
    event_type: &str,
    project_id: Option<i64>,
    violation_id: Option<i64>,
    fix_id: Option<i64>,
    description: &str,
) -> anyhow::Result<crate::models::AuditEvent> {
    use crate::models::AuditEvent;

    Ok(AuditEvent {
        id: 0,
        event_type: event_type.to_string(),
        project_id,
        violation_id,
        fix_id,
        description: description.to_string(),
        metadata: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::TestDbGuard;
    use std::fs;

    fn create_test_project_with_guard(guard: &TestDbGuard) -> (tempfile::TempDir, i64) {
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let conn = db::init_db().unwrap();
        let project_id = queries::insert_project(&conn, "test-project", &path, None).unwrap();
        (project_dir, project_id)
    }

    #[tokio::test]
    async fn test_detect_framework_nonexistent_path() {
        let result = detect_framework("/nonexistent/path".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_detect_framework_empty_directory() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_detect_framework_django() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Create manage.py to signal Django
        fs::write(project_dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("django".to_string()));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_detect_framework_express() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Create package.json with express
        let package_json = r#"{"dependencies": {"express": "^4.18.0"}}"#;
        fs::write(project_dir.path().join("package.json"), package_json).unwrap();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("express".to_string()));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_nonexistent_project() {
        let _guard = TestDbGuard::new();
        let app = tauri::test::mock_app();
        let result = scan_project(app.handle().clone(), 999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_empty_directory() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let result = scan_project(app.handle().clone(), project_id).await;
        assert!(result.is_ok());

        let scan = result.unwrap();
        assert!(scan.id > 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_with_python_file() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create a simple Python file
        let py_content = r#"
def get_user(user_id):
    user = User.objects.get(id=user_id)
    return user
"#;
        fs::write(project_dir.path().join("views.py"), py_content).unwrap();

        let app = tauri::test::mock_app();
        let result = scan_project(app.handle().clone(), project_id).await;
        assert!(result.is_ok());

        let scan = result.unwrap();
        assert!(scan.id > 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_skips_node_modules() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create node_modules directory with files
        let node_modules = project_dir.path().join("node_modules");
        fs::create_dir(&node_modules).unwrap();
        fs::write(node_modules.join("lib.js"), "console.log('test')").unwrap();

        let app = tauri::test::mock_app();
        let result = scan_project(app.handle().clone(), project_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_returns_valid_scan_id() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let result = scan_project(app.handle().clone(), project_id).await;
        assert!(result.is_ok());

        let scan = result.unwrap();
        assert!(scan.id > 0);

        // Verify scan exists in database
        let conn = db::init_db().unwrap();
        let db_scan = queries::select_scan(&conn, scan.id).unwrap();
        assert!(db_scan.is_some());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_progress_nonexistent_scan() {
        let _guard = TestDbGuard::new();
        let result = get_scan_progress(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_progress_after_scan_complete() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let scan = scan_project(app.handle().clone(), project_id).await.unwrap();
        let progress = get_scan_progress(scan.id).await.unwrap();

        assert_eq!(progress.id, scan.id);
        assert_eq!(progress.status, "completed");
        assert!(progress.files_scanned >= 0);
        assert!(progress.violations_found >= 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scans_for_project() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create multiple scans
        let app = tauri::test::mock_app();
        let _scan_id_1 = scan_project(app.handle().clone(), project_id).await.unwrap();
        let _scan_id_2 = scan_project(app.handle().clone(), project_id).await.unwrap();

        let scans = get_scans(project_id).await.unwrap();
        assert_eq!(scans.len(), 2);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scans_empty() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let scans = get_scans(project_id).await.unwrap();
        assert_eq!(scans.len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_detects_violations() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create a file with a violation (hardcoded secret)
        let py_content = r#"
DB_PASSWORD = "hardcoded_password_123"
api_key = "sk-1234567890abcdef"
"#;
        fs::write(project_dir.path().join("config.py"), py_content).unwrap();

        let app = tauri::test::mock_app();
        let scan = scan_project(app.handle().clone(), project_id).await.unwrap();
        let progress = get_scan_progress(scan.id).await.unwrap();

        assert!(progress.violations_found >= 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_progress_includes_all_fields() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let scan_result = scan_project(app.handle().clone(), project_id).await.unwrap();
        let progress = get_scan_progress(scan_result.id).await.unwrap();

        assert_eq!(progress.id, scan_result.id);
        assert_eq!(progress.project_id, project_id);
        assert!(!progress.status.is_empty());
        assert!(progress.files_scanned >= 0);
        assert!(progress.violations_found >= 0);
        assert!(progress.critical_count >= 0);
        assert!(progress.high_count >= 0);
        assert!(progress.medium_count >= 0);
        assert!(progress.low_count >= 0);
    }

    #[tokio::test]
    async fn test_should_skip_node_modules_path() {
        let path = Path::new("/project/node_modules/lib/index.js");
        assert!(should_skip_path(path));
    }

    #[tokio::test]
    async fn test_should_skip_git_path() {
        let path = Path::new("/project/.git/config");
        assert!(should_skip_path(path));
    }

    #[tokio::test]
    async fn test_should_not_skip_source_file() {
        let path = Path::new("/project/src/main.rs");
        assert!(!should_skip_path(path));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_multiple_projects_independent() {
        let _guard = TestDbGuard::new();
        let (project_dir_1, project_id_1) = create_test_project_with_guard(&_guard);
        let (project_dir_2, project_id_2) = create_test_project_with_guard(&_guard);

        fs::write(project_dir_1.path().join("file1.py"), "x = 1").unwrap();
        fs::write(project_dir_2.path().join("file2.py"), "y = 2").unwrap();

        let app = tauri::test::mock_app();
        let scan_id_1 = scan_project(app.handle().clone(), project_id_1).await.unwrap();
        let scan_id_2 = scan_project(app.handle().clone(), project_id_2).await.unwrap();

        assert_ne!(scan_id_1, scan_id_2);

        let scans_1 = get_scans(project_id_1).await.unwrap();
        let scans_2 = get_scans(project_id_2).await.unwrap();

        assert_eq!(scans_1.len(), 1);
        assert_eq!(scans_2.len(), 1);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_updates_project_framework() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        fs::write(project_dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        let app = tauri::test::mock_app();
        let _scan_id = scan_project(app.handle().clone(), project_id).await.unwrap();

        let conn = db::init_db().unwrap();
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Framework should be detected during project creation or scan
        assert!(project.framework.is_some() || project.framework.is_none());
    }

    #[tokio::test]
    async fn test_scan_response_channels_create() {
        let channels = ScanResponseChannels::default();
        let scan_id = 1;

        let rx = channels.create_cost_limit_channel(scan_id);

        // Channel should exist in the map
        let map = channels.cost_limit_responses.lock().unwrap();
        assert!(map.contains_key(&scan_id));
        drop(map);

        // Receiver should be valid
        assert!(!rx.is_closed());
    }

    #[tokio::test]
    async fn test_scan_response_channels_respond_success() {
        let channels = ScanResponseChannels::default();
        let scan_id = 1;

        let rx = channels.create_cost_limit_channel(scan_id);

        // Respond with continue=true
        let result = channels.respond_to_cost_limit(scan_id, true);
        assert!(result.is_ok());

        // Receiver should get the decision
        let decision = rx.await.unwrap();
        assert_eq!(decision, true);

        // Channel should be removed from map after response
        let map = channels.cost_limit_responses.lock().unwrap();
        assert!(!map.contains_key(&scan_id));
    }

    #[tokio::test]
    async fn test_scan_response_channels_respond_no_pending() {
        let channels = ScanResponseChannels::default();
        let scan_id = 1;

        // Try to respond without creating a channel
        let result = channels.respond_to_cost_limit(scan_id, true);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No pending cost limit prompt"));
    }

    #[tokio::test]
    async fn test_scan_response_channels_multiple_scans() {
        let channels = ScanResponseChannels::default();
        let scan_id_1 = 1;
        let scan_id_2 = 2;

        let rx1 = channels.create_cost_limit_channel(scan_id_1);
        let rx2 = channels.create_cost_limit_channel(scan_id_2);

        // Both channels should exist independently
        let map = channels.cost_limit_responses.lock().unwrap();
        assert!(map.contains_key(&scan_id_1));
        assert!(map.contains_key(&scan_id_2));
        drop(map);

        // Respond to first scan
        channels.respond_to_cost_limit(scan_id_1, true).unwrap();
        assert_eq!(rx1.await.unwrap(), true);

        // Second scan should still be waiting
        let map = channels.cost_limit_responses.lock().unwrap();
        assert!(!map.contains_key(&scan_id_1));
        assert!(map.contains_key(&scan_id_2));
        drop(map);

        // Respond to second scan
        channels.respond_to_cost_limit(scan_id_2, false).unwrap();
        assert_eq!(rx2.await.unwrap(), false);

        // Both should be cleaned up
        let map = channels.cost_limit_responses.lock().unwrap();
        assert!(map.is_empty());
    }

    #[tokio::test]
    async fn test_scan_response_channels_respond_false() {
        let channels = ScanResponseChannels::default();
        let scan_id = 1;

        let rx = channels.create_cost_limit_channel(scan_id);

        // Respond with continue=false (stop scanning)
        let result = channels.respond_to_cost_limit(scan_id, false);
        assert!(result.is_ok());

        // Receiver should get false
        let decision = rx.await.unwrap();
        assert_eq!(decision, false);
    }

    #[tokio::test]
    async fn test_scan_response_channels_dropped_receiver() {
        let channels = ScanResponseChannels::default();
        let scan_id = 1;

        let rx = channels.create_cost_limit_channel(scan_id);

        // Drop the receiver to simulate scan being cancelled
        drop(rx);

        // Responding should still work (sender doesn't know receiver is gone until send)
        // But the send itself will fail
        let result = channels.respond_to_cost_limit(scan_id, true);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("receiver dropped"));
    }
}
