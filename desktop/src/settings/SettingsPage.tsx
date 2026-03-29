import { useState, useCallback, type FC, type ChangeEvent } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  useSettings,
  DEFAULT_SETTINGS,
  type ThemeMode,
  type SidebarPosition,
  type EditorFont,
  type AppSettings,
} from "@/lib/settings";

// ---------------------------------------------------------------------------
// Tiny reusable pieces (inline — no external component lib yet)
// ---------------------------------------------------------------------------

const SectionHeader: FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="mb-4">
    <h2 className="text-lg font-semibold" style={{ color: "var(--foreground-default)" }}>{title}</h2>
    {description && (
      <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-lighter)" }}>{description}</p>
    )}
  </div>
);

const Divider = () => <hr className="my-6" style={{ borderColor: "var(--border-default)" }} />;

const Label: FC<{ htmlFor?: string; children: React.ReactNode }> = ({
  htmlFor,
  children,
}) => (
  <label
    htmlFor={htmlFor}
    className="block text-sm font-medium mb-1"
    style={{ color: "var(--foreground-light)" }}
  >
    {children}
  </label>
);

const HelperText: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-lighter)" }}>{children}</p>
);

const TextInput: FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}> = ({ id, value, onChange, placeholder, type = "text" }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-md px-3 py-2 text-sm outline-none transition"
    style={{
      background: "var(--background-control)",
      border: "1px solid var(--border-control)",
      color: "var(--foreground-default)",
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = "var(--brand-default)";
      e.currentTarget.style.boxShadow = "0 0 0 1px hsla(153.1, 60.2%, 52.7%, 0.3)";
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = "var(--border-control)";
      e.currentTarget.style.boxShadow = "none";
    }}
  />
);

const StatusDot: FC<{ ok: boolean | null; label: string }> = ({
  ok,
  label,
}) => {
  const color =
    ok === null
      ? "var(--foreground-muted)"
      : ok
        ? "var(--brand-default)"
        : "var(--destructive-default)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-xs" style={{ color: "var(--foreground-lighter)" }}>{label}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Connection checking
// ---------------------------------------------------------------------------

type ConnStatus = { supabase: boolean | null; mcp: boolean | null };

async function checkConnection(
  url: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export const SettingsPage: FC = () => {
  const {
    settings,
    loading,
    saving,
    saveSuccess,
    save,
  } = useSettings();

  // Local draft state so the user can edit freely before saving
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>({
    supabase: null,
    mcp: null,
  });
  const [checking, setChecking] = useState(false);

  // Once settings load, initialise draft
  if (!loading && draft === null) {
    // We intentionally mutate via setDraft on first render after load
    // eslint-disable-next-line react-hooks/rules-of-hooks -- conditional but stable
    setDraft(settings);
  }

  const d = draft ?? DEFAULT_SETTINGS;

  // Patch helpers
  const patchConn = useCallback(
    (key: keyof AppSettings["connection"], value: string) => {
      setDraft((prev) => {
        const base = prev ?? DEFAULT_SETTINGS;
        return {
          ...base,
          connection: { ...base.connection, [key]: value },
        };
      });
    },
    [],
  );

  const patchAppearance = useCallback(
    <K extends keyof AppSettings["appearance"]>(
      key: K,
      value: AppSettings["appearance"][K],
    ) => {
      setDraft((prev) => {
        const base = prev ?? DEFAULT_SETTINGS;
        return {
          ...base,
          appearance: { ...base.appearance, [key]: value },
        };
      });
    },
    [],
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (draft) await save(draft);
  }, [draft, save]);

  // Test connections
  const handleTestConnections = useCallback(async () => {
    setChecking(true);
    setConnStatus({ supabase: null, mcp: null });
    const [supa, mcp] = await Promise.all([
      checkConnection(d.connection.supabaseUrl),
      checkConnection(d.connection.mcpServerUrl),
    ]);
    setConnStatus({ supabase: supa, mcp: mcp });
    setChecking(false);
  }, [d.connection.supabaseUrl, d.connection.mcpServerUrl]);

  // Generate random MCP token (placeholder — would call server in real use)
  const handleGenerateToken = useCallback(() => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const token = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    patchConn("mcpToken", `mcp_${token}`);
  }, [patchConn]);

  // Open logs directory
  const handleOpenLogs = useCallback(async () => {
    try {
      await open("file:///Users/" + (await getUsername()) + "/Library/Logs/");
    } catch {
      // Fallback: just try the common path
      await open("file:///tmp/");
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm" style={{ color: "var(--foreground-lighter)" }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-0 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground-default)" }}>Settings</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-lighter)" }}>
          Configure Orchestra Desktop. Changes are saved when you click Save.
        </p>
      </div>

      {/* ---- Toast ---- */}
      {saveSuccess && (
        <div
          className="sticky top-0 z-50 mb-4 flex items-center gap-2 rounded-md px-4 py-2 text-sm"
          style={{
            background: "var(--brand-400)",
            border: "1px solid var(--brand-500)",
            color: "var(--brand-600)",
          }}
        >
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8.5L7 11.5L12 4.5" />
          </svg>
          Settings saved successfully
        </div>
      )}

      {/* ================================================================ */}
      {/* CONNECTION SETTINGS                                              */}
      {/* ================================================================ */}
      <section
        className="rounded-lg p-5"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <SectionHeader
          title="Connection"
          description="Configure endpoints and authentication for Supabase and MCP services."
        />

        <div className="space-y-4">
          {/* Supabase URL */}
          <div>
            <Label htmlFor="supabaseUrl">Supabase URL</Label>
            <TextInput
              id="supabaseUrl"
              value={d.connection.supabaseUrl}
              onChange={(v) => patchConn("supabaseUrl", v)}
              placeholder="http://localhost:8000"
            />
            <HelperText>
              URL of your self-hosted Supabase Kong gateway.
            </HelperText>
          </div>

          {/* Supabase Anon Key */}
          <div>
            <Label htmlFor="supabaseAnonKey">Supabase Anon Key</Label>
            <TextInput
              id="supabaseAnonKey"
              value={d.connection.supabaseAnonKey}
              onChange={(v) => patchConn("supabaseAnonKey", v)}
              placeholder="eyJ..."
              type="password"
            />
            <HelperText>
              The anonymous public key for your Supabase project.
            </HelperText>
          </div>

          {/* MCP Server URL */}
          <div>
            <Label htmlFor="mcpServerUrl">MCP Server URL</Label>
            <TextInput
              id="mcpServerUrl"
              value={d.connection.mcpServerUrl}
              onChange={(v) => patchConn("mcpServerUrl", v)}
              placeholder="http://localhost:9999"
            />
            <HelperText>
              The Go MCP server endpoint. Default port is 9999.
            </HelperText>
          </div>

          {/* MCP Token */}
          <div>
            <Label htmlFor="mcpToken">MCP Token</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput
                  id="mcpToken"
                  value={d.connection.mcpToken}
                  onChange={(v) => patchConn("mcpToken", v)}
                  placeholder="mcp_..."
                  type="password"
                />
              </div>
              <button
                onClick={handleGenerateToken}
                className="shrink-0 rounded-md px-3 py-2 text-xs font-medium transition"
                style={{
                  background: "var(--background-surface-300)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground-light)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-default)";
                  e.currentTarget.style.color = "var(--brand-default)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.color = "var(--foreground-light)";
                }}
              >
                Generate
              </button>
            </div>
            <HelperText>
              Authentication token for the MCP server. Click Generate to create
              a new one.
            </HelperText>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleTestConnections}
              disabled={checking}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
              style={{
                background: "var(--background-surface-300)",
                border: "1px solid var(--border-strong)",
                color: "var(--foreground-light)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-default)";
                e.currentTarget.style.color = "var(--brand-default)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.color = "var(--foreground-light)";
              }}
            >
              {checking ? "Testing..." : "Test Connections"}
            </button>
            <StatusDot
              ok={connStatus.supabase}
              label={
                connStatus.supabase === null
                  ? "Supabase: not tested"
                  : connStatus.supabase
                    ? "Supabase: connected"
                    : "Supabase: unreachable"
              }
            />
            <StatusDot
              ok={connStatus.mcp}
              label={
                connStatus.mcp === null
                  ? "MCP: not tested"
                  : connStatus.mcp
                    ? "MCP: connected"
                    : "MCP: unreachable"
              }
            />
          </div>
        </div>
      </section>

      <Divider />

      {/* ================================================================ */}
      {/* APPEARANCE                                                        */}
      {/* ================================================================ */}
      <section
        className="rounded-lg p-5"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <SectionHeader
          title="Appearance"
          description="Customize the look and feel of the app."
        />

        <div className="space-y-5">
          {/* Theme */}
          <div>
            <Label>Theme</Label>
            <div className="flex gap-2 mt-1">
              {(["dark", "light", "system"] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => patchAppearance("theme", t)}
                  className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition ${t !== "dark" ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={
                    d.appearance.theme === t
                      ? {
                          border: "1px solid var(--brand-default)",
                          background: "var(--brand-400)",
                          color: "var(--brand-600)",
                        }
                      : {
                          border: "1px solid var(--border-strong)",
                          background: "var(--background-surface-300)",
                          color: "var(--foreground-lighter)",
                        }
                  }
                  disabled={t !== "dark"}
                  title={t !== "dark" ? "Coming soon" : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
            <HelperText>
              Only Dark mode is available in this version. Light and System
              themes are coming soon.
            </HelperText>
          </div>

          {/* Sidebar Position */}
          <div>
            <Label>Sidebar Position</Label>
            <div className="flex gap-2 mt-1">
              {(["left", "right"] as SidebarPosition[]).map((pos) => (
                <button
                  key={pos}
                  onClick={() => patchAppearance("sidebarPosition", pos)}
                  className="rounded-md px-4 py-2 text-sm font-medium capitalize transition"
                  style={
                    d.appearance.sidebarPosition === pos
                      ? {
                          border: "1px solid var(--brand-default)",
                          background: "var(--brand-400)",
                          color: "var(--brand-600)",
                        }
                      : {
                          border: "1px solid var(--border-strong)",
                          background: "var(--background-surface-300)",
                          color: "var(--foreground-lighter)",
                        }
                  }
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <Label htmlFor="fontSize">
              Font Size:{" "}
              <span style={{ color: "var(--brand-default)" }}>{d.appearance.fontSize}px</span>
            </Label>
            <input
              id="fontSize"
              type="range"
              min={12}
              max={20}
              step={1}
              value={d.appearance.fontSize}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                patchAppearance("fontSize", Number(e.target.value))
              }
              className="mt-1 w-full"
              style={{ accentColor: "hsl(153.1, 60.2%, 52.7%)" }}
            />
            <div className="flex justify-between text-[10px]" style={{ color: "var(--foreground-muted)" }}>
              <span>12px</span>
              <span>20px</span>
            </div>
          </div>

          {/* Editor Font */}
          <div>
            <Label htmlFor="editorFont">Editor Font</Label>
            <select
              id="editorFont"
              value={d.appearance.editorFont}
              onChange={(e) =>
                patchAppearance("editorFont", e.target.value as EditorFont)
              }
              className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none transition"
              style={{
                background: "var(--background-control)",
                border: "1px solid var(--border-control)",
                color: "var(--foreground-default)",
              }}
            >
              {(
                [
                  "ui-monospace",
                  "SF Mono",
                  "Cascadia Code",
                  "Fira Code",
                  "JetBrains Mono",
                  "Source Code Pro",
                ] as EditorFont[]
              ).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <HelperText>
              Font used in the Markdown editor and code blocks.
            </HelperText>
          </div>
        </div>
      </section>

      <Divider />

      {/* ================================================================ */}
      {/* KEYBOARD SHORTCUTS                                                */}
      {/* ================================================================ */}
      <section
        className="rounded-lg p-5"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <SectionHeader
          title="Keyboard Shortcuts"
          description="Default shortcuts for common actions. Customization coming soon."
        />

        <div className="space-y-3">
          {[
            { label: "Command Palette", keys: "\u2318K" },
            { label: "Save", keys: "\u2318S" },
            { label: "New Document", keys: "\u2318N" },
          ].map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex items-center justify-between rounded-md px-4 py-2.5"
              style={{
                background: "var(--background-surface-200)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="text-sm" style={{ color: "var(--foreground-light)" }}>{shortcut.label}</span>
              <kbd
                className="rounded-md px-2.5 py-1 text-xs font-mono"
                style={{
                  background: "var(--background-surface-300)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground-lighter)",
                }}
              >
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ================================================================ */}
      {/* ABOUT                                                             */}
      {/* ================================================================ */}
      <section
        className="rounded-lg p-5"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <SectionHeader title="About" />

        <div className="space-y-3">
          {/* Version */}
          <div
            className="flex items-center justify-between rounded-md px-4 py-2.5"
            style={{
              background: "var(--background-surface-200)",
              border: "1px solid var(--border-default)",
            }}
          >
            <span className="text-sm" style={{ color: "var(--foreground-light)" }}>Version</span>
            <span
              className="rounded px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--brand-400)",
                color: "var(--brand-default)",
              }}
            >
              v0.1.0
            </span>
          </div>

          {/* Buttons row */}
          <div className="flex gap-2 pt-1">
            <button
              disabled
              className="rounded-md px-4 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
              style={{
                background: "var(--background-surface-300)",
                border: "1px solid var(--border-strong)",
                color: "var(--foreground-lighter)",
              }}
            >
              Check for Updates
            </button>
            <button
              onClick={handleOpenLogs}
              className="rounded-md px-4 py-2 text-xs font-medium transition"
              style={{
                background: "var(--background-surface-300)",
                border: "1px solid var(--border-strong)",
                color: "var(--foreground-light)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-default)";
                e.currentTarget.style.color = "var(--brand-default)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.color = "var(--foreground-light)";
              }}
            >
              Open Logs
            </button>
          </div>
        </div>
      </section>

      <Divider />

      {/* ================================================================ */}
      {/* SAVE / RESET                                                      */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setDraft(DEFAULT_SETTINGS)}
          className="rounded-md px-4 py-2 text-sm font-medium transition"
          style={{
            background: "var(--background-surface-300)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground-lighter)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--destructive-default)";
            e.currentTarget.style.color = "var(--destructive-default)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--foreground-lighter)";
          }}
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
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
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort username for log directory path */
async function getUsername(): Promise<string> {
  try {
    // The Tauri path API is not available yet; use a simple heuristic
    const parts = window.location.pathname.split("/");
    return parts[2] || "user";
  } catch {
    return "user";
  }
}
