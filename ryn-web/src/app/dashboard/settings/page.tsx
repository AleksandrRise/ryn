"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Eye,
  BarChart3,
  Download,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from "lucide-react";

type ScanMode = "regex_only" | "smart" | "analyze_all";

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [scanMode, setScanMode] = useState<ScanMode>("smart");
  const [costLimit, setCostLimit] = useState("5.00");
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [fileWatching, setFileWatching] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setScanMode((data.llm_scan_mode || "smart") as ScanMode);
          setCostLimit(data.cost_limit_per_scan || "5.00");
          setDesktopNotifications(data.desktop_notifications === "true");
          setFileWatching(data.file_watching === "true");
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [supabase]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          llm_scan_mode: scanMode,
          cost_limit_per_scan: costLimit,
          desktop_notifications: desktopNotifications ? "true" : "false",
          file_watching: fileWatching ? "true" : "false",
        });

      if (error) throw error;
      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all user data
      const [projects, scans, violations] = await Promise.all([
        supabase.from("projects").select("*").eq("user_id", user.id),
        supabase.from("scans").select("*").eq("user_id", user.id),
        supabase.from("violations").select("*").eq("user_id", user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        projects: projects.data || [],
        scans: scans.data || [],
        violations: violations.data || [],
      };

      // Download as JSON
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ryn-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Data exported successfully" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to export data" });
      console.error("Error exporting data:", error);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure? This will permanently delete all scans and violations, but keep your projects.")) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all scans (violations will cascade)
      const { error } = await supabase
        .from("scans")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      setMessage({ type: "success", text: "Scan history cleared successfully" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to clear history" });
      console.error("Error clearing history:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  const SCAN_MODES = [
    {
      value: "regex_only" as const,
      label: "Pattern Only",
      description: "Free, instant regex-based detection only",
    },
    {
      value: "smart" as const,
      label: "Smart (Recommended)",
      description: "AI analyzes ~30-40% of files (security-critical code only)",
    },
    {
      value: "analyze_all" as const,
      label: "Analyze All",
      description: "AI analyzes every file (maximum accuracy, higher cost)",
    },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-white/60 mt-1">Configure compliance scanning and integrations</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* AI Scanning Configuration */}
          <Card className="bg-white/[0.02] border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Scanning Configuration
              </CardTitle>
              <CardDescription>Choose how thorough scans should be</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {SCAN_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className="flex items-start p-3 rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-all"
                  >
                    <input
                      type="radio"
                      name="scan-mode"
                      value={mode.value}
                      checked={scanMode === mode.value}
                      onChange={(e) => setScanMode(e.target.value as ScanMode)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">{mode.label}</p>
                      <p className="text-sm text-white/50">{mode.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {scanMode !== "regex_only" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="cost-limit">Cost Limit Per Scan (USD)</Label>
                  <Input
                    id="cost-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={costLimit}
                    onChange={(e) => setCostLimit(e.target.value)}
                    placeholder="5.00"
                  />
                  <p className="text-xs text-white/40">
                    Scanning will pause if estimated cost exceeds this limit
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monitoring & Notifications */}
          <Card className="bg-white/[0.02] border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Monitoring & Notifications
              </CardTitle>
              <CardDescription>Configure alerts and monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Desktop Notifications */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className="font-medium text-white">Desktop Notifications</p>
                  <p className="text-sm text-white/50">Use OS-level alerts for scans</p>
                </div>
                <button
                  onClick={() => setDesktopNotifications(!desktopNotifications)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                    desktopNotifications ? "bg-blue-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      desktopNotifications ? "translate-x-6" : "translate-x-1"
                    } my-1`}
                  />
                </button>
              </div>

              {/* File Watching */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className="font-medium text-white">Real-time File Watching</p>
                  <p className="text-sm text-white/50">Monitor project files for changes</p>
                </div>
                <button
                  onClick={() => setFileWatching(!fileWatching)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                    fileWatching ? "bg-blue-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      fileWatching ? "translate-x-6" : "translate-x-1"
                    } my-1`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data & Maintenance */}
        <Card className="bg-white/[0.02] border-white/10 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Data & Maintenance
            </CardTitle>
            <CardDescription>Export data or wipe scan history if you need a clean slate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/60">
              Clearing scan history removes violations and fixes. Projects and settings stay intact.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={handleExportData}>
                <Download className="w-4 h-4 mr-2" />
                Export All Data
              </Button>
              <Button variant="outline" onClick={handleClearHistory} className="text-red-400 hover:text-red-300">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Clear Scan History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
