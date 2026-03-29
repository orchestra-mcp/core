import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownEditor } from "./editor";
import { Dashboard } from "./dashboard";
import { SmartActionsDialog, SmartActionsGrid } from "./smart-actions";
import { SettingsPage } from "./settings";
import { McpConnector } from "./mcp";
import { AuthProvider, useAuth, LoginScreen } from "./auth";
import { supabase } from "./lib/supabase";

function AppShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [version, setVersion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [smartActionsOpen, setSmartActionsOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    invoke<string>("get_version").then(setVersion);
  }, []);

  // Check Supabase connection health periodically
  useEffect(() => {
    if (!user) return;

    async function checkConnection() {
      try {
        const { error } = await supabase
          .from("agents")
          .select("id", { count: "exact", head: true });
        setSupabaseConnected(!error);
      } catch {
        setSupabaseConnected(false);
      }
    }

    checkConnection();
    const interval = setInterval(checkConnection, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  // Show loading spinner while checking auth session
  if (authLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "var(--background-default)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/logo.svg"
            alt="Orchestra"
            className="h-12 w-12"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <svg
            className="h-6 w-6 animate-spin"
            style={{ color: "var(--brand-default)" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p
            className="text-sm"
            style={{ color: "var(--foreground-lighter)" }}
          >
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated — show login screen
  if (!user) {
    return <LoginScreen />;
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "squares" },
    { id: "editor", label: "Editor", icon: "code" },
    { id: "smart-actions", label: "Smart Actions", icon: "zap" },
    { id: "mcp", label: "MCP Connection", icon: "mcp" },
    { id: "settings", label: "Settings", icon: "cog" },
  ];

  const TabIcon = ({ id }: { id: string }) => {
    const cls = "h-4 w-4 shrink-0";
    switch (id) {
      case "dashboard":
        return (
          <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        );
      case "editor":
        return (
          <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4L2 8L5 12" />
            <path d="M11 4L14 8L11 12" />
            <path d="M9 2L7 14" />
          </svg>
        );
      case "smart-actions":
        return (
          <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" />
          </svg>
        );
      case "mcp":
        return (
          <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="4" cy="8" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 8L10 5M6 8L10 11" />
          </svg>
        );
      case "settings":
        return (
          <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.9 2.9L4.3 4.3M11.7 11.7L13.1 13.1M13.1 2.9L11.7 4.3M4.3 11.7L2.9 13.1" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--background-default)" }}>
      {/* Title bar */}
      <header
        className="flex h-12 shrink-0 items-center px-4"
        style={{
          background: "var(--background-dash-sidebar)",
          borderBottom: "1px solid var(--border-default)",
        }}
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3">
          <img
            src="/assets/logo.svg"
            alt="Orchestra"
            className="h-6 w-6"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground-default)" }}>
            Orchestra Desktop
          </span>
          {version && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: "var(--brand-400)",
                color: "var(--brand-default)",
              }}
            >
              v{version}
            </span>
          )}
        </div>

        {/* User info in title bar */}
        <div className="ml-auto flex items-center gap-3">
          <span
            className="max-w-[200px] truncate text-xs"
            style={{ color: "var(--foreground-lighter)" }}
          >
            {user.email}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className="flex w-52 shrink-0 flex-col p-3"
          style={{
            background: "var(--background-dash-sidebar)",
            borderRight: "1px solid var(--border-default)",
          }}
        >
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
                style={
                  activeTab === tab.id
                    ? {
                        background: "var(--background-surface-200)",
                        color: "var(--foreground-default)",
                        fontWeight: 500,
                      }
                    : {
                        color: "var(--foreground-lighter)",
                      }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = "var(--background-surface-100)";
                    e.currentTarget.style.color = "var(--foreground-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--foreground-lighter)";
                  }
                }}
              >
                <TabIcon id={tab.id} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sign out button */}
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
            style={{ color: "var(--foreground-lighter)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--background-surface-100)";
              e.currentTarget.style.color = "var(--destructive-default)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--foreground-lighter)";
            }}
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
              <path d="M10 11l3-3-3-3" />
              <path d="M13 8H6" />
            </svg>
            Sign out
          </button>

          {/* Connection status in sidebar */}
          <div
            className="mt-auto rounded-lg p-3"
            style={{
              background: "var(--background-surface-100)",
              border: "1px solid var(--border-default)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--foreground-lighter)" }}>Status</p>
            <div className="mt-1 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  background: supabaseConnected
                    ? "var(--brand-default)"
                    : "var(--destructive-default)",
                }}
              />
              <span className="text-xs" style={{ color: "var(--foreground-light)" }}>
                {supabaseConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main
          className={`flex-1 overflow-auto ${activeTab === "editor" ? "" : "p-6"}`}
          style={{ background: "var(--background-dash-canvas)" }}
        >
          {activeTab === "dashboard" && <Dashboard />}

          {activeTab === "editor" && <MarkdownEditor />}

          {activeTab === "smart-actions" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--foreground-default)" }}>
                  Smart Actions
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--foreground-lighter)" }}>
                  Create entities quickly. Select a type below to open the
                  creation form.
                </p>
              </div>

              <SmartActionsGrid
                onSelect={() => setSmartActionsOpen(true)}
              />

              <div className="flex items-center justify-center pt-2">
                <button
                  onClick={() => setSmartActionsOpen(true)}
                  className="rounded-md px-5 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: "var(--brand-default)",
                    color: "var(--foreground-contrast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--brand-600)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--brand-default)";
                  }}
                >
                  Open Smart Actions Dialog
                </button>
              </div>
            </div>
          )}

          {activeTab === "mcp" && <McpConnector />}

          {activeTab === "settings" && <SettingsPage />}
        </main>
      </div>

      {/* Smart Actions Dialog (modal overlay) */}
      <SmartActionsDialog
        open={smartActionsOpen}
        onClose={() => setSmartActionsOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
