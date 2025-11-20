// End-to-End Integration Tests - Complete Workflow Validation
// Tests the full compliance scanning pipeline: project → scan → violations → fixes

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import * as commands from "@/lib/tauri/commands"

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

describe("E2E Workflow - Complete Compliance Scanning Pipeline", () => {
  const mockInvoke = invoke as ReturnType<typeof vi.fn>
  let testProjectId: number
  let testScanId: number

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    testProjectId = 1
    testScanId = 1
  })

  afterEach(() => {
    // Cleanup
    vi.clearAllMocks()
  })

  describe("Project Management", () => {
    it("should create a project successfully", async () => {
      const mockProject: commands.Project = {
        id: 1,
        name: "test-app",
        path: "/tmp/test-app",
        framework: "Django",
        created_at: new Date().toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockProject)

      const result = await commands.create_project(
        "/tmp/test-app",
        "test-app",
        "Django"
      )

      expect(mockInvoke).toHaveBeenCalledWith("create_project", {
        path: "/tmp/test-app",
        name: "test-app",
        framework: "Django",
      })
      expect(result.id).toBe(1)
      expect(result.name).toBe("test-app")
      expect(result.framework).toBe("Django")
    })

    it("should retrieve all projects", async () => {
      const mockProjects: commands.Project[] = [
        {
          id: 1,
          name: "project-1",
          path: "/tmp/project-1",
          framework: "Django",
        },
        {
          id: 2,
          name: "project-2",
          path: "/tmp/project-2",
          framework: "Express",
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockProjects)

      const result = await commands.get_projects()

      expect(mockInvoke).toHaveBeenCalledWith("get_projects")
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe("project-1")
      expect(result[1].framework).toBe("Express")
    })

    it("should select a project folder", async () => {
      const mockPath = "/Users/dev/my-project"

      mockInvoke.mockResolvedValueOnce(mockPath)

      const result = await commands.select_project_folder()

      expect(mockInvoke).toHaveBeenCalledWith("select_project_folder")
      expect(result).toBe(mockPath)
    })
  })

  describe("Framework Detection", () => {
    it("should detect Django framework", async () => {
      mockInvoke.mockResolvedValueOnce("Django")

      const result = await commands.detect_framework("/tmp/django-app")

      expect(mockInvoke).toHaveBeenCalledWith("detect_framework", {
        path: "/tmp/django-app",
      })
      expect(result).toBe("Django")
    })

    it("should detect Express framework", async () => {
      mockInvoke.mockResolvedValueOnce("Express")

      const result = await commands.detect_framework("/tmp/express-app")

      expect(result).toBe("Express")
    })

    it("should return unknown for unrecognized framework", async () => {
      mockInvoke.mockResolvedValueOnce("unknown")

      const result = await commands.detect_framework("/tmp/unknown-app")

      expect(result).toBe("unknown")
    })
  })

  describe("Scanning and Violation Detection", () => {
    it("should scan a project and return violations", async () => {
      const mockScanResult: commands.ScanResult = {
        id: 1,
        project_id: 1,
        status: "completed",
        violations_found: 5,
        critical_count: 1,
        high_count: 2,
        medium_count: 2,
        low_count: 0,
        files_scanned: 10,
        total_files: 10,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockScanResult)

      const result = await commands.scan_project(testProjectId)

      expect(mockInvoke).toHaveBeenCalledWith("scan_project", {
        projectId: testProjectId,
      })
      expect(result.violations_found).toBe(5)
      expect(result.critical_count).toBe(1)
      expect(result.status).toBe("completed")
    })

    it("should get scan progress", async () => {
      const mockProgress: commands.ScanResult = {
        id: 1,
        project_id: 1,
        status: "running",
        violations_found: 3,
        critical_count: 0,
        high_count: 1,
        medium_count: 2,
        low_count: 0,
        files_scanned: 5,
        total_files: 10,
        started_at: new Date().toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockProgress)

      const result = await commands.get_scan_progress(testScanId)

      expect(result.status).toBe("running")
      expect(result.violations_found).toBe(3)
    })

    it("should retrieve all scans for a project", async () => {
      const mockScans: commands.ScanResult[] = [
        {
          id: 1,
          project_id: 1,
          status: "completed",
          violations_found: 5,
          critical_count: 1,
          high_count: 2,
          medium_count: 2,
          low_count: 0,
          files_scanned: 10,
          total_files: 10,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
        {
          id: 2,
          project_id: 1,
          status: "completed",
          violations_found: 3,
          critical_count: 0,
          high_count: 1,
          medium_count: 2,
          low_count: 0,
          files_scanned: 8,
          total_files: 10,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockScans)

      const result = await commands.get_scans(testProjectId)

      expect(result).toHaveLength(2)
      expect(result[0].violations_found).toBe(5)
    })
  })

  describe("Violation Management", () => {
    it("should retrieve violations for a scan", async () => {
      const mockViolations: commands.Violation[] = [
        {
          id: 1,
          scan_id: 1,
          control_id: "CC6.1",
          severity: "critical",
          description: "Missing authentication check",
          code_snippet: "def api_endpoint():",
          line_number: 42,
          file_path: "app.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
        {
          id: 2,
          scan_id: 1,
          control_id: "CC6.7",
          severity: "high",
          description: "Hardcoded API key",
          code_snippet: 'api_key = "sk_live_..."',
          line_number: 15,
          file_path: "config.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockViolations)

      const result = await commands.get_violations(testScanId)

      expect(mockInvoke).toHaveBeenCalledWith("get_violations", {
        scanId: testScanId,
        filters: undefined,
      })
      expect(result).toHaveLength(2)
      expect(result[0].severity).toBe("critical")
      expect(result[1].control_id).toBe("CC6.7")
    })

    it("should filter violations by severity", async () => {
      const mockViolations: commands.Violation[] = [
        {
          id: 1,
          scan_id: 1,
          control_id: "CC6.1",
          severity: "critical",
          description: "Missing authentication",
          code_snippet: "def endpoint():",
          line_number: 10,
          file_path: "app.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockViolations)

      const filters: commands.ViolationFilters = {
        severity: ["critical"],
      }

      const result = await commands.get_violations(testScanId, filters)

      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("critical")
    })

    it("should get a single violation with details", async () => {
      const mockViolationDetail: commands.ViolationDetail = {
        violation: {
          id: 1,
          scan_id: 1,
          control_id: "CC6.1",
          severity: "critical",
          description: "Missing login_required decorator",
          code_snippet: "@app.route('/admin')\ndef admin_panel():",
          line_number: 42,
          file_path: "src/views.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
        control: {
          id: "CC6.1",
          name: "Logical and Physical Access Controls",
          description: "Access controls restrict access to information assets",
          requirement: "Implement authentication and authorization",
          category: "Access Control",
        },
        fix: null,
        scan: null,
      }

      mockInvoke.mockResolvedValueOnce(mockViolationDetail)

      const result = await commands.get_violation(1)

      expect(mockInvoke).toHaveBeenCalledWith("get_violation", {
        violationId: 1,
      })
      expect(result.violation.id).toBe(1)
      expect(result.violation.control_id).toBe("CC6.1")
      expect(result.violation.severity).toBe("critical")
    })

    it("should dismiss a violation", async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await commands.dismiss_violation(1)

      expect(mockInvoke).toHaveBeenCalledWith("dismiss_violation", {
        violationId: 1,
      })
    })
  })

  describe("Fix Generation and Application", () => {
    it("should generate a fix for a violation", async () => {
      const mockFix: commands.Fix = {
        id: 1,
        violation_id: 1,
        original_code: "@app.route('/admin')\ndef admin_panel():",
        fixed_code:
          "@app.route('/admin')\n@login_required\ndef admin_panel():",
        explanation: "Added @login_required decorator for authentication",
        trust_level: "review",
        applied_at: null,
        applied_by: "ryn-ai",
        git_commit_sha: null,
      }

      mockInvoke.mockResolvedValueOnce(mockFix)

      const result = await commands.generate_fix(1)

      expect(mockInvoke).toHaveBeenCalledWith("generate_fix", {
        violationId: 1,
      })
      expect(result.original_code).toContain("admin_panel")
      expect(result.fixed_code).toContain("@login_required")
      expect(result.applied_at).toBeNull()
    })

    it("should apply a fix to a file", async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await commands.apply_fix(1)

      expect(mockInvoke).toHaveBeenCalledWith("apply_fix", { fixId: 1 })
    })
  })

  describe("Audit Trail", () => {
    it("should retrieve audit events", async () => {
      const mockEvents: commands.AuditEvent[] = [
        {
          id: 1,
          event_type: "scan",
          project_id: 1,
          description: "Project scanned for violations",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          event_type: "violation",
          project_id: 1,
          violation_id: 5,
          description: "Critical vulnerability detected",
          created_at: new Date().toISOString(),
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockEvents)

      const result = await commands.get_audit_events()

      expect(result).toHaveLength(2)
      expect(result[0].event_type).toBe("scan")
      expect(result[1].violation_id).toBe(5)
    })

    it("should filter audit events by project", async () => {
      const mockEvents: commands.AuditEvent[] = [
        {
          id: 1,
          event_type: "scan",
          project_id: 1,
          description: "Scan started",
          created_at: new Date().toISOString(),
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockEvents)

      const filters: commands.AuditFilters = {
        project_id: 1,
      }

      const result = await commands.get_audit_events(filters)

      expect(result).toHaveLength(1)
      expect(result[0].project_id).toBe(1)
    })
  })

  describe("Settings", () => {
    it("should retrieve all settings", async () => {
      const mockSettings: commands.Settings[] = [
        {
          key: "scan_frequency",
          value: "daily",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          key: "ignore_low_severity",
          value: "false",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockSettings)

      const result = await commands.get_settings()

      expect(result).toHaveLength(2)
      expect(result[0].key).toBe("scan_frequency")
    })

    it("should update a setting", async () => {
      const mockSetting: commands.Settings = {
        key: "scan_frequency",
        value: "weekly",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockSetting)

      const result = await commands.update_settings("scan_frequency", "weekly")

      expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
        key: "scan_frequency",
        value: "weekly",
      })
      expect(result.value).toBe("weekly")
    })
  })

  describe("Complete Workflow Integration", () => {
    it("should execute full compliance scan workflow", async () => {
      // Step 1: Create project
      const mockProject: commands.Project = {
        id: 1,
        name: "compliance-app",
        path: "/tmp/compliance-app",
        framework: "Django",
      }
      mockInvoke.mockResolvedValueOnce(mockProject)
      const project = await commands.create_project(
        "/tmp/compliance-app",
        "compliance-app",
        "Django"
      )

      expect(project.id).toBe(1)

      // Step 2: Run scan
      const mockScan: commands.ScanResult = {
        id: 1,
        project_id: 1,
        status: "completed",
        violations_found: 3,
        critical_count: 1,
        high_count: 1,
        medium_count: 1,
        low_count: 0,
        files_scanned: 10,
        total_files: 10,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }
      mockInvoke.mockResolvedValueOnce(mockScan)
      const scan = await commands.scan_project(project.id)

      expect(scan.violations_found).toBe(3)

      // Step 3: Get violations
      const mockViolations: commands.Violation[] = [
        {
          id: 1,
          scan_id: 1,
          control_id: "CC6.1",
          severity: "critical",
          description: "Missing auth",
          code_snippet: "def admin():",
          line_number: 10,
          file_path: "app.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
      ]
      mockInvoke.mockResolvedValueOnce(mockViolations)
      const violations = await commands.get_violations(scan.id)

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe("critical")

      // Step 4: Generate fix
      const mockFix: commands.Fix = {
        id: 1,
        violation_id: violations[0].id,
        original_code: violations[0].code_snippet,
        fixed_code: "@login_required\ndef admin():",
        explanation: "Added authentication decorator",
        trust_level: "review",
        applied_at: null,
        applied_by: "ryn-ai",
        git_commit_sha: null,
      }
      mockInvoke.mockResolvedValueOnce(mockFix)
      const fix = await commands.generate_fix(violations[0].id)

      expect(fix.fixed_code).toContain("@login_required")

      // Step 5: Apply fix
      mockInvoke.mockResolvedValueOnce(undefined)
      await commands.apply_fix(fix.id)

      // Step 6: Check audit events
      const mockAuditEvents: commands.AuditEvent[] = [
        {
          id: 1,
          event_type: "scan",
          project_id: 1,
          description: "Scan completed",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          event_type: "fix",
          project_id: 1,
          fix_id: 1,
          description: "Fix applied",
          created_at: new Date().toISOString(),
        },
      ]
      mockInvoke.mockResolvedValueOnce(mockAuditEvents)
      const auditEvents = await commands.get_audit_events({
        project_id: project.id,
      })

      expect(auditEvents).toHaveLength(2)
      expect(auditEvents[1].event_type).toBe("fix")
    })

    it("should handle multiple violations and apply different fixes", async () => {
      const testViolations: commands.Violation[] = [
        {
          id: 1,
          scan_id: 1,
          control_id: "CC6.1",
          severity: "critical",
          description: "Missing auth",
          code_snippet: "def endpoint():",
          line_number: 10,
          file_path: "api.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
        {
          id: 2,
          scan_id: 1,
          control_id: "CC6.7",
          severity: "high",
          description: "Hardcoded secret",
          code_snippet: 'secret = "my-secret"',
          line_number: 5,
          file_path: "config.py",
          status: "open",
          created_at: new Date().toISOString(),
          detection_method: "regex",
        },
      ]

      // Mock getting violations
      mockInvoke.mockResolvedValueOnce(testViolations)
      const violations = await commands.get_violations(1)

      expect(violations).toHaveLength(2)

      // Generate and apply fixes for each
      for (const violation of violations) {
        mockInvoke.mockResolvedValueOnce({
          id: violation.id,
          violation_id: violation.id,
          original_code: violation.code_snippet,
          fixed_code: `# Fixed CC${violation.control_id}\n${violation.code_snippet}`,
          explanation: `Fixed violation ${violation.control_id}`,
          trust_level: "review" as const,
          applied_at: null,
          applied_by: "ryn-ai",
          git_commit_sha: null,
        })

        const fix = await commands.generate_fix(violation.id)
        expect(fix).toBeDefined()

        mockInvoke.mockResolvedValueOnce(undefined)
        await commands.apply_fix(fix.id)
      }

      expect(mockInvoke).toHaveBeenCalledTimes(5) // 1 get_violations + 2 generate_fix + 2 apply_fix
    })
  })

  describe("Error Handling", () => {
    it("should handle Tauri invocation errors gracefully", async () => {
      const error = new Error("Failed to invoke command")
      mockInvoke.mockRejectedValueOnce(error)

      await expect(commands.get_projects()).rejects.toThrow(
        "Failed to invoke command"
      )
    })

    it("should handle empty results", async () => {
      mockInvoke.mockResolvedValueOnce([])

      const result = await commands.get_violations(999)

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })
})
