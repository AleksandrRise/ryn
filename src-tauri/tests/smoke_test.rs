//! Smoke test to verify test infrastructure works
//!
//! This test verifies that the common test helpers compile and work correctly.

mod common;

use common::TestProject;

#[test]
fn test_common_module_works() {
    let project = TestProject::new("smoke_test").unwrap();

    // Verify database is initialized
    let version = project.get_schema_version().unwrap();
    assert_eq!(version, 2, "Schema should be at version 2");

    // Verify tables exist
    assert!(project.table_exists("projects").unwrap());
    assert!(project.table_exists("scans").unwrap());
    assert!(project.table_exists("violations").unwrap());
    assert!(project.table_exists("scan_costs").unwrap());

    // Verify controls seeded
    let count = project.count_rows("controls").unwrap();
    assert_eq!(count, 4);
}
