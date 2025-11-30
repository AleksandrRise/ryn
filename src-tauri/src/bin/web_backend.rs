use axum::{routing::post, Json, Router};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::SocketAddr;

use ryn::commands::{
    analytics,
    audit,
    fix,
    logger,
    project,
    scan,
    settings,
    violation,
};
use ryn::db;

#[derive(Debug, Deserialize)]
struct InvokeRequest {
    command: String,
    #[serde(default)]
    args: Value,
}

#[derive(Debug, Serialize)]
struct InvokeResponse<T> {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tokio::main]
async fn main() {
    // Initialize env and database similarly to Tauri main
    if let Err(e) = ryn::utils::env::load_env() {
        eprintln!("[ryn-web] WARNING: failed to load .env: {e}");
    }

    if let Err(e) = db::init_db() {
        eprintln!("[ryn-web] FATAL: failed to init db: {e}");
        std::process::exit(1);
    }

    let app = Router::new().route("/api/tauri", post(handle_invoke));

    let port: u16 = std::env::var("RYN_WEB_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4317);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("[ryn-web] listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind listener");

    axum::serve(listener, app.into_make_service())
        .await
        .expect("server error");
}

async fn handle_invoke(Json(req): Json<InvokeRequest>) -> (StatusCode, Json<Value>) {
    let res = match req.command.as_str() {
        // Project commands
        "create_project" => {
            let path = req.args.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
            let name = req.args.get("name").and_then(Value::as_str).map(|s| s.to_string());
            let framework = req.args.get("framework").and_then(Value::as_str).map(|s| s.to_string());
            wrap_result(project::create_project(path, name, framework).await)
        }
        "get_projects" => wrap_result(project::get_projects().await),
        "delete_project" => {
            let id = req
                .args
                .get("projectId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_unit(project::delete_project(id).await)
        }
        "delete_all_projects" => wrap_unit(project::delete_all_projects().await),
        "read_file_content" => {
            let path = req
                .args
                .get("filePath")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            wrap_result(project::read_file_content(path).await)
        }

        // Scan commands (HTTP variant uses scan_project_http)
        "detect_framework" => {
            let path = req.args.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
            wrap_result(scan::detect_framework(path).await)
        }
        "scan_project" => {
            let project_id = req
                .args
                .get("projectId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(scan::scan_project_http(project_id).await)
        }
        "get_scan_progress" => {
            let scan_id = req
                .args
                .get("scanId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(scan::get_scan_progress(scan_id).await)
        }
        "get_scans" => {
            let project_id = req
                .args
                .get("projectId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(scan::get_scans(project_id).await)
        }
        // Cost limit / cancel are no-ops in HTTP mode
        "respond_to_cost_limit" => ok_empty(),
        "cancel_scan" => ok_empty(),
        "watch_project" => ok_msg("watch_project not supported in web backend"),
        "stop_watching" => ok_msg("stop_watching not supported in web backend"),

        // Violation commands
        "get_violations" => {
            let scan_id = req
                .args
                .get("scanId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let filters = req.args.get("filters");
            let filters: Option<violation::ViolationFilters> = filters
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok());
            wrap_result(violation::get_violations(scan_id, filters).await)
        }
        "get_violation" => {
            let id = req
                .args
                .get("violationId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(violation::get_violation(id).await)
        }
        "dismiss_violation" => {
            let id = req
                .args
                .get("violationId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_unit(violation::dismiss_violation(id).await)
        }

        // Fix commands
        "generate_fix" => {
            let id = req
                .args
                .get("violationId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(fix::generate_fix(id).await)
        }
        "apply_fix" => {
            let id = req
                .args
                .get("fixId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(fix::apply_fix(id).await)
        }

        // Audit commands
        "get_audit_events" => {
            let filters = req.args.get("filters");
            let filters: Option<audit::AuditFilters> = filters
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok());
            wrap_result(audit::get_audit_events(filters).await)
        }

        // Settings
        "get_settings" => wrap_result(settings::get_settings().await),
        "update_settings" => {
            let key = req
                .args
                .get("key")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let value = req
                .args
                .get("value")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            wrap_unit(settings::update_settings(key, value).await)
        }
        "clear_database" => wrap_result(settings::clear_database().await),
        "export_data" => wrap_result(settings::export_data().await),
        "complete_onboarding" => {
            let mode = req
                .args
                .get("scanMode")
                .and_then(Value::as_str)
                .unwrap_or("regex_only")
                .to_string();
            let cost = req
                .args
                .get("costLimit")
                .and_then(Value::as_f64)
                .unwrap_or(5.0);
            wrap_unit(settings::complete_onboarding(mode, cost).await)
        }

        // Analytics
        "get_scan_costs" => {
            let tr = req
                .args
                .get("timeRange")
                .and_then(Value::as_str)
                .unwrap_or("all");
            let parsed: Result<analytics::TimeRange, _> = serde_json::from_str(&format!("\"{}\"", tr));
            let tr = parsed.unwrap_or(analytics::TimeRange::All);
            wrap_result(analytics::get_scan_costs(tr).await)
        }
        "get_scan_cost" => {
            let id = req
                .args
                .get("scanId")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            wrap_result(analytics::get_scan_cost(id).await)
        }

        // Logger
        "log_frontend_message" => {
            let level = req
                .args
                .get("level")
                .and_then(Value::as_str)
                .unwrap_or("log")
                .to_string();
            let message = req
                .args
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let _ = logger::log_frontend_message(level, message);
            ok_empty()
        }

        // GitHub-related commands are intentionally unsupported in web backend
        "start_github_oauth"
        | "poll_github_oauth"
        | "check_github_connection"
        | "disconnect_github"
        | "fetch_github_repos"
        | "get_github_repos"
        | "track_repo"
        | "untrack_repo"
        | "get_tracked_repos"
        | "check_repo_for_changes"
        | "check_repos_for_changes_batch"
        | "scan_github_repo" => err("GitHub commands are not supported in web backend"),

        _ => err("Unknown command"),
    };

    let status = if res.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(res))
}

fn wrap_result<T: Serialize>(res: Result<T, String>) -> Value {
    match res {
        Ok(v) => serde_json::to_value(InvokeResponse {
            ok: true,
            result: Some(v),
            error: None,
        })
        .unwrap(),
        Err(e) => serde_json::to_value(InvokeResponse::<()> {
            ok: false,
            result: None,
            error: Some(e),
        })
        .unwrap(),
    }
}

fn wrap_unit(res: Result<(), String>) -> Value {
    match res {
        Ok(()) => serde_json::to_value(InvokeResponse::<()> {
            ok: true,
            result: None,
            error: None,
        })
        .unwrap(),
        Err(e) => serde_json::to_value(InvokeResponse::<()> {
            ok: false,
            result: None,
            error: Some(e),
        })
        .unwrap(),
    }
}

fn ok_empty() -> Value {
    serde_json::to_value(InvokeResponse::<()> {
        ok: true,
        result: None,
        error: None,
    })
    .unwrap()
}

fn ok_msg(msg: &str) -> Value {
    serde_json::to_value(InvokeResponse::<String> {
        ok: true,
        result: Some(msg.to_string()),
        error: None,
    })
    .unwrap()
}

fn err(msg: &str) -> Value {
    serde_json::to_value(InvokeResponse::<()> {
        ok: false,
        result: None,
        error: Some(msg.to_string()),
    })
    .unwrap()
}
