interface OpenOptions {
  directory?: boolean
  multiple?: boolean
  title?: string
  defaultPath?: string
}

export async function open(options: OpenOptions = {}): Promise<string | string[] | null> {
  const hint = options.title || (options.directory ? "Select directory" : "Select file")
  const value = typeof window !== "undefined" ? window.prompt(hint, options.defaultPath || "") : null
  if (!value) return null
  return options.multiple ? [value] : value
}

interface SaveOptions {
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

export async function save(options: SaveOptions = {}): Promise<string> {
  return options.defaultPath || "ryn-export.json"
}
