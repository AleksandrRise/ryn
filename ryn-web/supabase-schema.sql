-- Ryn Web Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT,
  framework TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project files table (stores uploaded code)
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT,
  size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, path)
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  scan_mode TEXT NOT NULL DEFAULT 'smart' CHECK (scan_mode IN ('regex_only', 'smart', 'analyze_all')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  files_scanned INTEGER DEFAULT 0,
  total_files INTEGER DEFAULT 0,
  violations_found INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  code_snippet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'dismissed')),
  detection_method TEXT NOT NULL CHECK (detection_method IN ('regex', 'llm', 'hybrid')),
  confidence_score DECIMAL(3, 2),
  llm_reasoning TEXT,
  regex_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fixes table
CREATE TABLE IF NOT EXISTS fixes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
  original_code TEXT NOT NULL,
  fixed_code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'review' CHECK (trust_level IN ('auto', 'review', 'manual')),
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  violation_id UUID REFERENCES violations(id) ON DELETE SET NULL,
  fix_id UUID REFERENCES fixes(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Project files: Access through project ownership
CREATE POLICY "Users can view own project files" ON project_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own project files" ON project_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can update own project files" ON project_files
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own project files" ON project_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

-- Scans: Users can only access their own scans
CREATE POLICY "Users can view own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

-- Violations: Access through project ownership
CREATE POLICY "Users can view own violations" ON violations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = violations.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can insert violations for own projects" ON violations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = violations.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can update own violations" ON violations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = violations.project_id AND projects.user_id = auth.uid())
  );

-- Fixes: Access through violation ownership
CREATE POLICY "Users can view fixes for own violations" ON fixes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM violations v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = fixes.violation_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fixes for own violations" ON fixes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM violations v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = fixes.violation_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own fixes" ON fixes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM violations v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = fixes.violation_id AND p.user_id = auth.uid()
    )
  );

-- Audit events: Users can only access their own audit events
CREATE POLICY "Users can view own audit events" ON audit_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit events" ON audit_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
CREATE INDEX IF NOT EXISTS idx_violations_project_id ON violations(project_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_project_id ON audit_events(project_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_violations_updated_at
  BEFORE UPDATE ON violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
