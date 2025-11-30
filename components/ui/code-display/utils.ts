/**
 * Language detection from file extension
 * Maps common file extensions to language identifiers for syntax highlighting
 */

const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript ecosystem
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",

  // Python
  py: "python",
  pyw: "python",
  pyi: "python",

  // Systems languages
  rs: "rust",
  go: "go",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",

  // JVM languages
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "groovy",

  // Web
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",

  // Data formats
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",

  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",

  // Other languages
  rb: "ruby",
  php: "php",
  cs: "csharp",
  swift: "swift",
  sql: "sql",
  md: "markdown",
  lua: "lua",
  r: "r",
  pl: "perl",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  clj: "clojure",
  cljs: "clojure",
  elm: "elm",
  dart: "dart",
  sol: "solidity",
  vue: "vue",
  svelte: "svelte",
}

/**
 * Detects the programming language from a file path
 * @param filePath - The path to the file (can be just filename or full path)
 * @returns The language identifier for syntax highlighter, or "text" if unknown
 */
export function getLanguageFromPath(filePath: string): string {
  if (!filePath) return "text"

  const ext = filePath.split(".").pop()?.toLowerCase() || ""
  return LANGUAGE_MAP[ext] || "text"
}

/**
 * Default styling for code blocks - matches Ryn's dark theme
 */
export const DEFAULT_CODE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "1rem",
  background: "#0a0a0a",
  fontSize: "13px",
}

/**
 * Compact styling for code snippets with max height
 */
export const SNIPPET_CODE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "0.75rem",
  background: "#0a0a0a",
  fontSize: "12px",
}
