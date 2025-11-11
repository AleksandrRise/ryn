// Placeholder IPC commands - will be implemented by Rust backend

export interface Project {
  id: number
  name: string
  path: string
  framework?: string
}

export interface ScanResult {
  scanId: number
  filesScanned: number
  violationsFound: number
  completedAt: string
}

// Mock data for development
export async function selectProject(): Promise<Project> {
  // TODO: Use Tauri dialog API
  console.log("[v0] selectProject called")
  return {
    id: 1,
    name: "my-startup-app",
    path: "/Users/dev/projects/my-startup-app",
    framework: "Django",
  }
}

export async function scanProject(projectId: number): Promise<ScanResult> {
  // TODO: Call Tauri backend
  console.log("[v0] scanProject called for project:", projectId)

  // Simulate scan delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return {
    scanId: Date.now(),
    filesScanned: 147,
    violationsFound: 18,
    completedAt: new Date().toISOString(),
  }
}

export async function detectFramework(projectPath: string): Promise<string> {
  // TODO: Call Tauri backend
  console.log("[v0] detectFramework called for:", projectPath)
  return "Django"
}

export async function startFileWatcher(projectPath: string): Promise<void> {
  // TODO: Call Tauri backend
  console.log("[v0] startFileWatcher called for:", projectPath)
}

export async function stopFileWatcher(): Promise<void> {
  // TODO: Call Tauri backend
  console.log("[v0] stopFileWatcher called")
}
