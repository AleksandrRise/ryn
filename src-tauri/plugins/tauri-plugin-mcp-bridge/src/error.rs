use thiserror::Error;

/// MCP bridge error types with codes 2000-2500
/// Covers connection, protocol, resource, permission, config, and internal errors
#[derive(Error, Debug)]
pub enum TauriMCPError {
    /// Socket connection failed (2000)
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    /// Socket disconnected unexpectedly (2001)
    #[error("Disconnected: {0}")]
    Disconnected(String),

    /// Operation timed out (2002)
    #[error("Timeout: {0}")]
    Timeout(String),

    /// JSON-RPC protocol error (2100)
    #[error("Protocol error: {0}")]
    ProtocolError(String),

    /// Resource not available (2200)
    #[error("Resource unavailable: {0}")]
    ResourceUnavailable(String),

    /// Permission denied for operation (2300)
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    /// Invalid configuration (2400)
    #[error("Invalid config: {0}")]
    InvalidConfig(String),

    /// Internal error (2500)
    #[error("Internal error: {0}")]
    InternalError(String),

    /// IO error wrapper (maps to appropriate code)
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl TauriMCPError {
    /// Check if error is retryable (transient failures vs permanent errors)
    /// Retryable: ConnectionFailed, Disconnected, Timeout, ResourceUnavailable
    /// Non-retryable: ProtocolError, PermissionDenied, InvalidConfig, InternalError
    pub fn is_retryable(&self) -> bool {
        match self {
            // Transient failures - safe to retry with backoff
            TauriMCPError::ConnectionFailed(_) => true,
            TauriMCPError::Disconnected(_) => true,
            TauriMCPError::Timeout(_) => true,
            TauriMCPError::ResourceUnavailable(_) => true,

            // Permanent errors - won't succeed on retry
            TauriMCPError::ProtocolError(_) => false,
            TauriMCPError::PermissionDenied(_) => false,
            TauriMCPError::InvalidConfig(_) => false,
            TauriMCPError::InternalError(_) => false,

            // IO errors: connection refused is retryable, permission denied is not
            TauriMCPError::Io(e) => match e.kind() {
                std::io::ErrorKind::ConnectionRefused => true,
                std::io::ErrorKind::ConnectionReset => true,
                std::io::ErrorKind::ConnectionAborted => true,
                std::io::ErrorKind::NotConnected => true,
                std::io::ErrorKind::TimedOut => true,
                _ => false,
            },
        }
    }

    /// Get error code for JSON-RPC error responses
    /// Maps each variant to its designated code in range 2000-2500
    pub fn error_code(&self) -> i32 {
        match self {
            // Connection errors: 2000-2099
            TauriMCPError::ConnectionFailed(_) => 2000,
            TauriMCPError::Disconnected(_) => 2001,
            TauriMCPError::Timeout(_) => 2002,

            // Protocol errors: 2100-2199
            TauriMCPError::ProtocolError(_) => 2100,

            // Resource errors: 2200-2299
            TauriMCPError::ResourceUnavailable(_) => 2200,

            // Permission errors: 2300-2399
            TauriMCPError::PermissionDenied(_) => 2300,

            // Config errors: 2400-2499
            TauriMCPError::InvalidConfig(_) => 2400,

            // Internal errors: 2500+
            TauriMCPError::InternalError(_) => 2500,

            // IO errors map based on kind
            TauriMCPError::Io(e) => match e.kind() {
                std::io::ErrorKind::ConnectionRefused => 2000,
                std::io::ErrorKind::ConnectionReset => 2001,
                std::io::ErrorKind::ConnectionAborted => 2001,
                std::io::ErrorKind::NotConnected => 2001,
                std::io::ErrorKind::TimedOut => 2002,
                std::io::ErrorKind::PermissionDenied => 2300,
                std::io::ErrorKind::NotFound => 2200,
                _ => 2500,
            },
        }
    }
}

/// Result type alias for MCP operations
pub type Result<T> = std::result::Result<T, TauriMCPError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes_connection() {
        assert_eq!(
            TauriMCPError::ConnectionFailed("test".into()).error_code(),
            2000
        );
        assert_eq!(
            TauriMCPError::Disconnected("test".into()).error_code(),
            2001
        );
        assert_eq!(
            TauriMCPError::Timeout("test".into()).error_code(),
            2002
        );
    }

    #[test]
    fn test_error_codes_protocol() {
        assert_eq!(
            TauriMCPError::ProtocolError("test".into()).error_code(),
            2100
        );
    }

    #[test]
    fn test_error_codes_resource() {
        assert_eq!(
            TauriMCPError::ResourceUnavailable("test".into()).error_code(),
            2200
        );
    }

    #[test]
    fn test_error_codes_permission() {
        assert_eq!(
            TauriMCPError::PermissionDenied("test".into()).error_code(),
            2300
        );
    }

    #[test]
    fn test_error_codes_config() {
        assert_eq!(
            TauriMCPError::InvalidConfig("test".into()).error_code(),
            2400
        );
    }

    #[test]
    fn test_error_codes_internal() {
        assert_eq!(
            TauriMCPError::InternalError("test".into()).error_code(),
            2500
        );
    }

    #[test]
    fn test_retryable_transient_errors() {
        assert!(TauriMCPError::ConnectionFailed("test".into()).is_retryable());
        assert!(TauriMCPError::Disconnected("test".into()).is_retryable());
        assert!(TauriMCPError::Timeout("test".into()).is_retryable());
        assert!(TauriMCPError::ResourceUnavailable("test".into()).is_retryable());
    }

    #[test]
    fn test_retryable_permanent_errors() {
        assert!(!TauriMCPError::ProtocolError("test".into()).is_retryable());
        assert!(!TauriMCPError::PermissionDenied("test".into()).is_retryable());
        assert!(!TauriMCPError::InvalidConfig("test".into()).is_retryable());
        assert!(!TauriMCPError::InternalError("test".into()).is_retryable());
    }

    #[test]
    fn test_io_error_connection_refused_retryable() {
        let io_err = std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "test");
        let err = TauriMCPError::from(io_err);
        assert!(err.is_retryable());
        assert_eq!(err.error_code(), 2000);
    }

    #[test]
    fn test_io_error_permission_denied_not_retryable() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "test");
        let err = TauriMCPError::from(io_err);
        assert!(!err.is_retryable());
        assert_eq!(err.error_code(), 2300);
    }
}
