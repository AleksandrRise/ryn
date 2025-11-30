"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileSearch,
  CheckCircle,
  AlertCircle,
  Play,
  Filter,
  Loader2,
  Clock,
} from "lucide-react";

export default function AuditPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [events, setEvents] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(15);

  const [stats, setStats] = useState({
    scans: 0,
    fixes: 0,
    violations: 0,
    total: 0,
  });

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const { data } = await supabase
          .from("audit_events")
          .select("*")
          .order("created_at", { ascending: false });

        if (data) {
          setEvents(data);

          // Calculate stats
          const scansCount = data.filter((e) => e.event_type?.includes("scan")).length;
          const fixesCount = data.filter((e) => e.event_type?.includes("fix")).length;
          const violationsCount = data.filter((e) => e.event_type?.includes("violation")).length;

          setStats({
            scans: scansCount,
            fixes: fixesCount,
            violations: violationsCount,
            total: data.length,
          });
        }
      } catch (error) {
        console.error("Failed to load audit events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [supabase]);

  const getEventIcon = (eventType: string) => {
    if (eventType?.includes("scan")) return FileSearch;
    if (eventType?.includes("fix")) return CheckCircle;
    if (eventType?.includes("violation")) return AlertCircle;
    return Play;
  };

  const getEventColor = (eventType: string) => {
    if (eventType?.includes("scan")) return "blue";
    if (eventType?.includes("fix")) return "green";
    if (eventType?.includes("violation")) return "red";
    return "gray";
  };

  const filteredEvents = events.filter((event) => {
    if (filterType === "all") return true;
    return event.event_type?.includes(filterType);
  });

  const displayedEvents = filteredEvents.slice(0, visibleCount);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { border: string; bg: string; dot: string; icon: string }> = {
      blue: {
        border: "border-blue-500/20",
        bg: "bg-blue-500/10",
        dot: "bg-blue-500/30 border-blue-500/20 group-hover:bg-blue-500/50",
        icon: "text-blue-400",
      },
      green: {
        border: "border-green-500/20",
        bg: "bg-green-500/10",
        dot: "bg-green-500/30 border-green-500/20 group-hover:bg-green-500/50",
        icon: "text-green-400",
      },
      red: {
        border: "border-red-500/20",
        bg: "bg-red-500/10",
        dot: "bg-red-500/30 border-red-500/20 group-hover:bg-red-500/50",
        icon: "text-red-400",
      },
      gray: {
        border: "border-white/10",
        bg: "bg-white/5",
        dot: "bg-white/10 border-white/20 group-hover:bg-white/20",
        icon: "text-white/40",
      },
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold">Audit Trail</h1>
            <p className="text-white/60 mt-2">Complete compliance activity log</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/[0.02] border-white/10">
                <CardContent className="p-6 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileSearch, label: "Total Scans", value: stats.scans, color: "blue" },
              { icon: CheckCircle, label: "Fixes Applied", value: stats.fixes, color: "green" },
              { icon: AlertCircle, label: "Violations", value: stats.violations, color: "red" },
              { icon: Filter, label: "Total Events", value: stats.total, color: "gray" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              const colors = getColorClasses(stat.color);
              return (
                <Card key={i} className={`bg-white/[0.02] border-white/10`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${colors.icon}`} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-white/60 text-sm">{stat.label}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {["all", "scan", "fix", "violation"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm tracking-widest uppercase ${
                filterType === type
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {displayedEvents.length === 0 ? (
          <Card className="bg-white/[0.02] border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Filter className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No audit events</h3>
              <p className="text-white/50">Events will appear as you scan and fix violations</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative space-y-6">
            {/* Timeline line */}
            <div className="absolute left-7 top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

            {/* Events */}
            {displayedEvents.map((event, index) => {
              const Icon = getEventIcon(event.event_type);
              const color = getEventColor(event.event_type);
              const colors = getColorClasses(color);

              return (
                <div key={event.id} className="relative group pl-20">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-1 w-14 h-14 rounded-2xl ${colors.dot} border transition-all flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${colors.icon}`} />
                  </div>

                  {/* Event Card */}
                  <Card className={`bg-white/[0.02] border-white/10 hover:border-${color}-500/20 hover:bg-white/[0.04] transition-all`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-sm font-mono uppercase tracking-wider text-${color}-400`}>
                              {event.event_type?.replace(/_/g, " ") || "Event"}
                            </span>
                          </div>
                          <p className="text-lg font-medium text-white mb-1">{event.description}</p>
                          {event.metadata && (
                            <p className="text-sm text-white/50">
                              {typeof event.metadata === "string"
                                ? event.metadata
                                : JSON.stringify(event.metadata)}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-white/40 whitespace-nowrap">
                          {formatDate(event.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {visibleCount < filteredEvents.length && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((c) => c + 20)}
            >
              Load More Events
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
