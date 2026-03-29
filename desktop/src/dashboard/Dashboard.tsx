import { useState, useEffect, useCallback, type FC } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Stats {
  active_tasks: number;
  agents_online: number;
  sessions: number;
  memories: number;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "online" | "busy" | "offline";
}

interface ActivityEntry {
  id: string;
  action: string;
  subject: string;
  timestamp: string;
  created_at?: string;
}

interface StatItem {
  key: keyof Stats;
  label: string;
  accentColor: string;
  icon: string;
}

const STAT_CONFIG: StatItem[] = [
  { key: "active_tasks", label: "Active Tasks", accentColor: "var(--brand-default)", icon: "checkCircle" },
  { key: "agents_online", label: "Agents Online", accentColor: "var(--brand-default)", icon: "users" },
  { key: "sessions", label: "Sessions", accentColor: "var(--brand-600)", icon: "terminal" },
  { key: "memories", label: "Memories", accentColor: "var(--brand-link)", icon: "brain" },
];

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  online: { color: "var(--brand-default)", label: "Online" },
  busy: { color: "var(--warning-default)", label: "Busy" },
  offline: { color: "var(--foreground-muted)", label: "Offline" },
};

/** Brand-derived avatar palette for team member initials */
const AVATAR_COLORS: readonly string[] = [
  "var(--brand-default)",
  "var(--brand-600)",
  "var(--brand-link)",
  "var(--brand-500)",
] as const;

/** Format an ISO timestamp into a relative time string */
function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const Dashboard: FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Fetch dashboard data from Supabase ────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const [tasksRes, agentsOnlineRes, sessionsRes, memoriesRes] =
        await Promise.allSettled([
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("agents")
            .select("*", { count: "exact", head: true })
            .eq("status", "online"),
          supabase
            .from("agent_sessions")
            .select("*", { count: "exact", head: true })
            .eq("status", "online"),
          supabase
            .from("memories")
            .select("*", { count: "exact", head: true }),
        ]);

      setStats({
        active_tasks:
          tasksRes.status === "fulfilled" ? (tasksRes.value.count ?? 0) : 0,
        agents_online:
          agentsOnlineRes.status === "fulfilled"
            ? (agentsOnlineRes.value.count ?? 0)
            : 0,
        sessions:
          sessionsRes.status === "fulfilled"
            ? (sessionsRes.value.count ?? 0)
            : 0,
        memories:
          memoriesRes.status === "fulfilled"
            ? (memoriesRes.value.count ?? 0)
            : 0,
      });
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await supabase.from("agents").select("*").limit(8);

      if (data && data.length > 0) {
        setAgents(
          data.map((a) => ({
            id: a.id,
            name: a.name ?? a.id,
            role: a.role ?? "Agent",
            status: (a.status as Agent["status"]) ?? "offline",
          })),
        );
      }
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        setActivity(
          data.map((row) => ({
            id: row.id,
            action: row.action ?? "Updated",
            subject: row.subject ?? row.description ?? "",
            timestamp: row.created_at ? timeAgo(row.created_at) : "",
            created_at: row.created_at,
          })),
        );
      }
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([loadStats(), loadAgents(), loadActivity()]);
    setLoading(false);
  }, [loadStats, loadAgents, loadActivity]);

  // ─── Initial load ──────────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Supabase Realtime subscriptions ───────────────────────────────

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    try {
      channel = supabase
        .channel("dashboard-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tasks" },
          () => {
            loadStats();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agents" },
          () => {
            loadStats();
            loadAgents();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agent_sessions" },
          () => {
            loadStats();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activity_log",
          },
          (payload) => {
            // Prepend new activity entries in real-time
            const row = payload.new as Record<string, string>;
            const entry: ActivityEntry = {
              id: row.id,
              action: row.action ?? "Updated",
              subject: row.subject ?? row.description ?? "",
              timestamp: row.created_at ? timeAgo(row.created_at) : "just now",
              created_at: row.created_at,
            };
            setActivity((prev) => [entry, ...prev].slice(0, 10));
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnected(true);
          }
        });
    } catch {
      // Realtime not available — that's fine, we still have polling
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadStats, loadAgents]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground-default)" }}>Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-lighter)" }}>
          Welcome to Orchestra Desktop. Your AI-powered company operating
          system.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => {
          const value = stats ? stats[stat.key] : null;
          return (
            <div
              key={stat.key}
              className="relative overflow-hidden rounded-lg"
              style={{
                background: "var(--background-surface-100)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="h-0.5" style={{ background: stat.accentColor }} />
              <div className="p-4">
                <p className="text-xs font-medium" style={{ color: "var(--foreground-lighter)" }}>
                  {stat.label}
                </p>
                {loading && value === null ? (
                  <div
                    className="mt-2 h-8 w-16 animate-pulse rounded"
                    style={{ background: "var(--background-surface-300)" }}
                  />
                ) : (
                  <p className="mt-1 text-3xl font-bold" style={{ color: "var(--foreground-default)" }}>
                    {value !== null ? value : 0}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--foreground-lighter)" }}>Team</h2>
        <div className="grid grid-cols-4 gap-3">
          {loading && agents.length === 0
            ? // Loading skeletons
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-lg p-4"
                  style={{
                    background: "var(--background-surface-100)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 animate-pulse rounded-full"
                      style={{ background: "var(--background-surface-300)" }}
                    />
                    <div className="min-w-0 space-y-2">
                      <div
                        className="h-3 w-24 animate-pulse rounded"
                        style={{ background: "var(--background-surface-300)" }}
                      />
                      <div
                        className="h-2.5 w-16 animate-pulse rounded"
                        style={{ background: "var(--background-surface-300)" }}
                      />
                    </div>
                  </div>
                </div>
              ))
            : (agents.length > 0 ? agents.slice(0, 4) : []).map(
                (agent, idx) => {
                  const statusInfo =
                    STATUS_STYLES[agent.status] || STATUS_STYLES.offline;
                  const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const initial = agent.name.charAt(0).toUpperCase();
                  return (
                    <div
                      key={agent.id}
                      className="rounded-lg p-4"
                      style={{
                        background: "var(--background-surface-100)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                          style={{ background: avatarBg }}
                        >
                          <span className="text-sm font-bold" style={{ color: "var(--foreground-light)" }}>
                            {initial}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: "var(--foreground-default)" }}>
                            {agent.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--foreground-lighter)" }}>
                            {agent.role}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: statusInfo.color }}
                        />
                        <span className="text-[11px]" style={{ color: "var(--foreground-lighter)" }}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
        </div>
        {!loading && agents.length === 0 && (
          <p className="mt-2 text-center text-xs" style={{ color: "var(--foreground-muted)" }}>
            No agents found. Create agents via the Go MCP server.
          </p>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--foreground-lighter)" }}>
          Recent Activity
        </h2>
        <div
          className="rounded-lg"
          style={{
            background: "var(--background-surface-100)",
            border: "1px solid var(--border-default)",
          }}
        >
          {loading && activity.length === 0
            ? // Loading skeletons
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3"
                  style={idx < 4 ? { borderBottom: "1px solid var(--border-default)" } : undefined}
                >
                  <div
                    className="h-7 w-7 animate-pulse rounded-full"
                    style={{ background: "var(--background-surface-300)" }}
                  />
                  <div
                    className="h-3 w-48 animate-pulse rounded"
                    style={{ background: "var(--background-surface-300)" }}
                  />
                </div>
              ))
            : activity.length > 0
              ? activity.slice(0, 10).map((entry, idx, arr) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={idx < arr.length - 1 ? { borderBottom: "1px solid var(--border-default)" } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ background: "var(--background-surface-300)" }}
                      >
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--foreground-muted)" }}
                        />
                      </div>
                      <div>
                        <span className="text-sm" style={{ color: "var(--foreground-light)" }}>
                          <span className="font-medium" style={{ color: "var(--foreground-default)" }}>
                            {entry.action}
                          </span>{" "}
                          {entry.subject}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {entry.timestamp}
                    </span>
                  </div>
                ))
              : (
                  <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--foreground-muted)" }}>
                    No recent activity
                  </div>
                )}
        </div>
      </div>

      {/* Connection status */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: connected ? "var(--brand-default)" : "var(--destructive-default)",
                boxShadow: connected
                  ? "0 0 6px hsla(153.1, 60.2%, 52.7%, 0.25)"
                  : "none",
              }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground-default)" }}>
                {connected ? "Connected to Supabase" : "Disconnected"}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                {connected
                  ? "Realtime subscriptions active"
                  : "Check that Supabase is running on localhost:8000"}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              border: "1px solid var(--border-strong)",
              color: "var(--foreground-lighter)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--background-surface-300)";
              e.currentTarget.style.color = "var(--foreground-default)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--foreground-lighter)";
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
