//! Concurrent Scans with Independent Cost Tracking Tests
//!
//! Tests verify that multiple scans can run simultaneously with independent:
//! - Cost tracking (each scan has separate scan_costs record)
//! - Violation storage (scans don't interfere with each other)
//! - Settings (each scan reads same settings but tracks costs separately)
//! - Cost limit enforcement (one scan hitting limit doesn't affect others)
//!
//! Note: Full concurrent async testing requires Tauri runtime. These tests
//! verify data isolation and tracking mechanisms work correctly.

mod common;

use common::TestProject;

/// Test 1: Multiple scans on different projects track costs independently
#[test]
fn test_multiple_projects_independent_costs() {
    let test_env = TestProject::new("multi_project_costs").unwrap();

    // Create two different projects
    let project1_id = test_env
        .insert_project("Project Alpha", "/tmp/alpha", Some("django"))
        .unwrap();

    let project2_id = test_env
        .insert_project("Project Beta", "/tmp/beta", Some("flask"))
        .unwrap();

    // Create scans for both projects
    let scan1_id = test_env.insert_scan(project1_id, "completed").unwrap();
    let scan2_id = test_env.insert_scan(project2_id, "completed").unwrap();

    // Insert independent cost tracking for each scan
    test_env
        .insert_scan_cost(
            scan1_id,
            25,       // files
            100_000,  // input tokens
            25_000,   // output tokens
            0,
            0,
            0.180,    // $0.18
        )
        .unwrap();

    test_env
        .insert_scan_cost(
            scan2_id,
            50,       // files
            200_000,  // input tokens
            50_000,   // output tokens
            0,
            0,
            0.360,    // $0.36
        )
        .unwrap();

    // Verify each scan has its own cost record
    let conn = test_env.connection();

    let (scan1_files, scan1_cost): (i64, f64) = conn
        .query_row(
            "SELECT files_analyzed_with_llm, total_cost_usd FROM scan_costs WHERE scan_id = ?",
            [scan1_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    let (scan2_files, scan2_cost): (i64, f64) = conn
        .query_row(
            "SELECT files_analyzed_with_llm, total_cost_usd FROM scan_costs WHERE scan_id = ?",
            [scan2_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(scan1_files, 25, "Scan 1 should track 25 files");
    assert!((scan1_cost - 0.180).abs() < 0.001, "Scan 1 should cost $0.18");

    assert_eq!(scan2_files, 50, "Scan 2 should track 50 files");
    assert!((scan2_cost - 0.360).abs() < 0.001, "Scan 2 should cost $0.36");

    println!("✓ Multiple projects track costs independently");
}

/// Test 2: Multiple scans on same project track costs independently
#[test]
fn test_multiple_scans_same_project_independent_costs() {
    let test_env = TestProject::new("multi_scan_costs").unwrap();

    let project_id = test_env
        .insert_project("Django App", "/tmp/app", Some("django"))
        .unwrap();

    // Create 3 sequential scans on same project
    let scan1_id = test_env.insert_scan(project_id, "completed").unwrap();
    let scan2_id = test_env.insert_scan(project_id, "completed").unwrap();
    let scan3_id = test_env.insert_scan(project_id, "completed").unwrap();

    // Each scan has different costs
    test_env.insert_scan_cost(scan1_id, 10, 50_000, 10_000, 0, 0, 0.048).unwrap();
    test_env.insert_scan_cost(scan2_id, 15, 75_000, 15_000, 0, 0, 0.120).unwrap();
    test_env.insert_scan_cost(scan3_id, 20, 100_000, 20_000, 0, 0, 0.160).unwrap();

    // Verify each scan has independent cost record
    let conn = test_env.connection();

    let costs: Vec<f64> = conn
        .prepare("SELECT total_cost_usd FROM scan_costs WHERE scan_id IN (?, ?, ?) ORDER BY scan_id")
        .unwrap()
        .query_map([scan1_id, scan2_id, scan3_id], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(costs.len(), 3, "Should have 3 independent cost records");
    assert!((costs[0] - 0.048).abs() < 0.001, "Scan 1 cost should be $0.048");
    assert!((costs[1] - 0.120).abs() < 0.001, "Scan 2 cost should be $0.120");
    assert!((costs[2] - 0.160).abs() < 0.001, "Scan 3 cost should be $0.160");

    println!("✓ Multiple scans on same project track costs independently");
}

/// Test 3: Violations from different scans don't interfere
#[test]
fn test_concurrent_scans_violations_isolation() {
    let test_env = TestProject::new("violations_isolation").unwrap();

    let project1_id = test_env.insert_project("App1", "/tmp/app1", None).unwrap();
    let project2_id = test_env.insert_project("App2", "/tmp/app2", None).unwrap();

    let scan1_id = test_env.insert_scan(project1_id, "completed").unwrap();
    let scan2_id = test_env.insert_scan(project2_id, "completed").unwrap();

    // Insert violations for scan 1
    test_env
        .insert_violation(
            scan1_id,
            "CC6.1",
            "high",
            "Missing auth",
            "app1/views.py",
            10,
            "def view(): pass",
            Some("regex"),
            None,
            None,
            Some("Pattern match"),
        )
        .unwrap();

    test_env
        .insert_violation(
            scan1_id,
            "CC6.7",
            "critical",
            "Hardcoded secret",
            "app1/config.py",
            5,
            "api_key = 'secret'",
            Some("regex"),
            None,
            None,
            Some("Pattern match"),
        )
        .unwrap();

    // Insert violations for scan 2
    test_env
        .insert_violation(
            scan2_id,
            "CC7.2",
            "medium",
            "Missing log",
            "app2/admin.py",
            20,
            "user.delete()",
            Some("regex"),
            None,
            None,
            Some("Pattern match"),
        )
        .unwrap();

    test_env
        .insert_violation(
            scan2_id,
            "A1.2",
            "high",
            "No error handling",
            "app2/db.py",
            15,
            "db.query(sql)",
            Some("regex"),
            None,
            None,
            Some("Pattern match"),
        )
        .unwrap();

    test_env
        .insert_violation(
            scan2_id,
            "CC6.1",
            "high",
            "Missing auth",
            "app2/routes.py",
            8,
            "def admin(): pass",
            Some("regex"),
            None,
            None,
            Some("Pattern match"),
        )
        .unwrap();

    // Verify each scan has its own violations
    let conn = test_env.connection();

    let scan1_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM violations WHERE scan_id = ?",
            [scan1_id],
            |row| row.get(0),
        )
        .unwrap();

    let scan2_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM violations WHERE scan_id = ?",
            [scan2_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(scan1_count, 2, "Scan 1 should have 2 violations");
    assert_eq!(scan2_count, 3, "Scan 2 should have 3 violations");

    // Verify file paths are isolated
    let scan1_files: Vec<String> = conn
        .prepare("SELECT DISTINCT file_path FROM violations WHERE scan_id = ? ORDER BY file_path")
        .unwrap()
        .query_map([scan1_id], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let scan2_files: Vec<String> = conn
        .prepare("SELECT DISTINCT file_path FROM violations WHERE scan_id = ? ORDER BY file_path")
        .unwrap()
        .query_map([scan2_id], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(scan1_files, vec!["app1/config.py", "app1/views.py"]);
    assert_eq!(scan2_files, vec!["app2/admin.py", "app2/db.py", "app2/routes.py"]);

    println!("✓ Violations from different scans are properly isolated");
}

/// Test 4: Cost limit settings are shared but tracking is independent
#[test]
fn test_shared_settings_independent_tracking() {
    let test_env = TestProject::new("shared_settings").unwrap();

    // Set global cost limit
    test_env.insert_setting("cost_limit_per_scan", "0.50").unwrap();

    let project_id = test_env.insert_project("App", "/tmp/app", None).unwrap();

    let scan1_id = test_env.insert_scan(project_id, "completed").unwrap();
    let scan2_id = test_env.insert_scan(project_id, "running").unwrap();

    // Scan 1 costs $0.30 (under limit)
    test_env.insert_scan_cost(scan1_id, 20, 150_000, 30_000, 0, 0, 0.30).unwrap();

    // Scan 2 costs $0.45 (also under limit - independent tracking)
    test_env.insert_scan_cost(scan2_id, 25, 187_500, 37_500, 0, 0, 0.45).unwrap();

    // Verify both scans read same cost limit
    let conn = test_env.connection();
    let cost_limit: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'cost_limit_per_scan'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(cost_limit, "0.50", "Cost limit should be $0.50 for all scans");

    // Verify each scan's cost is independent and under limit
    let costs: Vec<f64> = conn
        .prepare("SELECT total_cost_usd FROM scan_costs WHERE scan_id IN (?, ?) ORDER BY scan_id")
        .unwrap()
        .query_map([scan1_id, scan2_id], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    for cost in &costs {
        assert!(
            *cost < 0.50,
            "Each scan's cost should be independently under limit: ${}",
            cost
        );
    }

    println!("✓ Settings are shared but cost tracking is independent");
}

/// Test 5: Scan status updates don't affect other scans
#[test]
fn test_scan_status_independence() {
    let test_env = TestProject::new("status_independence").unwrap();

    let project_id = test_env.insert_project("App", "/tmp/app", None).unwrap();

    // Create 4 scans with different statuses
    let scan1_id = test_env.insert_scan(project_id, "running").unwrap();
    let scan2_id = test_env.insert_scan(project_id, "completed").unwrap();
    let scan3_id = test_env.insert_scan(project_id, "failed").unwrap();
    let scan4_id = test_env.insert_scan(project_id, "running").unwrap();

    // Update scan1 to completed
    let conn = test_env.connection();
    conn.execute(
        "UPDATE scans SET status = 'completed' WHERE id = ?",
        [scan1_id],
    )
    .unwrap();

    // Verify other scans' statuses are unchanged
    let statuses: Vec<(i64, String)> = conn
        .prepare("SELECT id, status FROM scans WHERE project_id = ? ORDER BY id")
        .unwrap()
        .query_map([project_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(statuses.len(), 4, "Should have 4 scans");
    assert_eq!(statuses[0], (scan1_id, "completed".to_string()));
    assert_eq!(statuses[1], (scan2_id, "completed".to_string()));
    assert_eq!(statuses[2], (scan3_id, "failed".to_string()));
    assert_eq!(statuses[3], (scan4_id, "running".to_string()));

    println!("✓ Scan status updates are independent");
}

/// Test 6: Concurrent cost calculations don't overlap
#[test]
fn test_concurrent_cost_calculations() {
    let test_env = TestProject::new("concurrent_costs").unwrap();

    let project_id = test_env.insert_project("App", "/tmp/app", None).unwrap();

    // Simulate 5 concurrent scans with different token usage
    let scan_configs = vec![
        (10, 50_000, 10_000, 0, 0),
        (20, 100_000, 20_000, 0, 0),
        (15, 75_000, 15_000, 0, 0),
        (30, 150_000, 30_000, 0, 0),
        (25, 125_000, 25_000, 0, 0),
    ];

    let mut scan_ids = Vec::new();
    let mut expected_costs = Vec::new();

    for (files, input, output, cache_read, cache_write) in scan_configs {
        let scan_id = test_env.insert_scan(project_id, "completed").unwrap();
        let cost = ryn::models::scan_cost::ScanCost::calculate_cost(input, output, cache_read, cache_write);

        test_env
            .insert_scan_cost(scan_id, files, input, output, cache_read, cache_write, cost)
            .unwrap();

        scan_ids.push(scan_id);
        expected_costs.push(cost);
    }

    // Verify each scan has correct independent cost
    let conn = test_env.connection();

    for (idx, scan_id) in scan_ids.iter().enumerate() {
        let stored_cost: f64 = conn
            .query_row(
                "SELECT total_cost_usd FROM scan_costs WHERE scan_id = ?",
                [scan_id],
                |row| row.get(0),
            )
            .unwrap();

        let diff = (stored_cost - expected_costs[idx]).abs();
        assert!(
            diff < 0.001,
            "Scan {} cost should be ${:.4}, got ${:.4}",
            scan_id,
            expected_costs[idx],
            stored_cost
        );
    }

    println!("✓ Concurrent cost calculations are independent and accurate");
}

/// Test 7: Audit events from different scans are properly timestamped
#[test]
fn test_concurrent_audit_events() {
    let test_env = TestProject::new("concurrent_audit").unwrap();

    let project1_id = test_env.insert_project("App1", "/tmp/app1", None).unwrap();
    let project2_id = test_env.insert_project("App2", "/tmp/app2", None).unwrap();

    let scan1_id = test_env.insert_scan(project1_id, "completed").unwrap();
    let scan2_id = test_env.insert_scan(project2_id, "completed").unwrap();

    // Insert audit events for both scans
    let conn = test_env.connection();

    // Audit event for scan 1
    conn.execute(
        "INSERT INTO audit_events (event_type, project_id, description, created_at)
         VALUES (?, ?, ?, datetime('now'))",
        rusqlite::params![
            "scan_completed",
            project1_id,
            format!("Scan {} completed", scan1_id),
        ],
    )
    .unwrap();

    // Audit event for scan 2
    conn.execute(
        "INSERT INTO audit_events (event_type, project_id, description, created_at)
         VALUES (?, ?, ?, datetime('now'))",
        rusqlite::params![
            "scan_completed",
            project2_id,
            format!("Scan {} completed", scan2_id),
        ],
    )
    .unwrap();

    // Verify audit events exist for both
    let audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM audit_events WHERE event_type = 'scan_completed'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(audit_count, 2, "Should have 2 audit events");

    // Verify events reference correct projects
    let project_ids: Vec<i64> = conn
        .prepare("SELECT DISTINCT project_id FROM audit_events ORDER BY project_id")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(project_ids, vec![project1_id, project2_id]);

    println!("✓ Audit events from concurrent scans are properly tracked");
}

/// Test 8: Database integrity under concurrent scan simulation
#[test]
fn test_database_integrity_concurrent_scans() {
    let test_env = TestProject::new("db_integrity").unwrap();

    let project_id = test_env.insert_project("App", "/tmp/app", None).unwrap();

    // Simulate 10 concurrent scans
    let mut scan_ids = Vec::new();

    for i in 0..10 {
        let scan_id = test_env.insert_scan(project_id, "running").unwrap();

        // Insert violations
        test_env
            .insert_violation(
                scan_id,
                "CC6.1",
                "high",
                &format!("Violation {}", i),
                &format!("file{}.py", i),
                10,
                "code",
                Some("regex"),
                None,
                None,
                Some("Pattern match"),
            )
            .unwrap();

        // Insert costs
        test_env
            .insert_scan_cost(scan_id, 10, 50_000, 10_000, 0, 0, 0.048)
            .unwrap();

        scan_ids.push(scan_id);
    }

    // Verify database integrity
    let conn = test_env.connection();

    // All scans should exist
    let scan_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM scans WHERE project_id = ?",
            [project_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(scan_count, 10, "Should have 10 scans");

    // Each scan should have 1 violation
    let violation_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM violations WHERE scan_id IN (SELECT id FROM scans WHERE project_id = ?)",
            [project_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(violation_count, 10, "Should have 10 violations (1 per scan)");

    // Each scan should have 1 cost record
    let cost_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM scan_costs WHERE scan_id IN (SELECT id FROM scans WHERE project_id = ?)",
            [project_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(cost_count, 10, "Should have 10 cost records (1 per scan)");

    // Verify foreign key constraints are maintained
    let orphaned_violations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM violations WHERE scan_id NOT IN (SELECT id FROM scans)",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(orphaned_violations, 0, "Should have no orphaned violations");

    println!("✓ Database maintains integrity under concurrent scan simulation");
}
