# AI API Integration Summary for Ryn Backend

**Quick Reference for Rust + AI Code Analysis**

---

## Recommended Tech Stack

HTTP Client: **reqwest 0.12**
Runtime: **tokio 1.x**
API Choice: **Claude API** (via clust or direct reqwest)
Secret Management: **secrecy + dotenv**

---

## Key Libraries & Versions

```toml
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
secrecy = "0.10"
dotenv = "0.15"
clust = "0.4"  # Optional: High-level Claude wrapper
```

---

## Three Implementation Approaches

### 1. Direct reqwest (Most Control)
- Raw HTTP calls to API endpoints
- Full customization of headers, timeouts, retries
- ~100 lines of code for complete implementation
- Best for: Custom error handling, advanced features

### 2. clust Crate (Best Developer Experience)
- Unofficial but well-maintained Claude client
- High-level abstractions for common tasks
- Automatic serialization/deserialization
- Best for: Quick integration, less boilerplate

### 3. Official OpenAI SDK
- openai-api-rust crate available
- Similar API to clust
- More ecosystem support
- Best for: If switching APIs in future

---

## Critical Security Patterns

1. **Never hardcode API keys**
   ```rust
   let api_key = std::env::var("ANTHROPIC_API_KEY")?;
   ```

2. **Use secrecy for in-memory protection**
   ```rust
   use secrecy::{Secret, SecretString};
   let key = Secret::new(api_key);  // Auto-zeroed on drop
   ```

3. **HTTPS Only**
   All calls must use https:// endpoints

4. **Request Validation**
   Validate code input size before API call (max 50-100KB)

5. **Timeout Configuration**
   Default: 30s timeout, 10s connect timeout

---

## Essential Code Patterns

### Client Setup
```rust
let client = reqwest::Client::new();  // Reuse across requests

// Or with custom config:
let client = reqwest::ClientBuilder::new()
    .timeout(Duration::from_secs(30))
    .build()?;
```

### API Request Structure
```rust
#[derive(Serialize)]
struct ApiRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Deserialize)]
struct ApiResponse {
    content: Vec<ContentBlock>,
}
```

### Claude-Specific Headers
```rust
.header("x-api-key", api_key)
.header("anthropic-version", "2023-06-01")
.header("content-type", "application/json")
```

---

## Performance Best Practices

1. **Reuse Clients**: Don't create new Client per request
2. **Connection Pooling**: Reqwest handles automatically
3. **Async/Await**: Use tokio::spawn for concurrent analysis
4. **Chunking**: Split large files (>50KB) into multiple requests
5. **Caching**: Cache results for identical inputs

---

## Error Handling Strategy

```rust
pub enum AnalysisError {
    ApiError(String),        // API returned error
    InvalidInput(String),    // Code too large/empty
    ParseError(String),      // JSON deserialization failed
    NetworkError(String),    // Timeout/connection failed
}
```

Implement with anyhow::Result<T> or custom Result type.

---

## Integration with Ryn (Tauri)

Add to `src-tauri/src/main.rs`:

```rust
#[command]
pub async fn scan_code(
    code: String,
    language: String,
) -> Result<serde_json::Value, String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|e| e.to_string())?;
    
    let analyzer = CodeAnalyzer::new(api_key, "claude-3-5-sonnet-20241022".into());
    let result = analyzer.analyze(CodeAnalysisRequest { code, language, framework: None })
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::to_value(result)?)
}
```

Expose via:
```rust
.invoke_handler(tauri::generate_handler![scan_code])
```

---

## Configuration Checklist

- [ ] Add .env to .gitignore
- [ ] Set ANTHROPIC_API_KEY in environment
- [ ] Configure request timeout (30s recommended)
- [ ] Validate input before API call
- [ ] Implement error handling
- [ ] Add retry logic with exponential backoff
- [ ] Test with rate limiting
- [ ] Monitor token usage
- [ ] Log API errors (not secrets)

---

## API Response Parsing

Prompt API to return structured JSON:

```
Return JSON response with structure:
{
  "violations": [
    {
      "id": "RULE_001",
      "severity": "critical|high|medium|low",
      "rule": "HARDCODED_SECRET",
      "description": "...",
      "line_number": 42,
      "code_snippet": "api_key = '...'"
    }
  ],
  "severity_summary": { "critical": 1, "high": 2, "medium": 0, "low": 3 },
  "recommendations": ["..."]
}
```

---

## Testing Considerations

- Mock HTTP responses with wiremock
- Test input validation separately
- Test JSON parsing with invalid data
- Test timeout behavior
- Test with rate limiting

---

## Common Pitfalls to Avoid

1. Creating new Client instances per request (memory leak)
2. Hardcoding secrets in source code
3. No input validation before API call
4. Ignoring timeouts (hanging forever)
5. Not retrying on transient errors
6. Logging API secrets
7. Sending unvalidated user input to API
8. Not handling rate limits (429 responses)

---

## Documentation References

Full implementation examples in: `/Users/alexanderershov/Desktop/Coding folder/Projects/ryn/.claude/docs/ai-code-analysis.md`

Key sections:
- Complete vulnerability scanner example (150+ lines)
- Claude API integration patterns
- OpenAI API integration patterns
- Security best practices with code examples
- Tauri integration example
- Error handling patterns
- Large file chunking strategy
- Exponential backoff retry logic

