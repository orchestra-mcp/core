import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownEditor } from "./editor";
import { Dashboard } from "./dashboard";
import { SmartActionsDialog, SmartActionsGrid } from "./smart-actions";

function App() {
  const [version, setVersion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [smartActionsOpen, setSmartActionsOpen] = useState(false);

  useEffect(() => {
    invoke<string>("get_version").then(setVersion);
  }, []);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "squares" },
    { id: "editor", label: "Editor", icon: "code" },
    { id: "smart-actions", label: "Smart Actions", icon: "zap" },
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
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Title bar */}
      <header
        className="flex h-12 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-4"
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
          <span className="text-sm font-semibold text-zinc-100">
            Orchestra Desktop
          </span>
          {version && (
            <span className="rounded bg-violet-600/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
              v{version}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/50 p-3">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-violet-600/20 font-medium text-violet-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <TabIcon id={tab.id} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-300">Connected</span>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main
          className={`flex-1 overflow-auto ${activeTab === "editor" ? "" : "p-6"}`}
        >
          {activeTab === "dashboard" && <Dashboard />}

          {activeTab === "editor" && <MarkdownEditor />}

          {activeTab === "smart-actions" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">
                  Smart Actions
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
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
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-violet-400"
                >
                  Open Smart Actions Dialog
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
              <p className="text-sm text-zinc-500">
                Configuration for Orchestra Desktop. MCP token, theme, keyboard
                shortcuts, and more.
              </p>
              <div className="space-y-3">
                {[
                  "MCP Token",
                  "Appearance",
                  "Keyboard Shortcuts",
                  "Cloud Sync",
                  "About",
                ].map((section) => (
                  <div
                    key={section}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <h3 className="text-sm font-medium text-zinc-300">
                      {section}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Not configured yet
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
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

export default App;
