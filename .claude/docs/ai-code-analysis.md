# AI Code Analysis Integration with Rust

**Sources:** Web search results, reqwest documentation, API security best practices
**Retrieved:** 2025-11-10
**Topics:** Claude API, OpenAI API, Rust HTTP clients, code vulnerability detection, security patterns

---

## Overview

This guide covers integrating Claude or OpenAI APIs into Rust applications for code analysis and vulnerability detection. The approach uses async HTTP clients (reqwest) with proper error handling, environment-based secret management, and structured request/response serialization.

---

## HTTP Clients for Rust

### Reqwest: The Recommended Choice

**Reqwest** is an ergonomic, async HTTP client built on Hyper that simplifies API consumption:

- **Async/await support** via Tokio runtime
- **Easy JSON serialization** with serde integration
- **Connection pooling** with keep-alive support
- **Automatic GZIP decompression**
- **Fluent API** for chainable request building

#### Basic Setup

```toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
dotenv = "0.15"  # For environment variables in development
secrecy = "0.10" # For secure secret handling
```

#### Core Pattern: Client Reuse

Always reuse Client instances to leverage connection pooling:

```rust
use reqwest::Client;
use std::sync::Arc;

struct ApiClient {
    client: Arc<Client>,
    api_key: String,
    base_url: String,
}

impl ApiClient {
    pub fn new(api_key: String, base_url: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            api_key,
            base_url,
        }
    }
}
```

---

## Claude API Integration

### Unofficial Claude Rust Client: `clust`

The `clust` crate provides a high-level Rust wrapper for Anthropic's Claude API:

#### Installation

```toml
[dependencies]
clust = "0.4"
tokio = { version = "1", features = ["full"] }
```

#### Basic Usage

```rust
use clust::Client;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load from ANTHROPIC_API_KEY environment variable
    let client = Client::from_env()?;
    
    let messages = vec![
        clust::messages::MessageInput {
            role: clust::messages::Role::User,
            content: "Analyze this code for security issues...".into(),
        },
    ];
    
    let response = client.create_a_message(
        "claude-3-5-sonnet-20241022",
        10_000,
        messages,
    ).await?;
    
    println!("{:?}", response);
    Ok(())
}
```

#### Custom Client with Timeout

```rust
use clust::{Client, ClientBuilder, messages::ApiKey};
use std::time::Duration;

let client = ClientBuilder::new(ApiKey::new("your-api-key"))
    .client(
        reqwest::ClientBuilder::new()
            .timeout(Duration::from_secs(30))
            .build()?
    )
    .build();
```

### Direct reqwest Implementation

For more control, implement Claude API calls directly with reqwest:

```rust
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    id: String,
    content: Vec<ContentBlock>,
    usage: Usage,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: String,
}

#[derive(Deserialize)]
struct Usage {
    input_tokens: u32,
    output_tokens: u32,
}

pub async fn analyze_code_with_claude(
    client: &Client,
    api_key: &str,
    code: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let request = ClaudeRequest {
        model: "claude-3-5-sonnet-20241022".to_string(),
        max_tokens: 2048,
        messages: vec![Message {
            role: "user".to_string(),
            content: format!(
                "Analyze this code for SOC 2 compliance violations:\n\n{}",
                code
            ),
        }],
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    let claude_response: ClaudeResponse = response.json().await?;
    
    Ok(claude_response
        .content
        .first()
        .map(|c| c.text.clone())
        .unwrap_or_default())
}
```

---

## OpenAI API Integration

### Using the `openai-api-rust` Crate

```toml
[dependencies]
openai-api-rust = "1.0"
tokio = { version = "1", features = ["full"] }
```

### Manual Implementation with reqwest

```rust
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
    usage: TokenUsage,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

pub async fn analyze_code_with_openai(
    client: &Client,
    api_key: &str,
    code: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let request = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are a SOC 2 compliance expert analyzing code for security violations.".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Analyze this code for SOC 2 compliance issues:\n\n{}",
                    code
                ),
            },
        ],
        temperature: 0.2,
        max_tokens: 2048,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    let openai_response: OpenAIResponse = response.json().await?;
    
    Ok(openai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default())
}
```

---

## Security Best Practices

### 1. Environment Variable Management

Never hardcode API keys. Use environment variables:

```rust
use std::env;

fn get_api_key() -> Result<String, env::VarError> {
    env::var("ANTHROPIC_API_KEY")
}

// Or with better error handling:
fn load_config() -> Result<Config, Box<dyn std::error::Error>> {
    Ok(Config {
        api_key: env::var("ANTHROPIC_API_KEY")
            .map_err(|_| "ANTHROPIC_API_KEY not set")?,
        base_url: env::var("API_BASE_URL")
            .unwrap_or_else(|_| "https://api.anthropic.com".to_string()),
    })
}
```

#### .env File (Development Only)

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
API_BASE_URL=https://api.anthropic.com
```

**IMPORTANT:** Add `.env` to `.gitignore` to prevent accidental secret commits:

```gitignore
.env
.env.local
*.pem
secrets/
```

### 2. Secure Secret Storage with `secrecy`

The `secrecy` crate prevents secrets from being logged or exposed in memory dumps:

```rust
use secrecy::{Secret, SecretString};

struct ApiConfig {
    api_key: Secret<String>,
}

impl ApiConfig {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key: Secret::new(api_key),
        }
    }
    
    pub fn api_key(&self) -> &Secret<String> {
        &self.api_key
    }
}

// Secrets are automatically zeroed from memory when dropped
// Debug output redacts the actual value
```

### 3. HTTPS Only

Always use HTTPS for API calls. Reqwest defaults to HTTPS:

```rust
// Good: HTTPS enforced
let response = client
    .post("https://api.anthropic.com/v1/messages")
    .send()
    .await?;

// Bad: HTTP allows interception
// Don't use: http://api.example.com
```

### 4. Request Validation & Sanitization

Validate inputs before sending to API:

```rust
fn validate_code_input(code: &str) -> Result<(), String> {
    const MAX_CODE_LENGTH: usize = 50_000;
    
    if code.is_empty() {
        return Err("Code cannot be empty".to_string());
    }
    
    if code.len() > MAX_CODE_LENGTH {
        return Err(format!(
            "Code exceeds maximum length of {} characters",
            MAX_CODE_LENGTH
        ));
    }
    
    Ok(())
}
```

### 5. Rate Limiting & Timeout Configuration

Implement timeouts to prevent hanging requests:

```rust
use std::time::Duration;

let client = reqwest::ClientBuilder::new()
    .timeout(Duration::from_secs(30))
    .connect_timeout(Duration::from_secs(10))
    .build()?;
```

For rate limiting, implement exponential backoff:

```rust
async fn retry_with_backoff<F, T>(
    mut f: F,
    max_retries: u32,
) -> Result<T, Box<dyn std::error::Error>>
where
    F: FnMut() -> futures::future::BoxFuture<'static, Result<T, Box<dyn std::error::Error>>>,
{
    let mut retries = 0;
    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if retries < max_retries => {
                let wait_secs = 2_u64.pow(retries);
                tokio::time::sleep(Duration::from_secs(wait_secs)).await;
                retries += 1;
            }
            Err(e) => return Err(e),
        }
    }
}
```

---

## Code Analysis Architecture Pattern

### Complete Example: Vulnerability Scanner

```rust
use serde::{Deserialize, Serialize};
use std::error::Error;
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeAnalysisRequest {
    pub code: String,
    pub language: String,
    pub framework: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub violations: Vec<Violation>,
    pub severity_summary: SeveritySummary,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Violation {
    pub id: String,
    pub severity: String,  // critical, high, medium, low
    pub rule: String,
    pub description: String,
    pub line_number: Option<usize>,
    pub code_snippet: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeveritySummary {
    pub critical: usize,
    pub high: usize,
    pub medium: usize,
    pub low: usize,
}

pub struct CodeAnalyzer {
    client: Client,
    api_key: String,
    model: String,
}

impl CodeAnalyzer {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
        }
    }

    pub async fn analyze(
        &self,
        request: CodeAnalysisRequest,
    ) -> Result<AnalysisResult, Box<dyn Error>> {
        // Validate input
        validate_code_input(&request.code)?;

        // Prepare prompt
        let prompt = format!(
            r#"Analyze the following {} code for SOC 2 compliance violations.
Framework: {}
Look for:
- Missing audit logging
- Weak access controls
- Hardcoded secrets
- SQL injection vulnerabilities
- Missing input validation

Code:
```{}
{}
```

Return JSON response with structure:
{{
  "violations": [
    {{"id": "...", "severity": "critical|high|medium|low", "rule": "...", "description": "...", "line_number": null}}
  ],
  "severity_summary": {{"critical": 0, "high": 0, "medium": 0, "low": 0}},
  "recommendations": ["..."]
}}
"#,
            request.language,
            request.framework.as_deref().unwrap_or("none"),
            request.language,
            request.code
        );

        // Call API
        let response = self.call_api(&prompt).await?;
        
        // Parse and return
        Ok(serde_json::from_str(&response)?)
    }

    async fn call_api(&self, prompt: &str) -> Result<String, Box<dyn Error>> {
        #[derive(Serialize)]
        struct ApiMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct ApiRequest {
            model: String,
            max_tokens: u32,
            messages: Vec<ApiMessage>,
        }

        #[derive(Deserialize)]
        struct ApiResponse {
            content: Vec<ResponseContent>,
        }

        #[derive(Deserialize)]
        struct ResponseContent {
            text: String,
        }

        let request = ApiRequest {
            model: self.model.clone(),
            max_tokens: 4096,
            messages: vec![ApiMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await?;

        let api_response: ApiResponse = response.json().await?;
        
        Ok(api_response
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default())
    }
}

fn validate_code_input(code: &str) -> Result<(), Box<dyn Error>> {
    const MAX_LENGTH: usize = 100_000;
    
    if code.is_empty() {
        return Err("Code cannot be empty".into());
    }
    
    if code.len() > MAX_LENGTH {
        return Err(format!("Code exceeds {} character limit", MAX_LENGTH).into());
    }
    
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")?;
    let analyzer = CodeAnalyzer::new(
        api_key,
        "claude-3-5-sonnet-20241022".to_string(),
    );

    let result = analyzer
        .analyze(CodeAnalysisRequest {
            code: "SELECT * FROM users WHERE id = ${user_id}".to_string(),
            language: "sql".to_string(),
            framework: Some("PostgreSQL".to_string()),
        })
        .await?;

    println!("{:#?}", result);
    Ok(())
}
```

---

## Chunking Large Files

For large codebases, send files in chunks to stay within token limits:

```rust
pub async fn analyze_large_codebase(
    analyzer: &CodeAnalyzer,
    files: Vec<(String, String)>, // (path, code)
) -> Result<Vec<AnalysisResult>, Box<dyn Error>> {
    let mut results = Vec::new();
    const CHUNK_SIZE: usize = 30_000;

    for (path, code) in files {
        // Split into chunks
        let chunks: Vec<&str> = code
            .chars()
            .collect::<Vec<_>>()
            .chunks(CHUNK_SIZE)
            .map(|c| std::str::from_utf8(&c.iter().collect::<Vec<_>>()))
            .collect::<Result<Vec<_>, _>>()?;

        for (idx, chunk) in chunks.iter().enumerate() {
            let request = CodeAnalysisRequest {
                code: chunk.to_string(),
                language: "rust".to_string(),
                framework: None,
            };

            let result = analyzer.analyze(request).await?;
            results.push(result);
        }
    }

    Ok(results)
}
```

---

## Error Handling Best Practices

```rust
use std::fmt;

#[derive(Debug)]
pub enum AnalysisError {
    ApiError(String),
    InvalidInput(String),
    ParseError(String),
    NetworkError(String),
}

impl fmt::Display for AnalysisError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::ApiError(msg) => write!(f, "API error: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
        }
    }
}

impl std::error::Error for AnalysisError {}

// Usage
match analyzer.analyze(request).await {
    Ok(result) => println!("{:#?}", result),
    Err(e) => eprintln!("Analysis failed: {}", e),
}
```

---

## Tauri Integration

For the Ryn application (Tauri desktop app), implement analysis in `src-tauri/src/main.rs`:

```rust
use tauri::command;

#[command]
pub async fn scan_code(
    code: String,
    language: String,
) -> Result<serde_json::Value, String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "API key not configured".to_string())?;
    
    let analyzer = CodeAnalyzer::new(
        api_key,
        "claude-3-5-sonnet-20241022".to_string(),
    );

    let request = CodeAnalysisRequest {
        code,
        language,
        framework: None,
    };

    let result = analyzer
        .analyze(request)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(result)?)
}
```

Expose in Tauri builder:

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scan_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Dependencies Summary

### Recommended Cargo.toml

```toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
secrecy = "0.10"
dotenv = "0.15"
```

### Optional for Claude Integration

```toml
clust = "0.4"  # Unofficial Claude client
```

---

## Performance Considerations

1. **Connection Pooling**: Reqwest reuses TCP connections via keep-alive
2. **Async Concurrency**: Use `tokio::join!` to parallelize independent API calls
3. **Streaming**: For large responses, use streaming instead of buffering
4. **Caching**: Cache analysis results for identical code snippets

---

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_code_input() {
        assert!(validate_code_input("valid code").is_ok());
        assert!(validate_code_input("").is_err());
        assert!(validate_code_input(&"x".repeat(101_000)).is_err());
    }

    #[tokio::test]
    async fn test_api_request_structure() {
        let request = CodeAnalysisRequest {
            code: "let x = 1;".to_string(),
            language: "rust".to_string(),
            framework: None,
        };
        
        assert!(!request.code.is_empty());
        assert_eq!(request.language, "rust");
    }
}
```

---

## References

- Claude API Docs: https://docs.anthropic.com
- OpenAI API Docs: https://platform.openai.com/docs
- Reqwest GitHub: https://github.com/seanmonstar/reqwest
- Secrecy Crate: https://crates.io/crates/secrecy
- Tokio Async Runtime: https://tokio.rs

