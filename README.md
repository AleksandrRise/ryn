# Ryn - AI-Powered SOC 2 Compliance Scanner

Ryn is a desktop application that automatically scans your codebase for SOC 2 compliance violations using hybrid detection (regex + AI) and generates AI-powered fixes using Grok. It helps development teams maintain security compliance by identifying issues like missing audit logs, weak access controls, and hardcoded secrets.

## Features

- **Automated Code Scanning**: Detects compliance violations in Python and JavaScript/TypeScript codebases
- **AI-Generated Fixes**: Uses Grok to generate context-aware fixes for violations
- **One-Click Apply**: Apply fixes directly to your codebase with automatic git commits
- **Compliance Dashboard**: Track your overall compliance score and violation trends
- **SOC 2 Controls**: Covers critical controls including CC6.1, CC6.7, CC7.2, and A1.2
- **Audit Trail**: Complete history of all scans, violations, and applied fixes

## Prerequisites

- macOS, Windows, or Linux
- Node.js 18+ and pnpm
- Rust 1.70+ (for development only)
- Git (for automatic commit creation)
- X.AI API key (for AI fix generation)

## Installation

### From Release (Recommended)

1. Download the latest release for your platform from the [Releases page](https://github.com/yourusername/ryn/releases)
2. Install the application:
   - **macOS**: Open the .dmg file and drag Ryn to Applications
   - **Windows**: Run the .msi installer
   - **Linux**: Use the .AppImage or .deb package

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/ryn.git
cd ryn

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Configuration

### Setting up Grok API Key (Required)

Ryn uses Grok to generate fixes for compliance violations. You'll need an X.AI API key:

1. **Get an API Key**:
   - Sign up at [console.x.ai](https://console.x.ai)
   - Navigate to API Keys section
   - Create a new API key

2. **Configure the API Key**:

   **Option A: Environment Variable (Recommended)**
   ```bash
   # Create a .env file in the application directory
   cp .env.example .env

   # Edit .env and add your API key
   XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
   ```

   **Option B: System Environment Variable**
   ```bash
   # macOS/Linux - Add to ~/.bashrc or ~/.zshrc
   export XAI_API_KEY="xai-xxxxxxxxxxxxxxxxxxxx"

   # Windows - Set via System Properties or PowerShell
   [System.Environment]::SetEnvironmentVariable("XAI_API_KEY", "xai-xxxxxxxxxxxxxxxxxxxx", "User")
   ```

3. **Restart the Application** after setting the API key

## Usage

### Quick Start

1. **Launch Ryn** from your Applications folder or desktop shortcut

2. **Select a Project**:
   - Click "Select Project Folder"
   - Choose the root directory of your codebase
   - Ryn will auto-detect your framework (Django, Flask, Express, FastAPI)

3. **Run a Scan**:
   - Click the "Start Scan" button
   - Watch the progress bar as Ryn analyzes your code
   - Review violations found in the results table

4. **Generate Fixes**:
   - Click on any violation to see details
   - Click "Generate AI Fix" to get a suggested solution
   - Review the fix diff
   - Click "Apply Fix" to update your code

5. **Track Progress**:
   - View your compliance score on the dashboard
   - Check the audit trail for all actions taken
   - Export reports for compliance documentation

### Supported Frameworks

- **Python**: Django, Flask, FastAPI
- **JavaScript/TypeScript**: Express, Next.js, Node.js

### SOC 2 Controls Checked

- **CC6.1**: Logical and Physical Access Controls
- **CC6.7**: Transmission and Movement of Information
- **CC7.2**: System Monitoring
- **A1.2**: System Inputs

## Scanning Modes

Ryn offers three scanning modes to balance detection accuracy with cost. Configure your preferred mode in **Settings > AI Scanning**.

### 1. Pattern Only (regex_only)
- **Best for**: Quick scans, CI/CD pipelines, budget-conscious teams
- **How it works**: Uses regex patterns to detect known SOC 2 violations
- **Cost**: Free (no AI analysis)
- **Speed**: Instant (< 1 second for most codebases)
- **Detection**: Fast detection of common patterns like hardcoded secrets, missing auth decorators
- **Limitations**: May miss complex semantic violations

### 2. Smart (Recommended)
- **Best for**: Most teams, balanced accuracy and cost
- **How it works**: Combines regex patterns with AI analysis of ~30-40% of files
- **File Selection**: AI analyzes only security-critical files (auth, database, API endpoints, crypto)
- **Cost**: ~$0.10-0.50 per scan for typical projects
- **Speed**: 2-5 minutes for medium-sized codebases
- **Detection**: Hybrid detection merges regex and AI findings for maximum coverage
- **Confidence Scores**: AI violations include confidence scores (0-1.0)

### 3. Analyze All
- **Best for**: Pre-audit scans, maximum compliance assurance
- **How it works**: AI analyzes every file in your codebase
- **Cost**: ~$1-5 per scan depending on codebase size
- **Speed**: 5-15 minutes for medium-sized codebases
- **Detection**: Highest accuracy, catches semantic violations regex can't detect
- **Use case**: Run before SOC 2 audits or quarterly compliance reviews

### Cost Limits

Set a cost limit per scan in Settings (default: $5.00). Ryn will:
1. Track token usage and costs in real-time
2. Pause scanning if limit is reached
3. Prompt you to continue or stop
4. Save all violations found so far if you stop

View detailed cost analytics in the **Analytics** dashboard.

### Detection Method Badges

Violations are tagged with how they were detected:
- Pattern: Found by regex patterns
- AI: Found by Grok Code Fast analysis
- Hybrid: Found by both methods (highest confidence)

Hybrid violations display both regex pattern explanations and AI reasoning.

## Troubleshooting

### Common Issues

**"XAI_API_KEY environment variable not set"**
- Ensure you've set the API key as described above
- Restart the application after setting the key
- Check the key starts with `sk-ant-`

**"Failed to initialize database"**
- Ryn needs write permissions in its data directory
- On macOS: `~/Library/Application Support/com.ryn.app/`
- On Windows: `%APPDATA%\com.ryn.app\`
- On Linux: `~/.config/com.ryn.app/`

**"Scan failed" errors**
- Ensure you have read permissions for all files in the project
- Check that the project path doesn't contain special characters
- Verify Git is installed if applying fixes

**High API costs**
- Ryn uses Grok Code Fast by default (most cost-effective)
- Each fix generation costs approximately $0.001-0.003
- Consider fixing violations in batches to reduce API calls

## Development

### Project Structure

```
ryn/
├─ app/            # Next.js app routes and top-level layout
├─ components/     # Feature-first React components (dashboard, scan, violation, ui)
├─ lib/            # Shared utils, domain types, Tauri IPC helpers
├─ src-tauri/      # Rust backend (commands, scanner, db, git helpers)
├─ public/         # Static assets
└─ package.json
```

### Running Tests

```bash
# Frontend tests
pnpm test

# Rust tests
cd src-tauri && cargo test

# E2E tests (coming soon)
pnpm test:e2e
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- API keys are never stored in the database or logs
- All file operations use path validation to prevent traversal attacks
- Database queries use parameterized statements
- Automatic backups before applying fixes (coming soon)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ryn/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ryn/discussions)
- **Email**: support@ryn.app

## Roadmap

- [ ] Windows code signing
- [ ] Rate limiting for API calls
- [ ] Async scanning with cancellation
- [ ] Custom compliance rules
- [ ] Team collaboration features
- [ ] CI/CD integration
- [ ] Export to PDF reports

---

Built with d using [Tauri](https://tauri.app), [Next.js](https://nextjs.org), and [Grok](https://x.ai)
