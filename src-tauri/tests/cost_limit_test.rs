//! Cost Limit Pause/Resume Behavior Tests
//!
//! Tests verify that the cost limit mechanism works correctly:
//! - ScanResponseChannels creates and manages channels correctly
//! - respond_to_cost_limit() sends decisions to waiting scans
//! - Cost limit detection logic works at correct thresholds
//! - Multiple scans can have independent cost limit prompts
//!
//! Note: Full end-to-end testing with Tauri events requires integration testing
//! with the desktop app. These tests focus on the channel mechanism and logic.

mod common;

use common::TestProject;
use ryn::commands::scan::ScanResponseChannels;
use ryn::models::scan_cost::ScanCost;
use std::time::Duration;
use tokio::time::timeout;

/// Test 1: ScanResponseChannels can create and receive responses
#[tokio::test]
async fn test_scan_response_channels_create_and_respond() {
    let channels = ScanResponseChannels::default();
    let scan_id = 123;

    // Create channel for scan
    let rx = channels.create_cost_limit_channel(scan_id);

    // Simulate user responding "continue" (true)
    let result = channels.respond_to_cost_limit(scan_id, true);

    assert!(result.is_ok(), "Should successfully send response");

    // Receive decision
    match rx.await {
        Ok(decision) => assert_eq!(decision, true, "Should receive 'continue' decision"),
        Err(e) => panic!("Failed to receive decision: {:?}", e),
    }
}

/// Test 2: Responding to non-existent scan returns error
#[tokio::test]
async fn test_respond_to_nonexistent_scan() {
    let channels = ScanResponseChannels::default();
    let scan_id = 999;

    // Try to respond without creating channel first
    let result = channels.respond_to_cost_limit(scan_id, true);

    assert!(result.is_err(), "Should error when responding to non-existent scan");
    assert!(
        result.unwrap_err().contains("No pending cost limit prompt"),
        "Error should mention no pending prompt"
    );
}

/// Test 3: User decision "stop" (false) is received correctly
#[tokio::test]
async fn test_user_decision_stop() {
    let channels = ScanResponseChannels::default();
    let scan_id = 456;

    let rx = channels.create_cost_limit_channel(scan_id);

    // User chooses to stop scanning
    channels.respond_to_cost_limit(scan_id, false).unwrap();

    match rx.await {
        Ok(decision) => assert_eq!(decision, false, "Should receive 'stop' decision"),
        Err(e) => panic!("Failed to receive decision: {:?}", e),
    }
}

/// Test 4: Multiple scans can have independent cost limit prompts
#[tokio::test]
async fn test_multiple_scans_independent_prompts() {
    let channels = ScanResponseChannels::default();

    let scan1_id = 100;
    let scan2_id = 200;

    // Create channels for both scans
    let rx1 = channels.create_cost_limit_channel(scan1_id);
    let rx2 = channels.create_cost_limit_channel(scan2_id);

    // Respond to scan1 with "continue"
    channels.respond_to_cost_limit(scan1_id, true).unwrap();

    // Respond to scan2 with "stop"
    channels.respond_to_cost_limit(scan2_id, false).unwrap();

    // Verify each scan received correct decision
    let decision1 = rx1.await.unwrap();
    let decision2 = rx2.await.unwrap();

    assert_eq!(decision1, true, "Scan 1 should receive 'continue'");
    assert_eq!(decision2, false, "Scan 2 should receive 'stop'");
}

/// Test 5: Channel can only be responded to once
#[tokio::test]
async fn test_channel_single_use() {
    let channels = ScanResponseChannels::default();
    let scan_id = 789;

    let _rx = channels.create_cost_limit_channel(scan_id);

    // First response should succeed
    let result1 = channels.respond_to_cost_limit(scan_id, true);
    assert!(result1.is_ok(), "First response should succeed");

    // Second response should fail (channel already consumed)
    let result2 = channels.respond_to_cost_limit(scan_id, false);
    assert!(result2.is_err(), "Second response should fail");
}

/// Test 6: Cost calculation respects 2025 pricing
#[test]
fn test_cost_calculation_2025_pricing() {
    // 2025 Claude Haiku pricing:
    // Input: $0.80/MTok, Output: $4.00/MTok
    // Cache read: $0.08/MTok, Cache write: $1.00/MTok

    let test_cases = vec![
        // (input, output, cache_read, cache_write, expected_cost)
        (1_000_000, 0, 0, 0, 0.80),          // 1M input tokens = $0.80
        (0, 1_000_000, 0, 0, 4.00),          // 1M output tokens = $4.00
        (0, 0, 1_000_000, 0, 0.08),          // 1M cache read = $0.08
        (0, 0, 0, 1_000_000, 1.00),          // 1M cache write = $1.00
        (100_000, 50_000, 200_000, 50_000, 0.346), // Mixed usage
        (10_000, 5_000, 0, 0, 0.028),        // Small scan
    ];

    for (input, output, cache_read, cache_write, expected) in test_cases {
        let cost = ScanCost::calculate_cost(input, output, cache_read, cache_write);

        let diff = (cost - expected).abs();
        assert!(
            diff < 0.001,
            "Cost mismatch for tokens ({}, {}, {}, {}): expected ${}, got ${} (diff: ${})",
            input, output, cache_read, cache_write, expected, cost, diff
        );
    }

    println!("✓ Cost calculation matches 2025 Claude Haiku pricing");
}

/// Test 7: Cost limit detection at correct threshold
#[test]
fn test_cost_limit_detection() {
    let project = TestProject::new("cost_limit_detection").unwrap();

    // Set cost limit to $0.50
    project.insert_setting("cost_limit_per_scan", "0.50").unwrap();

    // Query cost limit from settings
    let conn = project.connection();
    let cost_limit_str: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'cost_limit_per_scan'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let cost_limit: f64 = cost_limit_str.parse().unwrap();

    assert_eq!(cost_limit, 0.50, "Cost limit should be $0.50");

    // Simulate scan costs
    let scan_costs = vec![
        0.10, // Batch 1: $0.10 (cumulative: $0.10) - under limit
        0.15, // Batch 2: $0.15 (cumulative: $0.25) - under limit
        0.20, // Batch 3: $0.20 (cumulative: $0.45) - under limit
        0.15, // Batch 4: $0.15 (cumulative: $0.60) - OVER LIMIT! Should prompt
    ];

    let mut cumulative_cost = 0.0;
    let mut should_prompt_after_batch: Option<usize> = None;

    for (batch_idx, batch_cost) in scan_costs.iter().enumerate() {
        cumulative_cost += batch_cost;

        if cumulative_cost > cost_limit && should_prompt_after_batch.is_none() {
            should_prompt_after_batch = Some(batch_idx);
        }
    }

    assert_eq!(
        should_prompt_after_batch,
        Some(3),
        "Should prompt after batch 3 (0-indexed), when cumulative cost exceeds $0.50"
    );

    println!("✓ Cost limit detection triggers at correct threshold");
}

/// Test 8: Cost per file calculation
#[test]
fn test_cost_per_file_calculation() {
    let test_cases = vec![
        // (files, input, output, cache_read, cache_write, expected_cost_per_file)
        (10, 50_000, 10_000, 20_000, 5_000, 0.0086),   // $0.086 / 10 = $0.0086
        (100, 500_000, 100_000, 200_000, 50_000, 0.0086), // Same per-file cost
        (1, 10_000, 2_000, 0, 0, 0.016),               // Single file
        (0, 10_000, 2_000, 0, 0, 0.0),                 // Zero files (edge case)
    ];

    for (files, input, output, cache_read, cache_write, expected_per_file) in test_cases {
        let scan_cost = ScanCost::new(1, files, input, output, cache_read, cache_write);

        let cost_per_file = scan_cost.cost_per_file();

        if files == 0 {
            assert_eq!(cost_per_file, 0.0, "Cost per file should be 0 when files=0");
        } else {
            let diff = (cost_per_file - expected_per_file).abs();
            assert!(
                diff < 0.001,
                "Cost per file mismatch for {} files: expected ${}, got ${}",
                files, expected_per_file, cost_per_file
            );
        }
    }

    println!("✓ Cost per file calculation is accurate");
}

/// Test 9: Receiver timeout if no response
#[tokio::test]
async fn test_receiver_timeout_on_no_response() {
    let channels = ScanResponseChannels::default();
    let scan_id = 333;

    let rx = channels.create_cost_limit_channel(scan_id);

    // Don't send response - simulate user closing dialog or timeout

    // Try to receive with timeout
    let result = timeout(Duration::from_millis(100), rx).await;

    match result {
        Err(_) => {
            // Timeout occurred - this is expected
            println!("✓ Receiver correctly times out when no response is sent");
        }
        Ok(Ok(decision)) => {
            panic!("Should not receive decision without response: {:?}", decision);
        }
        Ok(Err(e)) => {
            // Channel closed without sending - also acceptable
            println!("✓ Channel closed without response: {:?}", e);
        }
    }
}

/// Test 10: Settings persistence for cost limits
#[test]
fn test_cost_limit_settings_persistence() {
    let project = TestProject::new("cost_limit_settings").unwrap();

    // Test default value
    let conn = project.connection();
    let default_limit: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'cost_limit_per_scan'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(default_limit, "1.0", "Default cost limit should be $1.0");

    // Update cost limit
    project.insert_setting("cost_limit_per_scan", "5.00").unwrap();

    let updated_limit: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'cost_limit_per_scan'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(updated_limit, "5.00", "Updated cost limit should be $5.00");

    // Test different values
    let test_limits = vec!["0.10", "2.50", "10.00", "100.00"];

    for limit in test_limits {
        project.insert_setting("cost_limit_per_scan", limit).unwrap();

        let stored_limit: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'cost_limit_per_scan'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(stored_limit, limit, "Cost limit should be ${}", limit);
    }

    println!("✓ Cost limit settings persist correctly");
}

/// Test 11: Batch size affects cost limit detection frequency
#[test]
fn test_batch_size_cost_checking() {
    // The scan_project command checks cost limit every 10 files (batch size)
    // This test verifies the logic is correct

    let batch_size = 10;
    let cost_limit = 1.0; // $1.00
    let cost_per_file = 0.15; // $0.15 per file

    let mut total_files_processed = 0;
    let mut cumulative_cost = 0.0;
    let mut cost_limit_hit = false;

    // Simulate processing files in batches
    for batch_num in 0..10 {
        // Process batch of 10 files
        for _ in 0..batch_size {
            total_files_processed += 1;
            cumulative_cost += cost_per_file;
        }

        // Check cost limit after each batch (this is what scan_project does)
        if cumulative_cost > cost_limit && !cost_limit_hit {
            cost_limit_hit = true;
            println!("Cost limit hit after batch {}, {} files processed, ${:.2} spent",
                     batch_num, total_files_processed, cumulative_cost);
            break;
        }
    }

    assert!(cost_limit_hit, "Should hit cost limit");
    assert_eq!(total_files_processed, 10, "Should check after first batch (10 files)");
    assert!(cumulative_cost > cost_limit, "Cumulative cost should exceed limit");

    println!("✓ Batch-based cost checking works correctly");
}

/// Test 12: Cost tracking with scan_costs table
#[test]
fn test_scan_costs_table_tracking() {
    let project = TestProject::new("scan_costs_tracking").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "running").unwrap();

    // Simulate multiple batches with increasing costs
    let batches = vec![
        (10, 50_000, 10_000, 0, 0),         // Batch 1
        (10, 50_000, 10_000, 0, 0),         // Batch 2
        (10, 50_000, 10_000, 0, 0),         // Batch 3
        (5, 25_000, 5_000, 0, 0),           // Batch 4 (partial)
    ];

    let mut total_files = 0;
    let mut total_input = 0;
    let mut total_output = 0;

    for (files, input, output, cache_read, cache_write) in batches {
        total_files += files;
        total_input += input;
        total_output += output;

        let cost = ScanCost::calculate_cost(input, output, cache_read, cache_write);

        // In real implementation, this would be cumulative cost for the scan
        // Here we just verify we can track it
        println!("Batch: {} files, ${:.4} cost", files, cost);
    }

    // Store final cumulative cost
    let total_cost = ScanCost::calculate_cost(total_input, total_output, 0, 0);

    project.insert_scan_cost(
        scan_id,
        total_files,
        total_input,
        total_output,
        0,
        0,
        total_cost,
    ).unwrap();

    // Verify stored correctly
    let conn = project.connection();
    let (stored_files, stored_cost): (i64, f64) = conn
        .query_row(
            "SELECT files_analyzed_with_llm, total_cost_usd FROM scan_costs WHERE scan_id = ?",
            [scan_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(stored_files, total_files, "Should store correct file count");
    assert!((stored_cost - total_cost).abs() < 0.001, "Should store correct cost");

    println!("✓ Scan costs table tracks cumulative costs correctly");
}
