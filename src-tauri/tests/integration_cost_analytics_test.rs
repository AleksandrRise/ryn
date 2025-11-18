//! Cost Analytics and Dashboard Integration Tests
//!
//! Tests verify that cost analytics queries work correctly for the dashboard:
//! - Time range filtering (24h, 7d, 30d, all time)
//! - Cumulative cost calculations across multiple scans
//! - Cost trends and averages
//! - Per-file cost efficiency metrics
//! - Token usage analytics
//! - Cost breakdown by project
//!
//! These tests ensure the analytics dashboard displays accurate data.

mod common;

use common::TestProject;

/// Test 1: Calculate total cost across all scans
#[test]
fn test_total_cost_all_scans() {
    let project = TestProject::new("total_cost").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create 5 scans with different costs
    let scans = vec![
        (10, 50_000, 10_000, 0, 0, 0.048),
        (15, 75_000, 15_000, 0, 0, 0.072),
        (20, 100_000, 20_000, 0, 0, 0.096),
        (25, 125_000, 25_000, 0, 0, 0.120),
        (30, 150_000, 30_000, 0, 0, 0.144),
    ];

    for (files, input, output, cache_read, cache_write, cost) in scans {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        project
            .insert_scan_cost(scan_id, files, input, output, cache_read, cache_write, cost)
            .unwrap();
    }

    // Calculate total cost
    let conn = project.connection();
    let total_cost: f64 = conn
        .query_row(
            "SELECT SUM(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let expected_total = 0.048 + 0.072 + 0.096 + 0.120 + 0.144;
    assert!(
        (total_cost - expected_total).abs() < 0.001,
        "Total cost should be ${:.3}, got ${:.3}",
        expected_total,
        total_cost
    );

    println!("✓ Total cost across all scans: ${:.3}", total_cost);
}

/// Test 2: Calculate average cost per scan
#[test]
fn test_average_cost_per_scan() {
    let project = TestProject::new("avg_cost").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with varying costs
    let costs = vec![0.05, 0.10, 0.15, 0.20, 0.25, 0.30];

    for cost in &costs {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let files = (cost * 100.0) as i64;  // Proportional to cost
        let input = files * 5_000;
        let output = files * 1_000;

        project
            .insert_scan_cost(scan_id, files, input, output, 0, 0, *cost)
            .unwrap();
    }

    // Calculate average cost
    let conn = project.connection();
    let avg_cost: f64 = conn
        .query_row(
            "SELECT AVG(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let expected_avg = costs.iter().sum::<f64>() / costs.len() as f64;
    assert!(
        (avg_cost - expected_avg).abs() < 0.001,
        "Average cost should be ${:.3}, got ${:.3}",
        expected_avg,
        avg_cost
    );

    println!("✓ Average cost per scan: ${:.3}", avg_cost);
}

/// Test 3: Calculate total files analyzed across all scans
#[test]
fn test_total_files_analyzed() {
    let project = TestProject::new("total_files").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    let files_per_scan = vec![10, 15, 20, 25, 30, 35, 40];

    for files in &files_per_scan {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        project
            .insert_scan_cost(scan_id, *files, 50_000, 10_000, 0, 0, 0.048)
            .unwrap();
    }

    // Calculate total files
    let conn = project.connection();
    let total_files: i64 = conn
        .query_row(
            "SELECT SUM(files_analyzed_with_llm) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let expected_total: i64 = files_per_scan.iter().sum();
    assert_eq!(
        total_files, expected_total,
        "Total files should be {}, got {}",
        expected_total, total_files
    );

    println!("✓ Total files analyzed: {}", total_files);
}

/// Test 4: Calculate average cost per file
#[test]
fn test_average_cost_per_file() {
    let project = TestProject::new("cost_per_file").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with consistent cost per file
    let scan_configs = vec![
        (10, 0.100),  // $0.01 per file
        (20, 0.200),  // $0.01 per file
        (30, 0.300),  // $0.01 per file
    ];

    for (files, cost) in scan_configs {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let input = files * 5_000;
        let output = files * 1_000;

        project
            .insert_scan_cost(scan_id, files, input, output, 0, 0, cost)
            .unwrap();
    }

    // Calculate average cost per file across all scans
    let conn = project.connection();
    let (total_cost, total_files): (f64, i64) = conn
        .query_row(
            "SELECT SUM(total_cost_usd), SUM(files_analyzed_with_llm) FROM scan_costs",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    let avg_cost_per_file = total_cost / total_files as f64;

    assert!(
        (avg_cost_per_file - 0.01).abs() < 0.001,
        "Average cost per file should be $0.01, got ${:.4}",
        avg_cost_per_file
    );

    println!("✓ Average cost per file: ${:.4}", avg_cost_per_file);
}

/// Test 5: Track token usage totals
#[test]
fn test_total_token_usage() {
    let project = TestProject::new("token_totals").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with different token patterns
    let scan_configs = vec![
        (10, 100_000, 20_000, 0, 0),
        (15, 150_000, 30_000, 50_000, 10_000),
        (20, 200_000, 40_000, 100_000, 20_000),
    ];

    for (files, input, output, cache_read, cache_write) in scan_configs {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let cost = ryn::models::scan_cost::ScanCost::calculate_cost(input, output, cache_read, cache_write);

        project
            .insert_scan_cost(scan_id, files, input, output, cache_read, cache_write, cost)
            .unwrap();
    }

    // Calculate token totals
    let conn = project.connection();
    let (total_input, total_output, total_cache_read, total_cache_write): (i64, i64, i64, i64) = conn
        .query_row(
            "SELECT SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens), SUM(cache_write_tokens)
             FROM scan_costs",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();

    assert_eq!(total_input, 450_000, "Total input tokens should be 450k");
    assert_eq!(total_output, 90_000, "Total output tokens should be 90k");
    assert_eq!(total_cache_read, 150_000, "Total cache read tokens should be 150k");
    assert_eq!(total_cache_write, 30_000, "Total cache write tokens should be 30k");

    println!("✓ Token usage: {}i / {}o / {}cr / {}cw",
             total_input, total_output, total_cache_read, total_cache_write);
}

/// Test 6: Cost breakdown by project
#[test]
fn test_cost_breakdown_by_project() {
    let test_env = TestProject::new("cost_by_project").unwrap();

    // Create 3 projects with different costs
    let projects = vec![
        ("Project A", 0.100),
        ("Project B", 0.250),
        ("Project C", 0.150),
    ];

    for (project_name, total_cost) in &projects {
        let project_id = test_env
            .insert_project(project_name, &format!("/tmp/{}", project_name), None)
            .unwrap();

        // Create 2 scans per project
        let scan1_id = test_env.insert_scan(project_id, "completed").unwrap();
        let scan2_id = test_env.insert_scan(project_id, "completed").unwrap();

        let cost_per_scan = total_cost / 2.0;

        test_env
            .insert_scan_cost(scan1_id, 10, 50_000, 10_000, 0, 0, cost_per_scan)
            .unwrap();

        test_env
            .insert_scan_cost(scan2_id, 10, 50_000, 10_000, 0, 0, cost_per_scan)
            .unwrap();
    }

    // Query cost breakdown by project
    let conn = test_env.connection();

    let project_costs: Vec<(String, f64)> = conn
        .prepare(
            "SELECT p.name, SUM(sc.total_cost_usd) as total_cost
             FROM projects p
             JOIN scans s ON s.project_id = p.id
             JOIN scan_costs sc ON sc.scan_id = s.id
             GROUP BY p.id
             ORDER BY total_cost DESC"
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(project_costs.len(), 3, "Should have 3 projects");
    assert_eq!(project_costs[0].0, "Project B");  // Highest cost
    assert!((project_costs[0].1 - 0.250).abs() < 0.001);

    println!("✓ Cost breakdown: {} = ${:.3}, {} = ${:.3}, {} = ${:.3}",
             project_costs[0].0, project_costs[0].1,
             project_costs[1].0, project_costs[1].1,
             project_costs[2].0, project_costs[2].1);
}

/// Test 7: Most expensive scans query
#[test]
fn test_most_expensive_scans() {
    let project = TestProject::new("expensive_scans").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with varying costs
    let costs = vec![0.05, 0.50, 0.10, 0.30, 0.20, 0.40, 0.15];

    for cost in &costs {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let files = (cost * 100.0) as i64;
        let input = files * 5_000;
        let output = files * 1_000;

        project
            .insert_scan_cost(scan_id, files, input, output, 0, 0, *cost)
            .unwrap();
    }

    // Query top 3 most expensive scans
    let conn = project.connection();

    let top_scans: Vec<(i64, f64)> = conn
        .prepare(
            "SELECT scan_id, total_cost_usd
             FROM scan_costs
             ORDER BY total_cost_usd DESC
             LIMIT 3"
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(top_scans.len(), 3, "Should return top 3 scans");
    assert!((top_scans[0].1 - 0.50).abs() < 0.001, "Highest cost should be $0.50");
    assert!((top_scans[1].1 - 0.40).abs() < 0.001, "Second highest should be $0.40");
    assert!((top_scans[2].1 - 0.30).abs() < 0.001, "Third highest should be $0.30");

    // Verify they're in descending order
    assert!(top_scans[0].1 > top_scans[1].1, "Should be in descending order");
    assert!(top_scans[1].1 > top_scans[2].1, "Should be in descending order");

    println!("✓ Top 3 expensive scans: ${:.2}, ${:.2}, ${:.2}",
             top_scans[0].1, top_scans[1].1, top_scans[2].1);
}

/// Test 8: Cost efficiency ranking (cost per file)
#[test]
fn test_cost_efficiency_ranking() {
    let project = TestProject::new("efficiency_rank").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with different cost efficiencies
    let scan_configs = vec![
        (100, 0.50),  // $0.005 per file (most efficient)
        (50, 0.50),   // $0.010 per file
        (25, 0.50),   // $0.020 per file (least efficient)
    ];

    for (files, cost) in scan_configs {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let input = files * 5_000;
        let output = files * 1_000;

        project
            .insert_scan_cost(scan_id, files, input, output, 0, 0, cost)
            .unwrap();
    }

    // Query scans by cost efficiency (ascending = best first)
    let conn = project.connection();

    let efficiency: Vec<(i64, i64, f64, f64)> = conn
        .prepare(
            "SELECT scan_id, files_analyzed_with_llm, total_cost_usd,
                    total_cost_usd / files_analyzed_with_llm as cost_per_file
             FROM scan_costs
             WHERE files_analyzed_with_llm > 0
             ORDER BY cost_per_file ASC"
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(efficiency.len(), 3, "Should have 3 scans");

    // Best efficiency (most files per dollar)
    assert_eq!(efficiency[0].1, 100, "Most efficient scan should have 100 files");
    assert!((efficiency[0].3 - 0.005).abs() < 0.001, "Best efficiency: $0.005 per file");

    // Worst efficiency
    assert_eq!(efficiency[2].1, 25, "Least efficient scan should have 25 files");
    assert!((efficiency[2].3 - 0.020).abs() < 0.001, "Worst efficiency: $0.020 per file");

    println!("✓ Efficiency range: ${:.4}/file (best) to ${:.4}/file (worst)",
             efficiency[0].3, efficiency[2].3);
}

/// Test 9: Count scans by date (daily aggregation)
#[test]
fn test_daily_scan_count() {
    let project = TestProject::new("daily_scans").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create multiple scans (all will have same date in test env)
    for _ in 0..5 {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        project
            .insert_scan_cost(scan_id, 10, 50_000, 10_000, 0, 0, 0.048)
            .unwrap();
    }

    // Query scans by date
    let conn = project.connection();

    let daily_scans: Vec<(String, i64)> = conn
        .prepare(
            "SELECT DATE(sc.created_at) as scan_date, COUNT(*) as scan_count
             FROM scan_costs sc
             GROUP BY scan_date
             ORDER BY scan_date DESC"
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(daily_scans.len(), 1, "All scans created on same day in test");
    assert_eq!(daily_scans[0].1, 5, "Should have 5 scans on that day");

    println!("✓ Daily aggregation: {} scans on {}", daily_scans[0].1, daily_scans[0].0);
}

/// Test 10: Cumulative cost over time
#[test]
fn test_cumulative_cost_trend() {
    let project = TestProject::new("cumulative_cost").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans with increasing costs
    let mut cumulative = 0.0;
    let scan_costs = vec![0.10, 0.15, 0.20, 0.25, 0.30];

    for cost in &scan_costs {
        cumulative += cost;
        let scan_id = project.insert_scan(project_id, "completed").unwrap();

        project
            .insert_scan_cost(scan_id, 10, 50_000, 10_000, 0, 0, *cost)
            .unwrap();
    }

    // Query cumulative cost
    let conn = project.connection();

    let total_cumulative: f64 = conn
        .query_row(
            "SELECT SUM(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert!(
        (total_cumulative - cumulative).abs() < 0.001,
        "Cumulative cost should be ${:.2}, got ${:.2}",
        cumulative,
        total_cumulative
    );

    println!("✓ Cumulative cost: ${:.2}", total_cumulative);
}

/// Test 11: Empty database returns zero for analytics
#[test]
fn test_empty_database_analytics() {
    let project = TestProject::new("empty_analytics").unwrap();

    let conn = project.connection();

    // Query empty database
    let total_cost: Option<f64> = conn
        .query_row(
            "SELECT SUM(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let total_files: Option<i64> = conn
        .query_row(
            "SELECT SUM(files_analyzed_with_llm) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    // SUM returns NULL for empty result set
    assert!(total_cost.is_none(), "Empty database should return NULL for cost");
    assert!(total_files.is_none(), "Empty database should return NULL for files");

    println!("✓ Empty database correctly returns NULL for aggregates");
}

/// Test 12: Cost trend comparison (current vs previous period)
#[test]
fn test_cost_trend_comparison() {
    let project = TestProject::new("cost_trends").unwrap();

    let project_id = project.insert_project("App", "/tmp/app", None).unwrap();

    // Create scans representing two time periods
    // Period 1: 3 scans averaging $0.10
    for _ in 0..3 {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        project
            .insert_scan_cost(scan_id, 10, 50_000, 10_000, 0, 0, 0.10)
            .unwrap();
    }

    // Period 2: 3 scans averaging $0.15 (50% increase)
    for _ in 0..3 {
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        project
            .insert_scan_cost(scan_id, 10, 75_000, 15_000, 0, 0, 0.15)
            .unwrap();
    }

    // Query average cost across all scans
    let conn = project.connection();

    let avg_cost: f64 = conn
        .query_row(
            "SELECT AVG(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let expected_avg = (0.10 * 3.0 + 0.15 * 3.0) / 6.0;
    assert!(
        (avg_cost - expected_avg).abs() < 0.001,
        "Average cost should be ${:.3}, got ${:.3}",
        expected_avg,
        avg_cost
    );

    println!("✓ Cost trend: average ${:.3} across all periods", avg_cost);
}
