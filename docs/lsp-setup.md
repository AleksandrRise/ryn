# Ryn LSP Server Setup

Ryn includes an embedded Language Server Protocol (LSP) server that displays SOC 2 violations as IDE diagnostics.

## Quick Start

**Option A: Start from GUI (Recommended)**
1. Open Ryn → Settings → IDE Integration
2. Click "Start LSP Server"
3. Configure your IDE to connect via TCP (see below)

**Option B: Start from Terminal**
1. Run `ryn --lsp` (stdio mode, IDE spawns the process)
2. Configure your IDE to use `ryn --lsp` as the language server

## Server Modes

Ryn LSP supports two communication modes:

| Mode | Command | Use Case |
|------|---------|----------|
| **TCP** | `ryn --lsp --tcp --port 9257` | GUI-managed, IDE connects via network |
| **stdio** | `ryn --lsp` | IDE spawns and manages the process |

When you start the LSP from the Ryn GUI, it runs in TCP mode on port 9257. IDEs connect to `tcp://127.0.0.1:9257`.

## How It Works

The LSP server reads violations from Ryn's SQLite database and displays them as diagnostics in your IDE. It:

- Shows violations as warnings/errors in the editor
- Highlights the specific function or class name where the violation occurs
- Displays violation details on hover
- Updates diagnostics when you save files

## IDE Configuration

### VS Code

**TCP Mode (GUI-managed):**

If using an LSP client that supports TCP connections, configure it to connect to `127.0.0.1:9257`.

**stdio Mode:**

Add to your `settings.json`:

```json
{
  "lsp.servers": {
    "ryn": {
      "command": ["ryn", "--lsp"],
      "filetypes": ["python", "javascript", "typescript"]
    }
  }
}
```

Or if using a generic LSP client extension:

```json
{
  "languageServerExample.serverPath": "ryn",
  "languageServerExample.serverArgs": ["--lsp"]
}
```

### Neovim (with nvim-lspconfig)

**TCP Mode (GUI-managed):**

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.ryn then
  configs.ryn = {
    default_config = {
      cmd = vim.lsp.rpc.connect('127.0.0.1', 9257),
      filetypes = { 'python', 'javascript', 'typescript' },
      root_dir = lspconfig.util.root_pattern('.git', 'package.json', 'pyproject.toml'),
    },
  }
end

lspconfig.ryn.setup({})
```

**stdio Mode:**

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.ryn then
  configs.ryn = {
    default_config = {
      cmd = { 'ryn', '--lsp' },
      filetypes = { 'python', 'javascript', 'typescript' },
      root_dir = lspconfig.util.root_pattern('.git', 'package.json', 'pyproject.toml'),
    },
  }
end

lspconfig.ryn.setup({})
```

### Helix

Add to `~/.config/helix/languages.toml`:

```toml
[[language]]
name = "python"
language-servers = ["ryn"]

[[language]]
name = "javascript"
language-servers = ["ryn"]

[[language]]
name = "typescript"
language-servers = ["ryn"]

[language-server.ryn]
command = "ryn"
args = ["--lsp"]
```

### Zed

Add to your Zed settings:

```json
{
  "lsp": {
    "ryn": {
      "binary": {
        "path": "ryn",
        "arguments": ["--lsp"]
      }
    }
  }
}
```

## Severity Mapping

Ryn violation severities map to LSP diagnostic severities as follows:

| Ryn Severity | LSP Severity | IDE Display |
|--------------|--------------|-------------|
| critical     | Error        | Red underline |
| high         | Error        | Red underline |
| medium       | Warning      | Yellow underline |
| low          | Information  | Blue underline |

## Troubleshooting

### No diagnostics appearing

1. Make sure you've scanned the project with Ryn first (violations must exist in the database)
2. Check that the file paths match (the project must be opened from the same root directory used during scanning)
3. Verify the LSP server is running: check your IDE's LSP logs

### Wrong file highlighted

The LSP server uses relative file paths. Make sure you open your project from the same root directory that was scanned.

### Database locked errors

If you see database lock errors, make sure only one instance of the Ryn GUI is running while using the LSP server. The LSP uses read-only database access to minimize conflicts.

## Technical Details

- **Protocol**: Language Server Protocol over stdin/stdout or TCP
- **TCP Port**: 9257 (default, configurable via `--port`)
- **Database**: Read-only access to `~/.local/share/ryn/ryn.db`
- **Supported features**: `textDocument/publishDiagnostics`, `textDocument/hover`
