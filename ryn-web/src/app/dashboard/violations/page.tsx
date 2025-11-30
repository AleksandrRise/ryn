"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertTriangle,
  FileWarning,
  Shield,
  CheckCircle,
  FileCode,
  ArrowLeft,
  Filter,
  Zap,
  Loader2,
  Code2,
  Sparkles,
  Lightbulb,
} from "lucide-react";

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case "high":
      return <FileWarning className="w-4 h-4 text-orange-400" />;
    case "medium":
      return <Shield className="w-4 h-4 text-yellow-400" />;
    default:
      return <CheckCircle className="w-4 h-4 text-white/40" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    default:
      return "bg-white/5 text-white/60 border-white/10";
  }
};

function ViolationDetailContent() {
  const searchParams = useSearchParams();
  const violationId = searchParams.get("id");
  const supabase = createClient();

  const [violation, setViolation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);

  useEffect(() => {
    if (!violationId) {
      setLoading(false);
      return;
    }

    const loadViolation = async () => {
      try {
        const { data } = await supabase
          .from("violations")
          .select("*")
          .eq("id", violationId)
          .single();

        if (data) {
          setViolation(data);
        }
      } catch (error) {
        console.error("Failed to load violation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadViolation();
  }, [violationId, supabase]);

  if (!violationId) {
    return <ViolationsList />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!violation) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto">
          <Link href="/dashboard/violations">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Violations
            </Button>
          </Link>
          <Card className="bg-white/[0.02] border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Violation not found</h3>
              <p className="text-white/50">This violation could not be loaded</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <Link href="/dashboard/violations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Violations
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                {getSeverityIcon(violation.severity)}
                <span className="font-mono text-sm text-white/60">
                  {violation.control_id}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(violation.severity)}`}>
                  {violation.severity}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {violation.detection_method || "regex"}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {violation.title}
              </h1>
              <p className="text-white/60 font-mono text-sm">
                {violation.file_path}:{violation.line_number}
              </p>
            </div>

            {/* Code Display */}
            <Card className="bg-white/[0.02] border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="w-5 h-5" />
                  Current Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-black/50 border border-white/5 overflow-hidden">
                  <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-black/30">
                    <span className="text-xs text-white/40 font-mono">
                      {violation.file_path}
                    </span>
                    <span className="text-xs text-white/30">
                      Line {violation.line_number}
                    </span>
                  </div>
                  <pre className="p-4 text-xs text-white/80 overflow-x-auto font-mono leading-relaxed">
                    <code>{violation.code_snippet || "No code snippet available"}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Reasoning Cards */}
            {(violation.llm_reasoning || violation.regex_reasoning) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {violation.llm_reasoning && (
                  <Card className="bg-purple-500/10 border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        AI Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-white/80">
                        {violation.llm_reasoning}
                      </p>
                      {violation.confidence_score && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/60">
                              Confidence
                            </span>
                            <span className="text-sm font-bold text-purple-400">
                              {Math.round(violation.confidence_score)}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{
                                width: `${violation.confidence_score}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {violation.regex_reasoning && (
                  <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Lightbulb className="w-4 h-4 text-blue-400" />
                        Pattern Match
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-white/80">
                        {violation.regex_reasoning}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={() => setIsGeneratingFix(true)} disabled={isGeneratingFix}>
                {isGeneratingFix ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Fix
                  </>
                )}
              </Button>
              <Button variant="outline">Dismiss</Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Description */}
            <Card className="bg-white/[0.02] border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Violation Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70">
                {violation.description}
              </CardContent>
            </Card>

            {/* Status */}
            <Card className="bg-white/[0.02] border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    violation.status === "open"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : violation.status === "fixed"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {violation.status || "open"}
                </span>
              </CardContent>
            </Card>

            {/* File Info */}
            <Card className="bg-white/[0.02] border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-white/50">File</p>
                  <p className="font-mono text-xs text-white/80 break-all">
                    {violation.file_path}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Line</p>
                  <p className="text-white/80">{violation.line_number}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViolationsList() {
  const supabase = createClient();
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadViolations = async () => {
      try {
        const { data } = await supabase
          .from("violations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (data) {
          setViolations(data);
        }
      } catch (error) {
        console.error("Failed to load violations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadViolations();
  }, [supabase]);

  const grouped = {
    critical: violations.filter((v) => v.severity === "critical"),
    high: violations.filter((v) => v.severity === "high"),
    medium: violations.filter((v) => v.severity === "medium"),
    low: violations.filter((v) => v.severity === "low"),
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Violations</h1>
          <p className="text-white/60 mt-1">
            {violations.length} violations found
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white/40" />
          </div>
        ) : violations.length === 0 ? (
          <Card className="bg-white/[0.02] border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="w-12 h-12 text-green-400/20 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No violations found</h3>
              <p className="text-white/50 max-w-sm mb-6">
                Run a scan to check your code for SOC 2 compliance violations.
              </p>
              <Link href="/dashboard/scan">
                <Button>
                  <Zap className="w-4 h-4 mr-2" />
                  New Scan
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Severity Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["critical", "high", "medium", "low"] as const).map((severity) => (
                <Card
                  key={severity}
                  className={`border ${getSeverityColor(severity)}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/50 capitalize">
                          {severity}
                        </p>
                        <p className="text-2xl font-bold tabular-nums">
                          {grouped[severity].length}
                        </p>
                      </div>
                      {getSeverityIcon(severity)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Violations List */}
            <div className="space-y-4">
              {violations.map((violation) => (
                <Link
                  key={violation.id}
                  href={`/dashboard/violations?id=${violation.id}`}
                >
                  <Card className="bg-white/[0.02] border-white/10 hover:border-white/20 transition-all cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityIcon(violation.severity)}
                            <h3 className="font-semibold text-white truncate">
                              {violation.title}
                            </h3>
                          </div>
                          <p className="text-sm text-white/60 mb-3">
                            {violation.description}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                              {violation.control_id}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(violation.severity)}`}
                            >
                              {violation.severity}
                            </span>
                            <span className="text-xs text-white/40 flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              {violation.file_path}:{violation.line_number}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Code Snippet */}
                      <div className="mt-4 rounded-lg bg-black/50 border border-white/5 overflow-hidden">
                        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                          <span className="text-xs text-white/40 font-mono">
                            {violation.file_path}
                          </span>
                          <span className="text-xs text-white/30">
                            Line {violation.line_number}
                          </span>
                        </div>
                        <pre className="p-3 text-xs text-white/80 overflow-x-auto font-mono line-clamp-3">
                          <code>{violation.code_snippet}</code>
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ViolationsPage() {
  return (
    <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin" />}>
      <ViolationDetailContent />
    </Suspense>
  );
}
