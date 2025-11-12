//! SOC 2 Rule Engines
//! Detect compliance violations in code based on SOC 2 control requirements

pub mod cc6_1_access_control;
pub mod cc6_7_secrets;

pub use cc6_1_access_control::CC61AccessControlRule;
pub use cc6_7_secrets::CC67SecretsRule;
