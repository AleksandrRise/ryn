use std::{collections::HashMap, path::PathBuf, time::Instant};

use ryn::{commands::scan, db, db::queries};
use tauri::Manager;

// Minimal CLI helper to run Ryn scans from the terminal for auditing.
// Usage: cargo run --manifest-path src-tauri/Cargo.toml --bin audit_scan -- <project_path> [mode...]
// Modes default to regex_only, smart, analyze_all when not provided.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env so XAI_API_KEY and other settings are available
    ryn::utils::env::load_env().ok();

    let mut args = std::env::args().skip(1);
    let project_path = PathBuf::from(args.next().expect("usage: audit_scan <project_path> [mode...]"));

    if !project_path.exists() {
        anyhow::bail!("project path does not exist: {}", project_path.display());
    }

    let modes: Vec<String> = args.collect();
    let modes = if modes.is_empty() {
        vec!["regex_only".into(), "smart".into(), "analyze_all".into()]
    } else {
        modes
    };

    // Keep audit data isolated from the desktop app's normal DB.
    let data_dir = std::env::var("RYN_DATA_DIR").unwrap_or_else(|_| "/tmp/ryn-audit-db".to_string());
    println!("Using RYN_DATA_DIR={}", data_dir);

    let data_dir_path = PathBuf::from(&data_dir);
    std::fs::create_dir_all(&data_dir_path)?;

    // Fresh DB for each run when using the default /tmp path.
    let db_file = data_dir_path.join("ryn.db");
    if db_file.exists() && data_dir.starts_with("/tmp/ryn-audit") {
        std::fs::remove_file(&db_file).ok();
    }

    db::init_db()?;

    let project_path_str = project_path.to_string_lossy().to_string();
    let project_id = {
        let conn = db::get_connection();
        if let Some(project) = queries::select_project_by_path(&conn, &project_path_str)? {
            project.id
        } else {
            queries::insert_project(&conn, "audit-target", &project_path_str, None)?
        }
    };

    // Build a lightweight Tauri app so scan_project can emit events.
    let app = tauri::Builder::default()
        .manage(scan::ScanResponseChannels::default())
        .manage(scan::FileWatcherState::default())
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");

    let channels_state = app.state::<scan::ScanResponseChannels>();

    for mode in modes {
        {
            let conn = db::get_connection();
            queries::insert_or_update_setting(&conn, "llm_scan_mode", &mode)?;
            // Raise cost ceiling so analyze_all doesn't pause early.
            queries::insert_or_update_setting(&conn, "cost_limit_per_scan", "25.00")?;
        }

        let start = Instant::now();
        let scan = match scan::scan_project(app.handle().clone(), channels_state.clone(), project_id).await {
            Ok(s) => s,
            Err(e) => {
                println!("mode={} | scan failed: {}", mode, e);
                continue;
            }
        };
        let elapsed = start.elapsed();

        let (total, by_detection, by_severity) = {
            let conn = db::get_connection();
            let violations = queries::select_violations(&conn, scan.id).unwrap_or_default();

            let mut det_map: HashMap<String, usize> = HashMap::new();
            let mut sev_map: HashMap<String, usize> = HashMap::new();

            for v in &violations {
                *det_map.entry(v.detection_method.clone()).or_insert(0) += 1;
                *sev_map.entry(v.severity.clone()).or_insert(0) += 1;
            }

            (violations.len(), det_map, sev_map)
        };

        println!(
            "mode={} | files_scanned={} | violations={} | detection_counts={:?} | severity_counts={:?} | duration_secs={:.2}",
            mode,
            scan.files_scanned,
            total,
            by_detection,
            by_severity,
            elapsed.as_secs_f64()
        );
    }

    Ok(())
}
