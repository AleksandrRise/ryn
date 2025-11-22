use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::error::{Result, TauriMCPError};

/// JSON-RPC 2.0 Request
/// Used for method calls from MCP server to Tauri plugin
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcRequest {
    /// Always "2.0" for JSON-RPC 2.0
    pub jsonrpc: String,

    /// Method name to invoke
    pub method: String,

    /// Method parameters (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,

    /// Request ID for correlation (required for requests, omit for notifications)
    pub id: Value,
}

impl JsonRpcRequest {
    /// Create new request with auto-generated ID
    pub fn new(method: String, params: Option<Value>, id: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method,
            params,
            id,
        }
    }
}

/// JSON-RPC 2.0 Response (success)
/// Sent back to MCP server with result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcResponse {
    /// Always "2.0"
    pub jsonrpc: String,

    /// Result value (mutually exclusive with error)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,

    /// Error object (mutually exclusive with result)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,

    /// Request ID this response corresponds to
    pub id: Value,
}

impl JsonRpcResponse {
    /// Create success response
    pub fn success(result: Value, id: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            result: Some(result),
            error: None,
            id,
        }
    }

    /// Create error response
    pub fn error(error: JsonRpcError, id: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            result: None,
            error: Some(error),
            id,
        }
    }
}

/// JSON-RPC 2.0 Error object
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcError {
    /// Error code
    pub code: i32,

    /// Human-readable error message
    pub message: String,

    /// Additional error data (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcError {
    /// Standard JSON-RPC error codes
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;

    /// Create parse error (-32700)
    pub fn parse_error(message: impl Into<String>) -> Self {
        Self {
            code: Self::PARSE_ERROR,
            message: message.into(),
            data: None,
        }
    }

    /// Create invalid request error (-32600)
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: Self::INVALID_REQUEST,
            message: message.into(),
            data: None,
        }
    }

    /// Create method not found error (-32601)
    pub fn method_not_found(method: impl Into<String>) -> Self {
        Self {
            code: Self::METHOD_NOT_FOUND,
            message: format!("Method not found: {}", method.into()),
            data: None,
        }
    }

    /// Create invalid params error (-32602)
    pub fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: Self::INVALID_PARAMS,
            message: message.into(),
            data: None,
        }
    }

    /// Create internal error (-32603)
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self {
            code: Self::INTERNAL_ERROR,
            message: message.into(),
            data: None,
        }
    }

    /// Map TauriMCPError to JSON-RPC error
    pub fn from_mcp_error(err: &TauriMCPError) -> Self {
        Self {
            code: err.error_code(),
            message: err.to_string(),
            data: None,
        }
    }
}

/// JSON-RPC 2.0 Notification (no response expected)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcNotification {
    /// Always "2.0"
    pub jsonrpc: String,

    /// Method name
    pub method: String,

    /// Parameters (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl JsonRpcNotification {
    /// Create new notification (no ID = no response expected)
    pub fn new(method: String, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method,
            params,
        }
    }
}

/// Message framing: newline-delimited JSON
/// Each message is a complete JSON object followed by \n
pub struct MessageFramer;

impl MessageFramer {
    /// Parse newline-delimited messages from buffer
    /// Returns (parsed messages, remaining incomplete data)
    pub fn parse_messages(buffer: &str) -> (Vec<String>, String) {
        let mut messages = Vec::new();
        let mut remaining = String::new();

        // Split by newline
        let lines: Vec<&str> = buffer.split('\n').collect();

        // All but last line are complete messages
        for line in &lines[..lines.len().saturating_sub(1)] {
            if !line.trim().is_empty() {
                messages.push(line.to_string());
            }
        }

        // Last line might be incomplete
        if let Some(last) = lines.last() {
            if !last.is_empty() {
                remaining = last.to_string();
            }
        }

        (messages, remaining)
    }

    /// Frame a message: serialize to JSON and append newline
    pub fn frame_message<T: Serialize>(msg: &T) -> Result<String> {
        let json = serde_json::to_string(msg)
            .map_err(|e| TauriMCPError::ProtocolError(format!("Serialization failed: {}", e)))?;
        Ok(format!("{}\n", json))
    }

    /// Parse a single JSON-RPC message from string
    pub fn parse_json_rpc(msg: &str) -> Result<JsonRpcMessage> {
        // Try to parse as Value first to check structure
        let value: Value = serde_json::from_str(msg)
            .map_err(|e| TauriMCPError::ProtocolError(format!("JSON parse error: {}", e)))?;

        // Check if it has an "id" field (request/response vs notification)
        if value.get("id").is_some() {
            // Has ID - could be request or response
            if value.get("result").is_some() || value.get("error").is_some() {
                // Has result or error - it's a response
                let response: JsonRpcResponse = serde_json::from_value(value)
                    .map_err(|e| TauriMCPError::ProtocolError(format!("Invalid response: {}", e)))?;
                Ok(JsonRpcMessage::Response(response))
            } else {
                // Has method - it's a request
                let request: JsonRpcRequest = serde_json::from_value(value)
                    .map_err(|e| TauriMCPError::ProtocolError(format!("Invalid request: {}", e)))?;
                Ok(JsonRpcMessage::Request(request))
            }
        } else {
            // No ID - it's a notification
            let notification: JsonRpcNotification = serde_json::from_value(value)
                .map_err(|e| TauriMCPError::ProtocolError(format!("Invalid notification: {}", e)))?;
            Ok(JsonRpcMessage::Notification(notification))
        }
    }
}

/// Union type for JSON-RPC messages
#[derive(Debug, Clone, PartialEq)]
pub enum JsonRpcMessage {
    Request(JsonRpcRequest),
    Response(JsonRpcResponse),
    Notification(JsonRpcNotification),
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_request_serialization() {
        let req = JsonRpcRequest::new(
            "test_method".to_string(),
            Some(json!({"key": "value"})),
            json!(1),
        );
        let json = serde_json::to_string(&req).unwrap();
        let parsed: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req, parsed);
    }

    #[test]
    fn test_response_success_serialization() {
        let resp = JsonRpcResponse::success(json!({"status": "ok"}), json!(1));
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
    }

    #[test]
    fn test_response_error_serialization() {
        let error = JsonRpcError::internal_error("test error");
        let resp = JsonRpcResponse::error(error, json!(1));
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
    }

    #[test]
    fn test_notification_serialization() {
        let notif = JsonRpcNotification::new(
            "event".to_string(),
            Some(json!({"type": "update"})),
        );
        let json = serde_json::to_string(&notif).unwrap();
        let parsed: JsonRpcNotification = serde_json::from_str(&json).unwrap();
        assert_eq!(notif, parsed);
    }

    #[test]
    fn test_frame_single_message() {
        let req = JsonRpcRequest::new("test".to_string(), None, json!(1));
        let framed = MessageFramer::frame_message(&req).unwrap();
        assert!(framed.ends_with('\n'));
        assert!(framed.contains("\"jsonrpc\":\"2.0\""));
    }

    #[test]
    fn test_parse_single_complete_message() {
        let input = "{\"jsonrpc\":\"2.0\",\"method\":\"test\",\"id\":1}\n";
        let (messages, remaining) = MessageFramer::parse_messages(input);
        assert_eq!(messages.len(), 1);
        assert_eq!(remaining, "");
    }

    #[test]
    fn test_parse_multiple_messages() {
        let input = "{\"jsonrpc\":\"2.0\",\"method\":\"a\",\"id\":1}\n{\"jsonrpc\":\"2.0\",\"method\":\"b\",\"id\":2}\n";
        let (messages, remaining) = MessageFramer::parse_messages(input);
        assert_eq!(messages.len(), 2);
        assert_eq!(remaining, "");
    }

    #[test]
    fn test_parse_incomplete_message() {
        let input = "{\"jsonrpc\":\"2.0\",\"method\":\"test\"";
        let (messages, remaining) = MessageFramer::parse_messages(input);
        assert_eq!(messages.len(), 0);
        assert_eq!(remaining, "{\"jsonrpc\":\"2.0\",\"method\":\"test\"");
    }

    #[test]
    fn test_parse_mixed_complete_incomplete() {
        let input = "{\"jsonrpc\":\"2.0\",\"method\":\"a\",\"id\":1}\n{\"jsonrpc\":\"2.0\",\"method\":\"b\"";
        let (messages, remaining) = MessageFramer::parse_messages(input);
        assert_eq!(messages.len(), 1);
        assert_eq!(remaining, "{\"jsonrpc\":\"2.0\",\"method\":\"b\"");
    }

    #[test]
    fn test_parse_empty_lines() {
        let input = "{\"jsonrpc\":\"2.0\",\"method\":\"a\",\"id\":1}\n\n{\"jsonrpc\":\"2.0\",\"method\":\"b\",\"id\":2}\n";
        let (messages, remaining) = MessageFramer::parse_messages(input);
        assert_eq!(messages.len(), 2);
        assert_eq!(remaining, "");
    }

    #[test]
    fn test_json_rpc_parse_request() {
        let msg = "{\"jsonrpc\":\"2.0\",\"method\":\"test\",\"id\":1}";
        let parsed = MessageFramer::parse_json_rpc(msg).unwrap();
        match parsed {
            JsonRpcMessage::Request(req) => {
                assert_eq!(req.method, "test");
                assert_eq!(req.id, json!(1));
            }
            _ => panic!("Expected request"),
        }
    }

    #[test]
    fn test_json_rpc_parse_response() {
        let msg = "{\"jsonrpc\":\"2.0\",\"result\":{\"status\":\"ok\"},\"id\":1}";
        let parsed = MessageFramer::parse_json_rpc(msg).unwrap();
        match parsed {
            JsonRpcMessage::Response(resp) => {
                assert_eq!(resp.result, Some(json!({"status": "ok"})));
                assert_eq!(resp.id, json!(1));
            }
            _ => panic!("Expected response"),
        }
    }

    #[test]
    fn test_json_rpc_parse_error_response() {
        let msg = "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32603,\"message\":\"Internal error\"},\"id\":1}";
        let parsed = MessageFramer::parse_json_rpc(msg).unwrap();
        match parsed {
            JsonRpcMessage::Response(resp) => {
                assert!(resp.error.is_some());
                assert_eq!(resp.error.unwrap().code, -32603);
            }
            _ => panic!("Expected response"),
        }
    }

    #[test]
    fn test_json_rpc_parse_notification() {
        let msg = "{\"jsonrpc\":\"2.0\",\"method\":\"notify\",\"params\":{\"event\":\"update\"}}";
        let parsed = MessageFramer::parse_json_rpc(msg).unwrap();
        match parsed {
            JsonRpcMessage::Notification(notif) => {
                assert_eq!(notif.method, "notify");
                assert_eq!(notif.params, Some(json!({"event": "update"})));
            }
            _ => panic!("Expected notification"),
        }
    }

    #[test]
    fn test_error_codes() {
        assert_eq!(JsonRpcError::parse_error("test").code, -32700);
        assert_eq!(JsonRpcError::invalid_request("test").code, -32600);
        assert_eq!(JsonRpcError::method_not_found("test").code, -32601);
        assert_eq!(JsonRpcError::invalid_params("test").code, -32602);
        assert_eq!(JsonRpcError::internal_error("test").code, -32603);
    }

    #[test]
    fn test_mcp_error_mapping() {
        let err = TauriMCPError::Timeout("test".to_string());
        let json_err = JsonRpcError::from_mcp_error(&err);
        assert_eq!(json_err.code, 2002);
        assert!(json_err.message.contains("Timeout"));
    }

    #[test]
    fn test_invalid_json() {
        let msg = "not valid json";
        let result = MessageFramer::parse_json_rpc(msg);
        assert!(result.is_err());
    }

    #[test]
    fn test_incomplete_json_rpc() {
        let msg = "{\"jsonrpc\":\"2.0\"}"; // Missing method/result/error and id
        let result = MessageFramer::parse_json_rpc(msg);
        // Should fail due to missing required fields
        assert!(result.is_err());
    }
}
