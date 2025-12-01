"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { PiPlugsConnected, PiPlug, PiCopy, PiCheck, PiCaretRight, PiCaretDown } from "react-icons/pi"
import {
  start_lsp_server,
  stop_lsp_server,
  get_lsp_status,
  type LspStatus,
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"

// Collapsible accordion component for setup sections
function SetupAccordion({
  title,
  children,
  defaultOpen = false
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        {isOpen ? (
          <PiCaretDown className="w-4 h-4" />
        ) : (
          <PiCaretRight className="w-4 h-4" />
        )}
        {title}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-sm text-white/60">
          {children}
        </div>
      )}
    </div>
  )
}

// Code block with copy button
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative mt-2 rounded-md bg-black/30 border border-white/10">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-xs text-white/40">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
        >
          {copied ? (
            <>
              <PiCheck className="w-3 h-3" /> Copied
            </>
          ) : (
            <>
              <PiCopy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-green-400 overflow-x-auto">
        {code}
      </pre>
    </div>
  )
}

export function LspSettings() {
  const [status, setStatus] = useState<LspStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch LSP status
  const fetchStatus = useCallback(async () => {
    try {
      const s = await get_lsp_status()
      setStatus(s)
    } catch (error) {
      handleTauriError(error, "Failed to get LSP status")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Poll status every 5 seconds
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Toggle LSP server
  const handleToggle = async () => {
    setIsToggling(true)
    try {
      if (status?.running) {
        await stop_lsp_server()
        showInfo("LSP server stopped")
      } else {
        await start_lsp_server()
        showSuccess("LSP server started on port 9257")
      }
      await fetchStatus()
    } catch (error) {
      handleTauriError(error, "Failed to toggle LSP server")
    } finally {
      setIsToggling(false)
    }
  }

  // Copy IDE config to clipboard
  const handleCopyConfig = async () => {
    const config = status?.running
      ? `tcp://127.0.0.1:${status.port || 9257}`
      : "ryn --lsp --tcp --port 9257"
    await navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format uptime (e.g., "2h 34m" or "45s")
  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-white/5 rounded-lg">
            <PiPlug className="w-5 h-5 text-white/60" />
          </div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            IDE Integration
          </h2>
        </div>
        <div className="flex items-center gap-2 text-white/50">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/5 rounded-lg">
          {status?.running ? (
            <PiPlugsConnected className="w-5 h-5 text-green-400" />
          ) : (
            <PiPlug className="w-5 h-5 text-white/60" />
          )}
        </div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
          IDE Integration
        </h2>
      </div>

      {/* Description */}
      <p className="text-sm text-white/60 mb-4">
        Connect your IDE to see SOC 2 violations inline while coding.
      </p>

      {/* Status Indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            status?.running ? "bg-green-400" : "bg-white/30"
          }`}
        />
        <span className="text-sm font-medium">
          {status?.running ? "Running" : "Not Running"}
        </span>
        {status?.running && status.uptime_seconds !== undefined && (
          <span className="text-xs text-white/50">
            · PID {status.pid} · {formatUptime(status.uptime_seconds)}
          </span>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        onClick={handleToggle}
        disabled={isToggling}
        variant={status?.running ? "outline" : "default"}
        className="w-full mb-4"
      >
        {isToggling
          ? "..."
          : status?.running
          ? "Stop LSP Server"
          : "Start LSP Server"}
      </Button>

      {/* Connection Details - Always visible */}
      <div className="p-3 rounded-lg bg-white/5 border border-white/10 mb-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Connection Details (Any Editor)</h3>

        {/* TCP Connection */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs text-white/50">TCP Mode:</span>
            <code className="ml-2 text-xs text-green-400 font-mono">
              tcp://127.0.0.1:{status?.port || 9257}
            </code>
          </div>
          <button
            onClick={handleCopyConfig}
            className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <>
                <PiCheck className="w-3 h-3" /> Copied
              </>
            ) : (
              <>
                <PiCopy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
        </div>

        {/* stdio Command */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs text-white/50">stdio Mode:</span>
            <code className="ml-2 text-xs text-green-400 font-mono">ryn --lsp</code>
          </div>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText("ryn --lsp")
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
          >
            <PiCopy className="w-3 h-3" /> Copy
          </button>
        </div>

        <div className="text-xs text-white/40 space-y-1">
          <p><span className="text-white/50">Supported:</span> Python, JavaScript, TypeScript, Go, Rust, and more</p>
          <p><span className="text-white/50">Provides:</span> Diagnostics (inline warnings/errors), Hover (violation details)</p>
        </div>
      </div>

      {/* IDE Setup Guides */}
      <div className="space-y-2">
        <SetupAccordion title="VS Code Setup">
          <p className="mb-2">Add to your <code className="text-green-400">settings.json</code> (with a generic LSP client extension):</p>
          <CodeBlock
            language="json"
            code={`{
  "languageServerExample.serverPath": "ryn",
  "languageServerExample.serverArgs": ["--lsp"]
}`}
          />
          <p className="mt-2 text-xs text-white/40">
            Or configure your LSP client extension to connect to <code className="text-green-400">127.0.0.1:9257</code> for TCP mode.
          </p>
        </SetupAccordion>

        <SetupAccordion title="Neovim Setup">
          <p className="mb-2">Add to your <code className="text-green-400">init.lua</code> (requires nvim-lspconfig):</p>
          <CodeBlock
            language="lua"
            code={`local configs = require('lspconfig.configs')
local lspconfig = require('lspconfig')

if not configs.ryn then
  configs.ryn = {
    default_config = {
      -- TCP mode (when LSP started from Ryn GUI):
      cmd = vim.lsp.rpc.connect('127.0.0.1', 9257),
      -- Or stdio mode (Neovim spawns the process):
      -- cmd = { 'ryn', '--lsp' },
      filetypes = { 'python', 'javascript', 'typescript' },
      root_dir = lspconfig.util.root_pattern('.git', 'package.json'),
    },
  }
end

lspconfig.ryn.setup({})`}
          />
        </SetupAccordion>

        <SetupAccordion title="Helix Setup">
          <p className="mb-2">Add to <code className="text-green-400">~/.config/helix/languages.toml</code>:</p>
          <CodeBlock
            language="toml"
            code={`[language-server.ryn]
command = "ryn"
args = ["--lsp"]

[[language]]
name = "python"
language-servers = ["ryn"]

[[language]]
name = "javascript"
language-servers = ["ryn"]

[[language]]
name = "typescript"
language-servers = ["ryn"]`}
          />
        </SetupAccordion>

        <SetupAccordion title="Zed Setup">
          <p className="mb-2">Add to your Zed settings:</p>
          <CodeBlock
            language="json"
            code={`{
  "lsp": {
    "ryn": {
      "binary": {
        "path": "ryn",
        "arguments": ["--lsp"]
      }
    }
  }
}`}
          />
        </SetupAccordion>

        <SetupAccordion title="Troubleshooting">
          <div className="space-y-3">
            <div>
              <p className="font-medium text-white/70">No diagnostics appearing?</p>
              <ul className="list-disc list-inside text-xs text-white/50 mt-1 space-y-1">
                <li>Scan the project with Ryn first (violations must exist in the database)</li>
                <li>Open the project from the same root directory used during scanning</li>
                <li>Check your IDE&apos;s LSP logs for connection errors</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-white/70">Database lock errors?</p>
              <p className="text-xs text-white/50 mt-1">Only run one Ryn instance at a time. The LSP uses read-only access to minimize conflicts.</p>
            </div>
            <div>
              <p className="font-medium text-white/70">Severity Mapping</p>
              <div className="mt-1 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-red-400">critical/high</span>
                  <span className="text-white/50">→ Error (red)</span>
                  <span className="text-yellow-400">medium</span>
                  <span className="text-white/50">→ Warning (yellow)</span>
                  <span className="text-blue-400">low</span>
                  <span className="text-white/50">→ Info (blue)</span>
                </div>
              </div>
            </div>
          </div>
        </SetupAccordion>
      </div>
    </div>
  )
}
