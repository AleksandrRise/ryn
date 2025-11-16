//! Token Usage and Cost Tracking Integration Tests
//!
//! Tests verify that cost tracking works correctly during actual scans:
//! - Cost is calculated accurately from real token usage
//! - Scan costs are persisted to database correctly
//! - Cost analytics queries work correctly

mod common;

use common::TestProject;
use ryn::models::scan_cost::{ClaudePricing, ScanCost};

/// Test that scan cost calculation matches expected Claude pricing
#[test]
fn test_cost_calculation_accuracy() {
    // Test various realistic token usage scenarios
    let test_cases = vec![
        // (input, output, cache_read, cache_write, expected_cost)
        (10_000, 2_000, 0, 0, 0.016), // Small scan, no caching
        (50_000, 10_000, 0, 0, 0.08),  // Medium scan, no caching
        (100_000, 50_000, 200_000, 50_000, 0.346), // Large scan with caching
        (0, 0, 0, 0, 0.0),             // Edge case: zero tokens
    ];

    for (input, output, cache_read, cache_write, expected) in test_cases {
        let cost = ScanCost::calculate_cost(input, output, cache_read, cache_write);

        // Allow for floating point precision errors
        let diff = (cost - expected).abs();
        assert!(
            diff < 0.001,
            "Cost mismatch for tokens ({}, {}, {}, {}): expected ${}, got ${} (diff: ${})",
            input, output, cache_read, cache_write, expected, cost, diff
        );

        // Verify manual calculation matches
        let manual_cost =
            (input as f64 / 1_000_000.0) * ClaudePricing::HAIKU_INPUT_PER_MILLION
            + (output as f64 / 1_000_000.0) * ClaudePricing::HAIKU_OUTPUT_PER_MILLION
            + (cache_read as f64 / 1_000_000.0) * ClaudePricing::HAIKU_CACHE_READ_PER_MILLION
            + (cache_write as f64 / 1_000_000.0) * ClaudePricing::HAIKU_CACHE_WRITE_PER_MILLION;

        assert!(
            (cost - manual_cost).abs() < 0.000001,
            "Calculated cost doesn't match manual calculation"
        );
    }
}

/// Test that scan costs are persisted correctly to the database
#[test]
fn test_scan_cost_persistence() {
    let project = TestProject::new("scan_cost_persistence").unwrap();

    // Create test project and scan
    let project_id = project.insert_project("Test Project", "/tmp/test", Some("django")).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Insert scan cost with realistic token usage
    let cost_id = project.insert_scan_cost(
        scan_id,
        45,      // files analyzed
        150_000, // input tokens
        60_000,  // output tokens
        250_000, // cache read tokens (reusing prompt)
        45_000,  // cache write tokens
        0.373,   // total cost (calculated manually)
    ).unwrap();

    assert!(cost_id > 0, "Scan cost should be inserted successfully");

    // Verify the cost was persisted correctly
    let conn = project.connection();
    let (
        stored_scan_id,
        stored_files,
        stored_input,
        stored_output,
        stored_cache_read,
        stored_cache_write,
        stored_cost,
    ): (i64, i64, i64, i64, i64, i64, f64) = conn
        .query_row(
            "SELECT scan_id, files_analyzed_with_llm, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, total_cost_usd
             FROM scan_costs WHERE id = ?",
            [cost_id],
            |row| Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            )),
        )
        .unwrap();

    assert_eq!(stored_scan_id, scan_id);
    assert_eq!(stored_files, 45);
    assert_eq!(stored_input, 150_000);
    assert_eq!(stored_output, 60_000);
    assert_eq!(stored_cache_read, 250_000);
    assert_eq!(stored_cache_write, 45_000);
    assert!((stored_cost - 0.373).abs() < 0.001);

    // Verify created_at timestamp exists
    let created_at: String = conn
        .query_row(
            "SELECT created_at FROM scan_costs WHERE id = ?",
            [cost_id],
            |row| row.get(0),
        )
        .unwrap();

    assert!(!created_at.is_empty(), "created_at should be set");
}

/// Test cost analytics query for time range filtering
#[test]
fn test_cost_analytics_time_range_query() {
    let project = TestProject::new("cost_analytics").unwrap();

    // Create test project
    let project_id = project.insert_project("Analytics Test", "/tmp/test", None).unwrap();

    // Create multiple scans with costs over time
    // Scan 1: Today (should be in 24h range)
    let scan1_id = project.insert_scan(project_id, "completed").unwrap();
    project.insert_scan_cost(
        scan1_id,
        10, // files
        50_000, 10_000, 20_000, 5_000, // tokens
        0.086, // cost
    ).unwrap();

    // Scan 2: Today (should be in 24h range)
    let scan2_id = project.insert_scan(project_id, "completed").unwrap();
    project.insert_scan_cost(
        scan2_id,
        20, // files
        100_000, 20_000, 40_000, 10_000, // tokens
        0.172, // cost
    ).unwrap();

    // Scan 3: Today (should be in 24h range)
    let scan3_id = project.insert_scan(project_id, "completed").unwrap();
    project.insert_scan_cost(
        scan3_id,
        15, // files
        75_000, 15_000, 30_000, 7_500, // tokens
        0.129, // cost
    ).unwrap();

    let conn = project.connection();

    // Test: Get all costs (should return 3)
    let all_costs: Vec<(i64, f64)> = conn
        .prepare("SELECT id, total_cost_usd FROM scan_costs ORDER BY id")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(all_costs.len(), 3, "Should have 3 scan costs");

    // Test: Calculate total cost
    let total_cost: f64 = conn
        .query_row(
            "SELECT SUM(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert!(
        (total_cost - 0.387).abs() < 0.001,
        "Total cost should be sum of all scans: ${} != ${}",
        total_cost,
        0.387
    );

    // Test: Calculate total files analyzed
    let total_files: i64 = conn
        .query_row(
            "SELECT SUM(files_analyzed_with_llm) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(total_files, 45, "Total files should be 10 + 20 + 15 = 45");

    // Test: Calculate total tokens
    let total_input_tokens: i64 = conn
        .query_row(
            "SELECT SUM(input_tokens) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let total_output_tokens: i64 = conn
        .query_row(
            "SELECT SUM(output_tokens) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let total_cache_read: i64 = conn
        .query_row(
            "SELECT SUM(cache_read_tokens) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let total_cache_write: i64 = conn
        .query_row(
            "SELECT SUM(cache_write_tokens) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(total_input_tokens, 225_000, "Input tokens should sum correctly");
    assert_eq!(total_output_tokens, 45_000, "Output tokens should sum correctly");
    assert_eq!(total_cache_read, 90_000, "Cache read tokens should sum correctly");
    assert_eq!(total_cache_write, 22_500, "Cache write tokens should sum correctly");

    // Test: Average cost per scan
    let avg_cost_per_scan: f64 = conn
        .query_row(
            "SELECT AVG(total_cost_usd) FROM scan_costs",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert!(
        (avg_cost_per_scan - 0.129).abs() < 0.001,
        "Average cost per scan should be ~$0.129"
    );

    // Test: Get costs ordered by amount (descending)
    let costs_desc: Vec<f64> = conn
        .prepare("SELECT total_cost_usd FROM scan_costs ORDER BY total_cost_usd DESC")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(costs_desc.len(), 3);
    assert!(costs_desc[0] > costs_desc[1], "Costs should be in descending order");
    assert!(costs_desc[1] > costs_desc[2], "Costs should be in descending order");

    // Test: Filter by minimum cost threshold
    let expensive_scans: Vec<(i64, f64)> = conn
        .prepare("SELECT id, total_cost_usd FROM scan_costs WHERE total_cost_usd >= ? ORDER BY total_cost_usd DESC")
        .unwrap()
        .query_map([0.15], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(
        expensive_scans.len(), 1,
        "Should have 1 scan costing >= $0.15"
    );
    assert!((expensive_scans[0].1 - 0.172).abs() < 0.001);

    // Test: Calculate cost efficiency (cost per file)
    let cost_efficiency: Vec<(i64, f64)> = conn
        .prepare(
            "SELECT scan_id, total_cost_usd / files_analyzed_with_llm as cost_per_file
             FROM scan_costs
             WHERE files_analyzed_with_llm > 0
             ORDER BY cost_per_file ASC"
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(cost_efficiency.len(), 3, "Should calculate cost per file for 3 scans");

    // All scans should have cost per file between $0.008 and $0.01
    for (scan_id, cost_per_file) in cost_efficiency {
        assert!(
            cost_per_file > 0.007 && cost_per_file < 0.01,
            "Scan {} has unexpected cost per file: ${}",
            scan_id,
            cost_per_file
        );
    }
}

/// Test that cascade delete works for scan_costs when scan is deleted
#[test]
fn test_scan_cost_cascade_delete() {
    let project = TestProject::new("cascade_delete").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Insert scan cost
    let cost_id = project.insert_scan_cost(
        scan_id,
        10, 50_000, 10_000, 0, 0, 0.048
    ).unwrap();

    // Verify scan cost exists
    let exists_before: bool = project.connection()
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM scan_costs WHERE id = ?)",
            [cost_id],
            |row| row.get(0),
        )
        .unwrap();

    assert!(exists_before, "Scan cost should exist before delete");

    // Delete the scan
    project.connection()
        .execute("DELETE FROM scans WHERE id = ?", [scan_id])
        .unwrap();

    // Verify scan cost was cascade deleted
    let exists_after: bool = project.connection()
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM scan_costs WHERE id = ?)",
            [cost_id],
            |row| row.get(0),
        )
        .unwrap();

    assert!(!exists_after, "Scan cost should be cascade deleted when scan is deleted");
}

/// Test cost tracking with zero files analyzed (edge case)
#[test]
fn test_zero_files_cost_tracking() {
    let project = TestProject::new("zero_files").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Insert scan cost with zero files but non-zero tokens
    // (This could happen if scan was aborted after initial API calls)
    let cost_id = project.insert_scan_cost(
        scan_id,
        0, // zero files
        5_000, 1_000, 0, 0, // but some tokens used
        0.008,
    ).unwrap();

    assert!(cost_id > 0);

    // Verify the data was stored correctly
    let (files, cost): (i64, f64) = project.connection()
        .query_row(
            "SELECT files_analyzed_with_llm, total_cost_usd FROM scan_costs WHERE id = ?",
            [cost_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(files, 0);
    assert!((cost - 0.008).abs() < 0.001);

    // Create ScanCost model from this data to test helper methods
    let scan_cost = ScanCost::new(scan_id, 0, 5_000, 1_000, 0, 0);

    assert_eq!(scan_cost.cost_per_file(), 0.0, "Cost per file should be 0 when no files");
    assert_eq!(scan_cost.avg_tokens_per_file(), 0.0, "Avg tokens per file should be 0 when no files");
}
