import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownEditor } from "./editor";
import { Dashboard } from "./dashboard";
import { CommandPalette } from "./components";
import { SettingsPage } from "./settings";
import { McpConnector } from "./mcp";
import { AuthProvider, useAuth, LoginScreen } from "./auth";
import { supabase } from "./lib/supabase";

function AppShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [version, setVersion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    invoke<string>("get_version").then(setVersion);
  }, []);

  /* ---- Global Cmd+K / Ctrl+K listener (in-app) ---- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ---- Tauri global shortcut (works even when app is unfocused) ---- */
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    async function registerGlobal() {
      try {
        const { register } = await import("@tauri-apps/plugin-global-shortcut");
        await register("CommandOrControl+K", () => {
          setCommandPaletteOpen((prev) => !prev);
        });
        cleanup = () => {
          import("@tauri-apps/plugin-global-shortcut")
            .then(({ unregister }) => unregister("CommandOrControl+K"))
            .catch(() => {});
        };
      } catch {
        // Plugin not available or permissions not granted — in-app shortcut still works
      }
    }

    registerGlobal();
    return () => { if (cleanup) cleanup(); };
  }, []);

  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab);
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
        {/* Left: Logo + title + version */}
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

        {/* Right: Spotlight + User dropdown */}
        <div className="ml-auto flex items-center gap-2">
          {/* Spotlight / Command Palette trigger */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--background-surface-100)",
              border: "1px solid var(--border-default)",
              color: "var(--foreground-lighter)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
              e.currentTarget.style.color = "var(--foreground-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.color = "var(--foreground-lighter)";
            }}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span>Actions</span>
            <kbd
              style={{
                background: "var(--background-surface-300)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--border-radius-sm)",
                color: "var(--foreground-muted)",
                padding: "1px 5px",
                fontSize: "9px",
                fontWeight: 500,
              }}
            >
              {navigator.platform?.includes("Mac") ? "\u2318K" : "Ctrl+K"}
            </kbd>
          </button>

          {/* User avatar dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors"
              style={{
                background: "var(--brand-400)",
                color: "var(--brand-default)",
                border: userMenuOpen ? "2px solid var(--brand-default)" : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!userMenuOpen) {
                  e.currentTarget.style.borderColor = "var(--border-stronger)";
                }
              }}
              onMouseLeave={(e) => {
                if (!userMenuOpen) {
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
              title={user.email ?? "User menu"}
            >
              {(user.email ?? "U")[0].toUpperCase()}
            </button>

            {/* Dropdown menu */}
            {userMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-lg py-1 shadow-xl"
                style={{
                  background: "var(--background-overlay-default)",
                  border: "1px solid var(--border-overlay)",
                  zIndex: 50,
                }}
              >
                {/* User email (display only) */}
                <div
                  className="px-3 py-2.5"
                  style={{ borderBottom: "1px solid var(--border-default)" }}
                >
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                    Signed in as
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-medium"
                    style={{ color: "var(--foreground-default)" }}
                  >
                    {user.email}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setActiveTab("settings");
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                    style={{ color: "var(--foreground-light)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--background-overlay-hover)";
                      e.currentTarget.style.color = "var(--foreground-default)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--foreground-light)";
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
                      <circle cx="8" cy="8" r="2.5" />
                      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.9 2.9L4.3 4.3M11.7 11.7L13.1 13.1M13.1 2.9L11.7 4.3M4.3 11.7L2.9 13.1" />
                    </svg>
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setActiveTab("mcp");
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                    style={{ color: "var(--foreground-light)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--background-overlay-hover)";
                      e.currentTarget.style.color = "var(--foreground-default)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--foreground-light)";
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
                      <circle cx="4" cy="8" r="2" />
                      <circle cx="12" cy="4" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 8L10 5M6 8L10 11" />
                    </svg>
                    MCP Connection
                  </button>
                </div>

                {/* Separator + Sign out */}
                <div style={{ borderTop: "1px solid var(--border-default)" }} className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                    style={{ color: "var(--foreground-lighter)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--background-overlay-hover)";
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
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
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

          {activeTab === "mcp" && <McpConnector />}

          {activeTab === "settings" && <SettingsPage />}
        </main>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
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
