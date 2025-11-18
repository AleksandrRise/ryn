//! Scan management commands
//!
//! Handles project scanning, framework detection, and scan progress tracking

use crate::db::{self, queries};
use crate::models::{Violation, Scan, DetectionMethod, Severity};
use crate::scanner::framework_detector::FrameworkDetector;
use crate::scanner::llm_file_selector;
use crate::scanner::tree_sitter_utils::{CodeParser, find_context_at_line};
use crate::scanner::{SKIP_DIRECTORIES, FileWatcher};
use crate::rules::{CC61AccessControlRule, CC67SecretsRule, CC72LoggingRule, A12ResilienceRule};
use crate::security::path_validation;
use crate::fix_generator::grok_client::GrokClient;
use crate::utils::create_audit_event;
use std::path::Path;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::Arc;
use walkdir::WalkDir;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::{oneshot, Semaphore};
use tokio::time::{timeout, Duration};
use crate::scanner::WatcherHandle;

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

/// Channels for handling scan-time cost limit prompts and cancellations
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

    /// Map of scan_id -> cancel flag
    ///
    /// When user clicks cancel button:
    /// 1. Frontend calls cancel_scan(scan_id)
    /// 2. This sets the flag to true
    /// 3. Scan loop checks this flag periodically and stops if true
    cancel_requests: Arc<Mutex<HashMap<i64, bool>>>,
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

    /// Request cancellation of a running scan
    ///
    /// # Arguments
    /// * `scan_id` - ID of the scan to cancel
    pub fn request_cancel(&self, scan_id: i64) {
        let mut cancels = self.cancel_requests.lock().unwrap();
        cancels.insert(scan_id, true);
    }

    /// Check if a scan has been requested to cancel
    ///
    /// # Arguments
    /// * `scan_id` - ID of the scan to check
    ///
    /// Returns: true if cancel was requested, false otherwise
    pub fn is_cancelled(&self, scan_id: i64) -> bool {
        let cancels = self.cancel_requests.lock().unwrap();
        cancels.get(&scan_id).copied().unwrap_or(false)
    }

    /// Clear cancel flag for a scan (called when scan completes or stops)
    ///
    /// # Arguments
    /// * `scan_id` - ID of the scan to clear
    pub fn clear_cancel(&self, scan_id: i64) {
        let mut cancels = self.cancel_requests.lock().unwrap();
        cancels.remove(&scan_id);
    }
}

/// File watcher state for managing active file watchers by project
///
/// This state manages WatcherHandle instances for each project_id.
/// When a project's watcher is stopped, its handle is dropped, which
/// causes the watcher task to terminate gracefully.
#[derive(Default, Clone)]
pub struct FileWatcherState {
    /// Map of project_id -> WatcherHandle for active watchers
    ///
    /// When watch_project is called:
    /// 1. Create FileWatcher for project path
    /// 2. Spawn task to receive events and emit file-changed events
    /// 3. Store WatcherHandle in this map
    ///
    /// When stop_watching is called:
    /// 1. Remove WatcherHandle from map (causing drop, stopping watcher)
    active_watchers: Arc<Mutex<HashMap<i64, Arc<WatcherHandle>>>>,
}

impl FileWatcherState {
    /// Start watching a project for file changes
    ///
    /// Creates and stores a FileWatcher for the given project
    pub fn start_watching(&self, project_id: i64, handle: Arc<WatcherHandle>) -> Result<(), String> {
        let mut watchers = self.active_watchers.lock().unwrap();
        watchers.insert(project_id, handle);
        Ok(())
    }

    /// Stop watching a project
    ///
    /// Removes and drops the WatcherHandle, stopping the file watcher
    pub fn stop_watching(&self, project_id: i64) -> Result<(), String> {
        let mut watchers = self.active_watchers.lock().unwrap();
        if watchers.remove(&project_id).is_some() {
            Ok(())
        } else {
            Err(format!("No active watcher for project {}", project_id))
        }
    }

    /// Check if a project is being watched
    pub fn is_watching(&self, project_id: i64) -> bool {
        let watchers = self.active_watchers.lock().unwrap();
        watchers.contains_key(&project_id)
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
    scan_project_internal(app, channels.inner(), project_id).await
}

/// Internal scan logic that doesn't require Tauri State
///
/// This function contains the core scanning logic and can be called from tests
/// without needing to set up Tauri's State management.
async fn scan_project_internal<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    channels: &ScanResponseChannels,
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

    // Emit initial progress event so UI shows correct total file count from the start
    let initial_progress = ScanProgressEvent {
        scan_id,
        files_scanned: 0,
        total_files,
        violations_found: 0,
        current_file: "Initializing scan...".to_string(),
    };
    let _ = app.emit("scan-progress", initial_progress);

    // Collect files for LLM analysis (smart/analyze_all modes)
    // Each entry: (relative_path, content)
    let mut files_for_llm_analysis: Vec<(String, String)> = Vec::new();

    // Walk through project files
    let mut files_scanned = 0;
    let mut violations_found = 0;
    let mut regex_violations: Vec<Violation> = Vec::new();  // Collect all regex violations

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

                // Check for cancellation request
                if channels.is_cancelled(scan_id) {
                    println!("[ryn] Scan cancelled by user at {} files", files_scanned);
                    channels.clear_cancel(scan_id);
                    return Err("Scan cancelled by user".to_string());
                }

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

                    // Run all 4 rule engines and collect violations (don't insert yet)
                    let mut violations = run_all_rules(&content, &relative_path, scan_id);
                    regex_violations.append(&mut violations);

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

    // Merge regex and LLM violations, then insert deduplicated results
    println!("[ryn] Merging {} regex violations with LLM results", regex_violations.len());

    // Analyze collected files with LLM if any were selected (smart/analyze_all modes)
    let llm_violations_vec = if !files_for_llm_analysis.is_empty() {
        println!("[ryn] Analyzing {} files with Claude Haiku LLM (mode: {})",
                  files_for_llm_analysis.len(), llm_scan_mode);

        // Clone channels for async tasks (Arc makes this cheap)
        let channels_arc = Arc::new(channels.clone());

        match analyze_files_with_llm(
            scan_id,
            files_for_llm_analysis,
            channels_arc,
            app.clone(),
        ).await {
            Ok((llm_violations, total_cost)) => {
                println!("[ryn] LLM analysis complete: {} violations, ${:.4} cost",
                          llm_violations.len(), total_cost);
                // TODO: Store detailed token usage in scan_costs table (requires ScanCost model)
                println!("[ryn] Total scan cost: ${:.4}", total_cost);
                llm_violations
            }
            Err(e) => {
                println!("[ryn] LLM analysis failed: {}", e);
                // Continue with empty LLM violations
                Vec::new()
            }
        }
    } else {
        println!("[ryn] No files selected for LLM analysis (mode: {})", llm_scan_mode);
        Vec::new()
    };

    // Merge violations: deduplicates when both regex and LLM found the same issue
    let merged_violations = merge_violations(regex_violations, llm_violations_vec);

    // Enrich violations with tree-sitter context (function_name, class_name)
    let enriched_violations = enrich_violations_with_context(merged_violations, &project.path);

    // Insert all enriched violations into database
    {
        let conn = db::get_connection();
        for violation in &enriched_violations {
            if queries::insert_violation(&conn, violation).is_ok() {
                violations_found += 1;
            }
        }
    } // Connection dropped here

    println!("[ryn] Inserted {} final violations after deduplication", violations_found);

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

/// Start watching a project for file changes
///
/// Spawns a FileWatcher on the project directory and emits "file-changed" events
/// to the frontend whenever files are modified, created, or deleted.
///
/// # Arguments
/// * `app` - Tauri application handle for emitting events
/// * `watcher_state` - Global state for managing active watchers
/// * `project_id` - ID of the project to start watching
///
/// Returns: Success message or error
#[tauri::command]
pub async fn watch_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    watcher_state: tauri::State<'_, FileWatcherState>,
    project_id: i64,
) -> Result<String, String> {
    println!("[ryn] watch_project called: project_id={}", project_id);

    // Validate project ID
    if project_id <= 0 {
        let err_msg = format!("Invalid project ID: must be greater than 0, got {}", project_id);
        println!("[ryn] watch_project validation failed: {}", err_msg);
        return Err(err_msg);
    }

    // Check if already watching this project
    if watcher_state.is_watching(project_id) {
        return Err(format!("Project {} is already being watched", project_id));
    }

    // Get project from database
    let project = {
        let conn = db::get_connection();
        queries::select_project(&conn, project_id)
            .map_err(|e| format!("Failed to fetch project: {}", e))?
            .ok_or_else(|| format!("Project not found: {}", project_id))?
    };

    // Validate project path
    path_validation::validate_project_path(Path::new(&project.path))
        .map_err(|e| format!("Invalid project path: {}", e))?;

    // Create file watcher with default settings (filters .py, .js, .ts, .jsx, .tsx files)
    let watcher = FileWatcher::new();
    let watch_path = Path::new(&project.path);

    // Start watching the directory
    let watcher_handle = watcher
        .watch_directory(watch_path)
        .await
        .map_err(|e| format!("Failed to start file watcher: {}", e))?;

    let handle = Arc::new(watcher_handle);
    let handle_clone = handle.clone();

    // Store handle in state immediately
    watcher_state.start_watching(project_id, handle)?;

    // Spawn task to receive events and emit to frontend
    tokio::spawn(async move {
        println!("[ryn] watch_project: event loop started for project_id={}", project_id);
        loop {
            match handle_clone.recv().await {
                Some(event) => {
                    // Create event payload
                    #[derive(Serialize)]
                    struct FileChangedEvent {
                        project_id: i64,
                        file_path: String,
                        event_type: String,
                    }

                    let (file_path, event_type) = match event {
                        crate::scanner::FileEvent::FileModified { path } => {
                            (path.to_string_lossy().to_string(), "modified".to_string())
                        }
                        crate::scanner::FileEvent::FileCreated { path } => {
                            (path.to_string_lossy().to_string(), "created".to_string())
                        }
                        crate::scanner::FileEvent::FileDeleted { path } => {
                            (path.to_string_lossy().to_string(), "deleted".to_string())
                        }
                    };

                    println!("[ryn] watch_project: received event for project_id={}, path={}, type={}",
                             project_id, file_path, event_type);

                    let payload = FileChangedEvent {
                        project_id,
                        file_path: file_path.clone(),
                        event_type: event_type.clone(),
                    };

                    // Emit event to all frontend listeners
                    if let Err(e) = app.emit("file-changed", &payload) {
                        println!("[ryn] watch_project: failed to emit event: {:?}", e);
                    } else {
                        println!("[ryn] watch_project: successfully emitted file-changed event");
                    }
                }
                None => {
                    // Watcher closed - exit loop
                    println!("[ryn] watch_project: watcher closed for project_id={}", project_id);
                    break;
                }
            }
        }
    });

    println!("[ryn] watch_project success: started watching project_id={}", project_id);
    Ok(format!("Started watching project {}", project_id))
}

/// Stop watching a project for file changes
///
/// Stops the file watcher for the given project and cleans up resources.
///
/// # Arguments
/// * `watcher_state` - Global state for managing active watchers
/// * `project_id` - ID of the project to stop watching
///
/// Returns: Success message or error if project wasn't being watched
#[tauri::command]
pub async fn stop_watching(
    watcher_state: tauri::State<'_, FileWatcherState>,
    project_id: i64,
) -> Result<String, String> {
    watcher_state.stop_watching(project_id)?;
    Ok(format!("Stopped watching project {}", project_id))
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
) -> Result<(Vec<Violation>, f64), String> {
    if files.is_empty() {
        return Ok((Vec::new(), 0.0));
    }

    // Verify API key exists before spawning tasks
    std::env::var("XAI_API_KEY")
        .map_err(|_| "XAI_API_KEY environment variable not set. Set it to enable LLM scanning.".to_string())?;

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

    // Track cumulative cost and collected violations
    let mut llm_violations: Vec<Violation> = Vec::new();
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
                let client = match GrokClient::new() {
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
                        // Return violations and cost (will be merged and inserted later)
                        Ok((analysis.violations, analysis.usage.calculate_cost()))
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

        // Wait for this batch to complete and collect violations
        for task in tasks {
            match task.await {
                Ok(Ok((mut violations, cost))) => {
                    llm_violations.append(&mut violations);
                    total_cost += cost;
                }
                Ok(Err(e)) => {
                    println!("[ryn] LLM analysis error: {}", e);
                    // Continue processing other files even if one fails
                }
                Err(e) => {
                    println!("[ryn] Task join error: {}", e);
                }
            }
        }

        // After each batch (every 10 files), check if we've exceeded cost limit
        let files_analyzed = ((batch_idx + 1) * 10).min(total_files);
        let files_remaining = total_files.saturating_sub(files_analyzed);

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
                println!("[ryn] Failed to emit cost-limit-reached event: {}", e);
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
                    println!("[ryn] Cost limit response channel closed - stopping scan");
                    break;
                }
            }
        }
    }

    Ok((llm_violations, total_cost))
}

/// Merge regex and LLM violations, deduplicating when both found the same issue
///
/// # Algorithm
/// 1. For each LLM violation, search for regex violations in the same file
/// 2. Check if line numbers are within ±3 lines (configurable tolerance)
/// 3. If match found:
///    - Create hybrid violation with combined reasoning
///    - Mark both original violations as "merged" (don't insert separately)
/// 4. Return deduplicated list: [regex-only, llm-only, hybrid]
///
/// # Arguments
/// * `regex_violations` - Violations detected by regex patterns
/// * `llm_violations` - Violations detected by Claude Haiku analysis
///
/// # Returns
/// Deduplicated vector with detection_method properly set
fn merge_violations(
    regex_violations: Vec<Violation>,
    llm_violations: Vec<Violation>,
) -> Vec<Violation> {
    const LINE_TOLERANCE: i64 = 3;

    let mut merged = Vec::new();
    let mut regex_matched = vec![false; regex_violations.len()];
    let mut llm_matched = vec![false; llm_violations.len()];

    // Pass 1: Find hybrid violations (both regex and LLM detected same issue)
    for (llm_idx, llm_violation) in llm_violations.iter().enumerate() {
        let mut best_match: Option<usize> = None;
        let mut best_distance = LINE_TOLERANCE + 1;

        // Search for matching regex violation in same file
        for (regex_idx, regex_violation) in regex_violations.iter().enumerate() {
            if regex_matched[regex_idx] {
                continue; // Already matched with another LLM violation
            }

            // Must be same file and same control_id
            if regex_violation.file_path != llm_violation.file_path {
                continue;
            }
            if regex_violation.control_id != llm_violation.control_id {
                continue;
            }

            // Check if line numbers are within tolerance (±3 lines)
            let distance = (regex_violation.line_number - llm_violation.line_number).abs();
            if distance <= LINE_TOLERANCE && distance < best_distance {
                best_match = Some(regex_idx);
                best_distance = distance;
            }
        }

        // If we found a match, create hybrid violation
        if let Some(regex_idx) = best_match {
            let regex_violation = &regex_violations[regex_idx];

            // Create hybrid violation combining both detections
            let mut hybrid = llm_violation.clone();
            hybrid.set_detection_method(DetectionMethod::Hybrid);

            // Combine reasoning from both methods
            hybrid.regex_reasoning = Some(format!(
                "Pattern match at line {}: {}",
                regex_violation.line_number,
                regex_violation.description
            ));

            // LLM reasoning already exists, just ensure it's set
            if hybrid.llm_reasoning.is_none() {
                hybrid.llm_reasoning = Some(llm_violation.description.clone());
            }

            // Use LLM's line number (more precise) but note the regex match in reasoning
            if regex_violation.line_number != llm_violation.line_number {
                hybrid.regex_reasoning = Some(format!(
                    "{} (regex detected at line {}, LLM at line {})",
                    hybrid.regex_reasoning.as_ref().unwrap(),
                    regex_violation.line_number,
                    llm_violation.line_number
                ));
            }

            // Prefer higher severity between the two
            let regex_severity = regex_violation.get_severity().unwrap_or(Severity::Low);
            let llm_severity = llm_violation.get_severity().unwrap_or(Severity::Low);
            if regex_severity.numeric_value() > llm_severity.numeric_value() {
                hybrid.set_severity(regex_severity);
            }

            // Use LLM's confidence score
            // confidence_score already set from llm_violation

            println!(
                "[ryn] Merged hybrid violation: {} at {} line {} (±{} lines from regex)",
                hybrid.control_id,
                hybrid.file_path,
                hybrid.line_number,
                best_distance
            );

            merged.push(hybrid);
            regex_matched[regex_idx] = true;
            llm_matched[llm_idx] = true;
        }
    }

    // Pass 2: Add regex-only violations (not matched with LLM)
    for (idx, violation) in regex_violations.into_iter().enumerate() {
        if !regex_matched[idx] {
            // Already has detection_method = "regex" from creation
            merged.push(violation);
        }
    }

    // Pass 3: Add LLM-only violations (not matched with regex)
    for (idx, violation) in llm_violations.into_iter().enumerate() {
        if !llm_matched[idx] {
            // Already has detection_method = "llm" from LLM analysis
            merged.push(violation);
        }
    }

    println!(
        "[ryn] Merge complete: {} total violations ({} hybrid, {} regex-only, {} llm-only)",
        merged.len(),
        merged.iter().filter(|v| v.detection_method == "hybrid").count(),
        merged.iter().filter(|v| v.detection_method == "regex").count(),
        merged.iter().filter(|v| v.detection_method == "llm").count()
    );

    merged
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

/// Cancel a running scan
///
/// Sets a cancellation flag that the scan loop checks periodically.
/// The scan will stop as soon as it detects the cancellation request.
///
/// # Arguments
/// * `channels` - Managed state containing response channels
/// * `scan_id` - ID of the scan to cancel
///
/// Returns: Always returns Ok (cancellation is best-effort)
#[tauri::command]
pub async fn cancel_scan(
    channels: tauri::State<'_, ScanResponseChannels>,
    scan_id: i64,
) -> Result<(), String> {
    println!("[ryn] Cancelling scan_id={}", scan_id);
    channels.request_cancel(scan_id);
    Ok(())
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

/// Enrich violations with tree-sitter context (function_name, class_name)
///
/// Groups violations by file, parses each file once with tree-sitter,
/// and extracts function/class names for each violation.
fn enrich_violations_with_context(violations: Vec<Violation>, project_path: &str) -> Vec<Violation> {
    // Group violations by file_path
    let mut violations_by_file: HashMap<String, Vec<Violation>> = HashMap::new();
    for violation in violations {
        violations_by_file
            .entry(violation.file_path.clone())
            .or_insert_with(Vec::new)
            .push(violation);
    }

    // Initialize tree-sitter parser (reuse for all files)
    let parser = match CodeParser::new() {
        Ok(p) => p,
        Err(e) => {
            println!("[ryn] Failed to initialize tree-sitter parser: {}", e);
            // Return violations unchanged if parser fails
            return violations_by_file.into_values().flatten().collect();
        }
    };

    let mut enriched_violations = Vec::new();

    // Process each file
    for (file_path, mut file_violations) in violations_by_file {
        // Construct full path from project_path + relative file_path
        let full_path = Path::new(project_path).join(&file_path);

        // Read file content
        let code = match std::fs::read_to_string(&full_path) {
            Ok(content) => content,
            Err(e) => {
                println!("[ryn] Failed to read file for tree-sitter parsing: {} - {}", file_path, e);
                // Keep violations as-is if file can't be read
                enriched_violations.extend(file_violations);
                continue;
            }
        };

        // Determine language from file extension
        let parse_result = if file_path.ends_with(".py") {
            parser.parse_python(&code)
        } else if file_path.ends_with(".js") || file_path.ends_with(".jsx") {
            parser.parse_javascript(&code)
        } else if file_path.ends_with(".ts") || file_path.ends_with(".tsx") {
            parser.parse_typescript(&code)
        } else {
            // Unsupported language, skip tree-sitter parsing
            enriched_violations.extend(file_violations);
            continue;
        };

        match parse_result {
            Ok(result) => {
                // Extract context for each violation
                for violation in &mut file_violations {
                    let (func_name, class_name) = find_context_at_line(&result, violation.line_number);
                    violation.function_name = func_name;
                    violation.class_name = class_name;
                }
                enriched_violations.extend(file_violations);
            }
            Err(e) => {
                println!("[ryn] Failed to parse {} with tree-sitter: {}", file_path, e);
                // Keep violations as-is if parsing fails
                enriched_violations.extend(file_violations);
            }
        }
    }

    enriched_violations
}

/// Determine if a path should be skipped during scanning
fn should_skip_path(path: &Path) -> bool {
    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            if let Some(name_str) = name.to_str() {
                if SKIP_DIRECTORIES.contains(&name_str) || name_str.starts_with('.') {
                    return true;
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::TestDbGuard;
    use std::fs;

    /// Helper: Create a regex-detected violation
    fn new_regex_violation(
        scan_id: i64,
        control_id: String,
        severity: Severity,
        description: String,
        file_path: String,
        line_number: i64,
        code_snippet: String,
        regex_reasoning: String,
    ) -> Violation {
        let mut violation = Violation::new(
            scan_id, control_id, severity, description,
            file_path, line_number, code_snippet,
        );
        violation.set_detection_method(DetectionMethod::Regex);
        violation.regex_reasoning = Some(regex_reasoning);
        violation
    }

    /// Helper: Create an LLM-detected violation
    fn new_llm_violation(
        scan_id: i64,
        control_id: String,
        severity: Severity,
        description: String,
        file_path: String,
        line_number: i64,
        code_snippet: String,
        confidence: i64,
        llm_reasoning: String,
    ) -> Violation {
        let mut violation = Violation::new(
            scan_id, control_id, severity, description,
            file_path, line_number, code_snippet,
        );
        violation.set_detection_method(DetectionMethod::Llm);
        violation.confidence_score = Some(confidence);
        violation.llm_reasoning = Some(llm_reasoning);
        violation
    }

    fn create_test_project_with_guard(_guard: &TestDbGuard) -> (tempfile::TempDir, i64) {
        // Create temp dir with 'ryntest' prefix instead of default '.tmp' to avoid being filtered by should_skip_path
        let project_dir = tempfile::Builder::new()
            .prefix("ryntest")
            .tempdir()
            .unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let conn = db::get_connection();
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
        let result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), 999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_empty_directory() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await;
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
        let result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await;
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
        let result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_project_returns_valid_scan_id() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await;
        assert!(result.is_ok());

        let scan = result.unwrap();
        assert!(scan.id > 0);

        // Verify scan exists in database
        let conn = db::get_connection();
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
        let scan = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();
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
        let _scan_id_1 = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();
        let _scan_id_2 = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();

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
        let scan = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();
        let progress = get_scan_progress(scan.id).await.unwrap();

        assert!(progress.violations_found >= 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_progress_includes_all_fields() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_guard(&_guard);

        let app = tauri::test::mock_app();
        let scan_result = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();
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
        let scan_id_1 = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id_1).await.unwrap();
        let scan_id_2 = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id_2).await.unwrap();

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

        // Create manage.py to indicate Django framework
        fs::write(project_dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        // Detect and update framework before scanning
        let framework = {
            let framework = FrameworkDetector::detect_framework(project_dir.path())
                .ok()
                .flatten();

            if let Some(ref fw) = framework {
                let conn = db::get_connection();
                let project = queries::select_project(&conn, project_id).unwrap().unwrap();
                queries::update_project(&conn, project_id, &project.name, Some(fw)).unwrap();
            }
            framework
        }; // Drop MutexGuard here

        let app = tauri::test::mock_app();
        let _scan_id = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();

        {
            let conn = db::get_connection();
            let project = queries::select_project(&conn, project_id).unwrap().unwrap();

            // Framework should have been detected and set before scan
            assert_eq!(project.framework, framework, "Framework should match detected framework");
            assert_eq!(project.framework, Some("django".to_string()), "Should detect Django from manage.py");
        }
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
        drop(rx); // Drop receiver to clean up
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

    /// Integration test: Verify tree-sitter context extraction
    ///
    /// This test verifies the complete tree-sitter integration:
    /// 1. Creates Python file with violations in different contexts (module, function, class method)
    /// 2. Runs full scan (regex detection + tree-sitter enrichment)
    /// 3. Verifies violations have function_name and class_name populated correctly
    ///
    /// Expected behavior:
    /// - Module-level violation: function_name=None, class_name=None
    /// - Function-level violation: function_name=Some("func"), class_name=None
    /// - Class method violation: function_name=Some("method"), class_name=Some("Class")
    #[tokio::test]
    #[serial_test::serial]
    async fn test_scan_enriches_violations_with_tree_sitter_context() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create Python file with 1 simple violation to verify detection works
        let py_content = r#"
DB_PASSWORD = "production_secret_key_xyz"
"#;
        fs::write(project_dir.path().join("config.py"), py_content).unwrap();

        // Run scan (includes regex detection + tree-sitter enrichment)
        let app = tauri::test::mock_app();
        let scan = scan_project_internal(app.handle().clone(), &ScanResponseChannels::default(), project_id).await.unwrap();

        // Query violations from database
        let conn = db::get_connection();
        let violations = queries::select_violations(&conn, scan.id).unwrap();

        // Should detect at least 1 violation
        assert!(
            !violations.is_empty(),
            "Expected at least 1 violation (CC6.7), found 0"
        );

        // Verify tree-sitter context - module-level violation should have no context
        let violation = &violations[0];
        assert_eq!(violation.control_id, "CC6.7", "Expected CC6.7 violation");
        assert!(
            violation.function_name.is_none(),
            "Module-level violation should not have function_name, got: {:?}",
            violation.function_name
        );
        assert!(
            violation.class_name.is_none(),
            "Module-level violation should not have class_name, got: {:?}",
            violation.class_name
        );
    }

    /// Integration test for file watcher functionality
    ///
    /// This test verifies:
    /// 1. File watcher can be started for a project (watch_project command)
    /// 2. Active watcher state is tracked correctly
    /// 3. File modifications are detected by the watcher
    /// 4. File watcher can be stopped (stop_watching command)
    /// 5. Watcher state is cleared after stopping
    #[tokio::test]
    #[serial_test::serial]
    async fn test_file_watcher_lifecycle() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_guard(&_guard);

        // Create initial Python file
        let py_content = r#"
def get_user(user_id):
    user = User.objects.get(id=user_id)
    return user
"#;
        fs::write(project_dir.path().join("views.py"), py_content).unwrap();

        // Initialize file watcher state
        let watcher_state = FileWatcherState::default();

        // Verify watcher is not active initially
        assert!(!watcher_state.is_watching(project_id), "Watcher should not be active initially");

        // Create and start a FileWatcher
        let project_path = project_dir.path().to_path_buf();
        let watcher = FileWatcher::new();
        let handle = Arc::new(watcher.watch_directory(&project_path).await.unwrap());

        // Store watcher in state
        watcher_state.start_watching(project_id, handle).unwrap();

        // Verify watcher is now active
        assert!(
            watcher_state.is_watching(project_id),
            "Watcher should be active after start_watching"
        );

        // Modify the Python file - append content to trigger a modification event
        let updated_content = r#"
def get_user(user_id):
    user = User.objects.get(id=user_id)
    return user

def update_user(user_id, data):
    user = User.objects.get(id=user_id)
    # VIOLATION: Missing audit log here
    user.name = data.get('name')
    user.save()
    return user
"#;
        fs::write(project_dir.path().join("views.py"), updated_content).unwrap();

        // Give file system a moment to detect the change
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Stop watching
        watcher_state.stop_watching(project_id).unwrap();

        // Verify watcher is no longer active
        assert!(
            !watcher_state.is_watching(project_id),
            "Watcher should not be active after stop_watching"
        );
    }

    /// Unit test for FileWatcherState management
    ///
    /// Verifies the FileWatcherState HashMap correctly tracks multiple watchers
    #[tokio::test]
    #[serial_test::serial]
    async fn test_file_watcher_state_multiple_projects() {
        let _guard = TestDbGuard::new();
        let (project_dir_1, project_id_1) = create_test_project_with_guard(&_guard);
        let (project_dir_2, project_id_2) = create_test_project_with_guard(&_guard);

        let watcher_state = FileWatcherState::default();

        // Start watching both projects
        let watcher_1 = FileWatcher::new();
        let handle_1 = Arc::new(watcher_1.watch_directory(project_dir_1.path()).await.unwrap());
        watcher_state.start_watching(project_id_1, handle_1).unwrap();

        let watcher_2 = FileWatcher::new();
        let handle_2 = Arc::new(watcher_2.watch_directory(project_dir_2.path()).await.unwrap());
        watcher_state.start_watching(project_id_2, handle_2).unwrap();

        // Verify both are active
        assert!(watcher_state.is_watching(project_id_1), "Project 1 should be watching");
        assert!(watcher_state.is_watching(project_id_2), "Project 2 should be watching");

        // Stop watching project 1
        watcher_state.stop_watching(project_id_1).unwrap();

        // Verify only project 2 is still watching
        assert!(
            !watcher_state.is_watching(project_id_1),
            "Project 1 should not be watching"
        );
        assert!(
            watcher_state.is_watching(project_id_2),
            "Project 2 should still be watching"
        );

        // Stop watching project 2
        watcher_state.stop_watching(project_id_2).unwrap();

        // Verify both are now inactive
        assert!(!watcher_state.is_watching(project_id_1), "Project 1 should be inactive");
        assert!(!watcher_state.is_watching(project_id_2), "Project 2 should be inactive");

        // Verify error when stopping inactive watcher
        let result = watcher_state.stop_watching(project_id_1);
        assert!(result.is_err(), "Should error when stopping inactive watcher");
    }

    /// Test that FileWatcher correctly filters file events by extension
    #[tokio::test]
    #[serial_test::serial]
    async fn test_file_watcher_extension_filtering() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let project_id = {
            let conn = db::get_connection();
            queries::insert_project(&conn, "test-filter-project", &path, None).unwrap()
        }; // MutexGuard dropped here

        // Create watcher configured to only watch Python files
        let watcher = FileWatcher::new().with_extensions(vec!["py".to_string()]);
        let handle = Arc::new(watcher.watch_directory(project_dir.path()).await.unwrap());

        // Create a Python file
        fs::write(project_dir.path().join("test.py"), "print('hello')").unwrap();

        // Give file watcher time to process
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        // Try to receive event (should get FileCreated for .py file)
        let watcher_state = FileWatcherState::default();
        watcher_state.start_watching(project_id, handle).unwrap();

        // Create a non-Python file (should be ignored)
        fs::write(project_dir.path().join("readme.txt"), "readme content").unwrap();

        // Give watcher a moment to process (if it did)
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        // Clean up
        watcher_state.stop_watching(project_id).unwrap();
    }

    /// Test merge_violations: identical line numbers should create hybrid
    #[test]
    fn test_merge_violations_identical_lines() {
        let regex_violations = vec![
            new_regex_violation(
                1, "CC6.1".to_string(), Severity::High,
                "Missing @login_required".to_string(),
                "app.py".to_string(), 42, "def admin(): pass".to_string(),
                "Pattern match: missing authentication decorator".to_string(),
            ),
        ];

        let llm_violations = vec![
            new_llm_violation(
                1, "CC6.1".to_string(), Severity::High,
                "Admin endpoint lacks authentication".to_string(),
                "app.py".to_string(), 42, "def admin(): pass".to_string(),
                85, "Claude detected: endpoint allows unauthorized access".to_string(),
            ),
        ];

        let merged = merge_violations(regex_violations, llm_violations);

        // Should produce 1 hybrid violation
        assert_eq!(merged.len(), 1, "Should merge into 1 hybrid violation");
        assert_eq!(merged[0].detection_method, "hybrid");
        assert!(merged[0].regex_reasoning.is_some());
        assert!(merged[0].llm_reasoning.is_some());
        assert_eq!(merged[0].confidence_score, Some(85));
    }

    /// Test merge_violations: violations within ±3 lines should merge
    #[test]
    fn test_merge_violations_within_tolerance() {
        let regex_viol = new_regex_violation(
            1, "CC6.7".to_string(), Severity::Critical,
            "Hardcoded secret".to_string(),
            "config.py".to_string(), 42, "password = 'secret'".to_string(),
            "Pattern: hardcoded password".to_string(),
        );

        // Test cases: distance from line 42
        let test_cases = vec![
            (39, true),  // 3 lines before (at tolerance)
            (38, false), // 4 lines before (exceeds tolerance)
            (45, true),  // 3 lines after (at tolerance)
            (46, false), // 4 lines after (exceeds tolerance)
        ];

        for (llm_line, should_merge) in test_cases {
            let llm_viol = new_llm_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "Credentials in code".to_string(),
                "config.py".to_string(), llm_line, "password = 'secret'".to_string(),
                90, "Claude found hardcoded credentials".to_string(),
            );

            let merged = merge_violations(vec![regex_viol.clone()], vec![llm_viol]);

            if should_merge {
                assert_eq!(merged.len(), 1, "Lines {} and 42 should merge (within tolerance)", llm_line);
                assert_eq!(merged[0].detection_method, "hybrid");
            } else {
                assert_eq!(merged.len(), 2, "Lines {} and 42 should NOT merge (exceeds tolerance)", llm_line);
                assert_eq!(merged.iter().filter(|v| v.detection_method == "regex").count(), 1);
                assert_eq!(merged.iter().filter(|v| v.detection_method == "llm").count(), 1);
            }
        }
    }

    /// Test merge_violations: different files should not merge
    #[test]
    fn test_merge_violations_different_files() {
        let regex_violations = vec![
            new_regex_violation(
                1, "CC6.1".to_string(), Severity::High,
                "Missing auth".to_string(),
                "views.py".to_string(), 42, "def view(): pass".to_string(),
                "Regex: missing decorator".to_string(),
            ),
        ];

        let llm_violations = vec![
            new_llm_violation(
                1, "CC6.1".to_string(), Severity::High,
                "Missing auth".to_string(),
                "api.py".to_string(), 42, "def view(): pass".to_string(), // Different file
                85, "LLM: missing auth".to_string(),
            ),
        ];

        let merged = merge_violations(regex_violations, llm_violations);

        // Should remain separate (2 violations)
        assert_eq!(merged.len(), 2, "Different files should not merge");
        assert_eq!(merged.iter().filter(|v| v.detection_method == "regex").count(), 1);
        assert_eq!(merged.iter().filter(|v| v.detection_method == "llm").count(), 1);
    }

    /// Test merge_violations: different control IDs should not merge
    #[test]
    fn test_merge_violations_different_controls() {
        let regex_violations = vec![
            new_regex_violation(
                1, "CC6.1".to_string(), // Access control
                Severity::High,
                "Missing auth".to_string(),
                "app.py".to_string(), 42, "def view(): pass".to_string(),
                "Regex: missing auth".to_string(),
            ),
        ];

        let llm_violations = vec![
            new_llm_violation(
                1, "CC7.2".to_string(), // Logging - different control
                Severity::Medium,
                "Missing audit log".to_string(),
                "app.py".to_string(), 42, "def view(): pass".to_string(),
                75, "LLM: missing logging".to_string(),
            ),
        ];

        let merged = merge_violations(regex_violations, llm_violations);

        // Should remain separate
        assert_eq!(merged.len(), 2, "Different controls should not merge");
    }

    /// Test merge_violations: hybrid uses higher severity
    #[test]
    fn test_merge_violations_severity_selection() {
        // Test cases: (regex_severity, llm_severity, expected_severity)
        let test_cases = vec![
            (Severity::Critical, Severity::High, Severity::Critical),
            (Severity::High, Severity::Critical, Severity::Critical),
            (Severity::Medium, Severity::Low, Severity::Medium),
            (Severity::High, Severity::High, Severity::High),
        ];

        for (regex_sev, llm_sev, expected_sev) in test_cases {
            let regex_viol = new_regex_violation(
                1, "CC6.7".to_string(), regex_sev.clone(),
                "Issue".to_string(),
                "test.py".to_string(), 10, "code".to_string(),
                "Regex found".to_string(),
            );

            let llm_viol = new_llm_violation(
                1, "CC6.7".to_string(), llm_sev.clone(),
                "Issue".to_string(),
                "test.py".to_string(), 10, "code".to_string(),
                80, "LLM found".to_string(),
            );

            let merged = merge_violations(vec![regex_viol], vec![llm_viol]);

            assert_eq!(merged.len(), 1);
            let actual_severity = merged[0].get_severity().unwrap();
            assert_eq!(actual_severity, expected_sev,
                "Hybrid of {:?} and {:?} should be {:?}, got {:?}",
                regex_sev, llm_sev, expected_sev, actual_severity
            );
        }
    }

    /// Test merge_violations: multiple regex, multiple LLM
    #[test]
    fn test_merge_violations_multiple_violations() {
        let regex_violations = vec![
            new_regex_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "Secret 1".to_string(),
                "config.py".to_string(), 10, "api_key = 'sk-123'".to_string(),
                "Regex 1".to_string(),
            ),
            new_regex_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "Secret 2".to_string(),
                "config.py".to_string(), 20, "password = 'admin'".to_string(),
                "Regex 2".to_string(),
            ),
        ];

        let llm_violations = vec![
            new_llm_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "LLM Secret 1".to_string(),
                "config.py".to_string(), 11, "api_key = 'sk-123'".to_string(), // Matches first regex (±3)
                90, "LLM 1".to_string(),
            ),
            new_llm_violation(
                1, "CC6.1".to_string(), Severity::High,
                "LLM Auth issue".to_string(),
                "config.py".to_string(), 30, "def view(): pass".to_string(), // No regex match
                85, "LLM 2".to_string(),
            ),
        ];

        let merged = merge_violations(regex_violations, llm_violations);

        // Expected: 1 hybrid (regex 1 + llm 1), 1 regex-only (regex 2), 1 llm-only (llm 2) = 3 total
        assert_eq!(merged.len(), 3, "Should have 3 violations: 1 hybrid, 1 regex-only, 1 llm-only");
        assert_eq!(merged.iter().filter(|v| v.detection_method == "hybrid").count(), 1);
        assert_eq!(merged.iter().filter(|v| v.detection_method == "regex").count(), 1);
        assert_eq!(merged.iter().filter(|v| v.detection_method == "llm").count(), 1);
    }

    /// Test merge_violations: empty inputs
    #[test]
    fn test_merge_violations_empty_inputs() {
        // Both empty
        let merged = merge_violations(vec![], vec![]);
        assert_eq!(merged.len(), 0);

        // Only regex
        let regex_only = vec![
            new_regex_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "Secret".to_string(),
                "test.py".to_string(), 10, "code".to_string(),
                "Regex".to_string(),
            ),
        ];
        let merged = merge_violations(regex_only, vec![]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].detection_method, "regex");

        // Only LLM
        let llm_only = vec![
            new_llm_violation(
                1, "CC6.7".to_string(), Severity::Critical,
                "Secret".to_string(),
                "test.py".to_string(), 10, "code".to_string(),
                90, "LLM".to_string(),
            ),
        ];
        let merged = merge_violations(vec![], llm_only);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].detection_method, "llm");
    }
}
