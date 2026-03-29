import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [version, setVersion] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  useEffect(() => {
    invoke<string>("get_version").then(setVersion);
  }, []);

  async function handleGreet() {
    const result = await invoke<string>("greet", { name });
    setGreeting(result);
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "editor", label: "Editor" },
    { id: "smart-actions", label: "Smart Actions" },
    { id: "settings", label: "Settings" },
  ];

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
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-violet-600/20 font-medium text-violet-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
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
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Welcome to Orchestra Desktop. Your AI-powered company
                  operating system.
                </p>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Active Tasks", value: "—", color: "violet" },
                  { label: "Team Online", value: "—", color: "emerald" },
                  { label: "Uptime", value: "—", color: "blue" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-100">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* IPC Test */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-sm font-medium text-zinc-300">
                  Tauri IPC Test
                </h2>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGreet()}
                    placeholder="Enter your name..."
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    onClick={handleGreet}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    Greet
                  </button>
                </div>
                {greeting && (
                  <p className="mt-3 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
                    {greeting}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "editor" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-zinc-100">Editor</h1>
              <p className="text-sm text-zinc-500">
                Monaco editor integration coming soon. This will be the primary
                workspace for viewing and editing project files.
              </p>
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50">
                <span className="text-sm text-zinc-600">
                  Monaco Editor Placeholder
                </span>
              </div>
            </div>
          )}

          {activeTab === "smart-actions" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-zinc-100">
                Smart Actions
              </h1>
              <p className="text-sm text-zinc-500">
                AI-powered actions that leverage screen capture and input
                simulation. Coming soon.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  "Screenshot & Analyze",
                  "Auto-Fill Form",
                  "Navigate & Click",
                  "Extract Text",
                ].map((action) => (
                  <div
                    key={action}
                    className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500 transition-colors hover:border-violet-600/50 hover:text-violet-400"
                  >
                    {action}
                  </div>
                ))}
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
    </div>
  );
}

export default App;
