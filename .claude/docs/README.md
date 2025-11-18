# Documentation Index

This folder contains comprehensive documentation for the Ryn project implementation.

---

## Files

### 1. **tauri.md** (589 lines)
Complete Tauri framework documentation covering:
- Application setup and configuration
- Window and webview management
- Event handling and initialization
- Platform-specific features (macOS, Windows, Linux)
- Configuration file structure (tauri.conf.json)
- Window builder API
- Common patterns and error handling

**Use when:** Building desktop UI features, configuring windows, handling app lifecycle

---

### 2. **ai-code-analysis.md** (820 lines)
Comprehensive guide for AI API integration in Rust:

**Sections:**
- HTTP client comparison (reqwest vs alternatives)
- Grok API integration (clust crate + direct reqwest)
- OpenAI API integration (openai-api-rust + direct reqwest)
- Security best practices (env vars, secrecy crate, HTTPS, validation)
- Complete vulnerability scanner example (150+ lines)
- Error handling patterns
- Large file chunking strategies
- Exponential backoff retry logic
- Tauri command integration examples
- Performance considerations
- Testing patterns

**Use when:** Implementing code analysis backend, integrating Grok/OpenAI APIs, handling secrets

---

### 3. **api-integration-summary.md** (240 lines)
Quick reference guide with:
- Recommended tech stack and versions
- Three implementation approaches comparison
- Critical security patterns
- Essential code patterns
- Integration checklist
- Common pitfalls
- Configuration requirements

**Use when:** Starting API integration, quick lookup, decision-making

---

## Quick Start

### For Backend Implementation (Rust/Tauri)

1. Read: `api-integration-summary.md` (5 min overview)
2. Read: `ai-code-analysis.md` (30 min deep dive)
3. Reference: Code examples in `ai-code-analysis.md` for implementation

### For Frontend/Tauri UI Features

1. Read: `tauri.md` for desktop app architecture
2. Reference: Window management and event handling sections

### For Full Context

Start with API integration summary → dive into ai-code-analysis.md → reference tauri.md for desktop integration

---

## Key Dependencies

```toml
# HTTP & Async
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Security
secrecy = "0.10"
dotenv = "0.15"

# API Clients (optional)
clust = "0.4"  # Grok API wrapper
```

---

## Critical Patterns

### Security
- Never hardcode API keys
- Use environment variables + secrecy crate
- Validate inputs before API calls
- HTTPS only for API endpoints

### Performance
- Reuse HTTP Client instances
- Use async/await with tokio
- Implement connection pooling
- Chunk large files (50KB max)

### Error Handling
- Custom error enum
- Implement retry with exponential backoff
- Proper timeout configuration
- Graceful degradation

---

## Integration Points with Ryn

### Tauri Commands
In `src-tauri/src/main.rs`, implement:
```rust
#[command]
pub async fn scan_code(code: String, language: String) -> Result<Value, String>
```

### Environment Variables
Required for runtime:
- `XAI_API_KEY` - Grok API authentication
- `API_BASE_URL` - Optional, defaults to X.AI endpoint

### Frontend Communication
Frontend calls via IPC:
```typescript
await invoke('scan_code', { code, language })
```

---

## Testing Strategy

- Unit tests for input validation
- Mock HTTP responses with wiremock
- Integration tests with rate limiting
- End-to-end tests with actual API (use test key)

---

## References

- Grok API: https://docs.anthropic.com
- OpenAI API: https://platform.openai.com/docs
- Reqwest: https://github.com/seanmonstar/reqwest
- Tauri: https://tauri.app
- Tokio: https://tokio.rs

