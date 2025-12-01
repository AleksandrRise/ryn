# Ryn LSP Server Setup

Ryn includes an embedded Language Server Protocol (LSP) server that displays SOC 2 violations as IDE diagnostics.

## Quick Start

1. Build or install Ryn
2. Configure your IDE to use `ryn --lsp` as the language server
3. Open a project that has been scanned by Ryn

## How It Works

The LSP server reads violations from Ryn's SQLite database and displays them as diagnostics in your IDE. It:

- Shows violations as warnings/errors in the editor
- Highlights the specific function or class name where the violation occurs
- Displays violation details on hover
- Updates diagnostics when you save files

## IDE Configuration

### VS Code

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

- **Protocol**: Language Server Protocol over stdin/stdout
- **Database**: Read-only access to `~/.local/share/ryn/ryn.db`
- **Supported features**: `textDocument/publishDiagnostics`, `textDocument/hover`
