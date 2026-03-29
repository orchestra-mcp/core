import { useState, useEffect, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";

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
}

const STAT_CONFIG = [
  { key: "active_tasks" as const, label: "Active Tasks", color: "violet", icon: "checkCircle" },
  { key: "agents_online" as const, label: "Agents Online", color: "emerald", icon: "users" },
  { key: "sessions" as const, label: "Sessions", color: "blue", icon: "terminal" },
  { key: "memories" as const, label: "Memories", color: "amber", icon: "brain" },
];

const COLOR_ACCENTS: Record<string, string> = {
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
};

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-500", label: "Online" },
  busy: { dot: "bg-amber-500", label: "Busy" },
  offline: { dot: "bg-zinc-600", label: "Offline" },
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-cyan-600",
  "from-pink-500 to-rose-600",
];

const Dashboard: FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsResult, agentsResult, activityResult] = await Promise.allSettled([
        invoke<Stats>("get_stats"),
        invoke<Agent[]>("get_agents"),
        invoke<ActivityEntry[]>("get_recent_activity"),
      ]);
      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (agentsResult.status === "fulfilled") setAgents(agentsResult.value);
      if (activityResult.status === "fulfilled") setActivity(activityResult.value);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome to Orchestra Desktop. Your AI-powered company operating system.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => {
          const value = stats ? stats[stat.key] : null;
          return (
            <div
              key={stat.key}
              className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              {/* Color accent line at top */}
              <div className={`h-1 ${COLOR_ACCENTS[stat.color]}`} />
              <div className="p-4">
                <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-zinc-100">
                  {value !== null ? value : "--"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Team</h2>
        <div className="grid grid-cols-4 gap-3">
          {(agents.length > 0
            ? agents.slice(0, 4)
            : [
                { id: "1", name: "Omar El-Sayed", role: "Laravel Developer", status: "online" as const },
                { id: "2", name: "Mostafa Hassan", role: "Go Developer", status: "online" as const },
                { id: "3", name: "Yassin Farouk", role: "Frontend Developer", status: "busy" as const },
                { id: "4", name: "Mariam Helmy", role: "QA Engineer", status: "offline" as const },
              ]
          ).map((agent, idx) => {
            const statusInfo = STATUS_COLORS[agent.status];
            const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
            const initial = agent.name.charAt(0).toUpperCase();
            return (
              <div
                key={agent.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}
                  >
                    <span className="text-sm font-bold text-white">
                      {initial}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {agent.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{agent.role}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
                  <span className="text-[11px] text-zinc-500">
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">
          Recent Activity
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          {(activity.length > 0
            ? activity.slice(0, 5)
            : [
                { id: "1", action: "Created", subject: "Phase 3 implementation plan", timestamp: "2 min ago" },
                { id: "2", action: "Completed", subject: "Docker Compose setup", timestamp: "15 min ago" },
                { id: "3", action: "Assigned", subject: "MCP server auth module", timestamp: "1 hr ago" },
                { id: "4", action: "Reviewed", subject: "Database migration #12", timestamp: "2 hr ago" },
                { id: "5", action: "Deployed", subject: "Edge function update", timestamp: "3 hr ago" },
              ]
          ).map((entry, idx, arr) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-4 py-3 ${
                idx < arr.length - 1 ? "border-b border-zinc-800" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800">
                  <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                </div>
                <div>
                  <span className="text-sm text-zinc-300">
                    <span className="font-medium text-zinc-100">
                      {entry.action}
                    </span>{" "}
                    {entry.subject}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-600">
                {entry.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Connection status */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-red-500 shadow-lg shadow-red-500/30"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-zinc-200">
                {connected ? "Connected to Orchestra" : "Disconnected"}
              </p>
              <p className="text-xs text-zinc-600">
                {connected
                  ? "MCP server reachable"
                  : "Check your network and MCP token"}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
