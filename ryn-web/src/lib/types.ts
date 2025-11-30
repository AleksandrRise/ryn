// Database types for Supabase

export type ScanMode = "regex_only" | "smart" | "analyze_all";
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ViolationSeverity = "critical" | "high" | "medium" | "low";
export type ViolationStatus = "open" | "fixed" | "dismissed";
export type DetectionMethod = "regex" | "llm" | "hybrid";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  github_url?: string;
  framework?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  language?: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: string;
  project_id: string;
  user_id: string;
  status: ScanStatus;
  scan_mode: ScanMode;
  started_at?: string;
  completed_at?: string;
  files_scanned: number;
  total_files: number;
  violations_found: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  error_message?: string;
  created_at: string;
}

export interface Violation {
  id: string;
  scan_id: string;
  project_id: string;
  control_id: string; // e.g., "CC6.1", "CC6.7"
  severity: ViolationSeverity;
  title: string;
  description: string;
  file_path: string;
  line_number: number;
  code_snippet: string;
  status: ViolationStatus;
  detection_method: DetectionMethod;
  confidence_score?: number;
  llm_reasoning?: string;
  regex_pattern?: string;
  created_at: string;
  updated_at: string;
}

export interface Fix {
  id: string;
  violation_id: string;
  original_code: string;
  fixed_code: string;
  explanation: string;
  trust_level: "auto" | "review" | "manual";
  applied_at?: string;
  applied_by?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  project_id?: string;
  violation_id?: string;
  fix_id?: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// SOC 2 Controls
export const SOC2_CONTROLS = {
  "CC6.1": {
    name: "Access Control",
    description: "Logical and physical access controls",
    color: "blue",
  },
  "CC6.7": {
    name: "Secrets Management",
    description: "System operations and change management",
    color: "purple",
  },
  "CC7.2": {
    name: "Audit Logging",
    description: "System monitoring and event detection",
    color: "amber",
  },
  "A1.2": {
    name: "Resilience",
    description: "System availability and resilience",
    color: "emerald",
  },
} as const;

export type ControlId = keyof typeof SOC2_CONTROLS;

// Utility type for database rows with timestamps
export interface DatabaseTimestamps {
  created_at: string;
  updated_at?: string;
}

// User profile from Supabase auth
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}
