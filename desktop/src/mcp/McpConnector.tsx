import { useState, useEffect, useCallback, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionTestResult {
  success: boolean;
  server_url: string;
  server_name: string | null;
  server_version: string | null;
  protocol_version: string | null;
  tools_count: number | null;
  error: string | null;
  latency_ms: number;
}

interface ConfigGenerationResult {
  success: boolean;
  config_path: string;
  config_content: string;
  written: boolean;
  error: string | null;
}

interface ConfigPaths {
  claude_desktop: string;
  claude_code_global: string;
}

type ConnectionStatus = "idle" | "testing" | "connected" | "error";
type InstallTarget =
  | "claude_desktop"
  | "claude_code_global"
  | "claude_code_project";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusDot: FC<{ status: ConnectionStatus }> = ({ status }) => {
  const colorMap: Record<ConnectionStatus, string> = {
    idle: "var(--foreground-muted)",
    testing: "var(--warning-default)",
    connected: "var(--brand-default)",
    error: "var(--destructive-default)",
  };
  return (
    <div
      className={`h-2.5 w-2.5 rounded-full ${status === "testing" ? "animate-pulse" : ""}`}
      style={{
        background: colorMap[status],
        boxShadow: status === "connected"
          ? "0 0 6px hsla(153.1, 60.2%, 52.7%, 0.25)"
          : "none",
      }}
    />
  );
};

const SectionCard: FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div
    className="rounded-lg p-5"
    style={{
      background: "var(--background-surface-100)",
      border: "1px solid var(--border-default)",
    }}
  >
    <h3 className="text-sm font-semibold" style={{ color: "var(--foreground-default)" }}>{title}</h3>
    {description && (
      <p className="mt-1 text-xs" style={{ color: "var(--foreground-lighter)" }}>{description}</p>
    )}
    <div className="mt-4">{children}</div>
  </div>
);

const CopyButton: FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded px-2 py-1 text-[10px] font-medium transition-colors"
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
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const McpConnector: FC = () => {
  // Settings
  const [serverUrl, setServerUrl] = useState("http://localhost:9999");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Connection state
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );

  // Config state
  const [configPaths, setConfigPaths] = useState<ConfigPaths | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<
    "claude_desktop" | "claude_code"
  >("claude_desktop");
  const [installResult, setInstallResult] =
    useState<ConfigGenerationResult | null>(null);
  const [installing, setInstalling] = useState(false);
  const [projectPath, setProjectPath] = useState("");

  // Load config paths on mount
  useEffect(() => {
    invoke<ConfigPaths>("mcp_get_config_paths").then(setConfigPaths).catch(() => {});
  }, []);

  // Preview config when settings change
  useEffect(() => {
    const cmd =
      configTarget === "claude_desktop"
        ? "mcp_generate_claude_desktop_config"
        : "mcp_generate_claude_code_config";
    invoke<string>(cmd, { serverUrl, token })
      .then(setGeneratedConfig)
      .catch(() => setGeneratedConfig(null));
  }, [serverUrl, token, configTarget]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing");
    setTestResult(null);
    try {
      const result = await invoke<ConnectionTestResult>("mcp_test_connection", {
        serverUrl,
        token,
      });
      setTestResult(result);
      setConnectionStatus(result.success ? "connected" : "error");
    } catch (err) {
      setTestResult({
        success: false,
        server_url: serverUrl,
        server_name: null,
        server_version: null,
        protocol_version: null,
        tools_count: null,
        error: String(err),
        latency_ms: 0,
      });
      setConnectionStatus("error");
    }
  }, [serverUrl, token]);

  const handleInstall = useCallback(
    async (target: InstallTarget) => {
      setInstalling(true);
      setInstallResult(null);
      try {
        let result: ConfigGenerationResult;
        switch (target) {
          case "claude_desktop":
            result = await invoke<ConfigGenerationResult>(
              "mcp_install_claude_desktop",
              { serverUrl, token },
            );
            break;
          case "claude_code_global":
            result = await invoke<ConfigGenerationResult>(
              "mcp_install_claude_code_global",
              { serverUrl, token },
            );
            break;
          case "claude_code_project":
            result = await invoke<ConfigGenerationResult>(
              "mcp_install_claude_code_project",
              { projectPath, serverUrl, token },
            );
            break;
        }
        setInstallResult(result);
      } catch (err) {
        setInstallResult({
          success: false,
          config_path: "",
          config_content: "",
          written: false,
          error: String(err),
        });
      } finally {
        setInstalling(false);
      }
    },
    [serverUrl, token, projectPath],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground-default)" }}>MCP Connection</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-lighter)" }}>
          Connect Claude Desktop and Claude Code to your Orchestra MCP server.
        </p>
      </div>

      {/* Connection Status Banner */}
      <div
        className="flex items-center justify-between rounded-lg p-4"
        style={{
          background: "var(--background-surface-100)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          <StatusDot status={connectionStatus} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground-default)" }}>
              {connectionStatus === "idle" && "Not tested"}
              {connectionStatus === "testing" && "Testing connection..."}
              {connectionStatus === "connected" && "Connected"}
              {connectionStatus === "error" && "Connection failed"}
            </p>
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
              {testResult?.success
                ? `${testResult.server_name} v${testResult.server_version} | ${testResult.tools_count ?? 0} tools | ${testResult.latency_ms}ms`
                : testResult?.error
                  ? testResult.error
                  : serverUrl}
            </p>
          </div>
        </div>
        <button
          onClick={handleTestConnection}
          disabled={connectionStatus === "testing"}
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
          {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
        </button>
      </div>

      {/* Server Settings */}
      <SectionCard
        title="Server Settings"
        description="Configure the Orchestra MCP server URL and authentication token."
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--foreground-lighter)" }}>
              MCP Server URL
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:9999"
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--background-control)",
                border: "1px solid var(--border-control)",
                color: "var(--foreground-default)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--brand-default)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-control)"; }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--foreground-lighter)" }}>
              MCP Token
            </label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your MCP token"
                className="flex-1 rounded-md px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "var(--background-control)",
                  border: "1px solid var(--border-control)",
                  color: "var(--foreground-default)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--brand-default)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-control)"; }}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="rounded-md px-3 py-2 text-xs font-medium transition-colors"
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
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-[10px]" style={{ color: "var(--foreground-muted)" }}>
              Get your token from the Orchestra web dashboard after registration.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Install to Claude Desktop */}
      <SectionCard
        title="Claude Desktop"
        description="Install Orchestra as an MCP server in Claude Desktop. Requires restarting Claude Desktop after installation."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: "var(--foreground-lighter)" }}>Config file:</p>
              <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                {configPaths?.claude_desktop ?? "~/Library/Application Support/Claude/claude_desktop_config.json"}
              </p>
            </div>
            <button
              onClick={() => handleInstall("claude_desktop")}
              disabled={installing}
              className="rounded-md px-4 py-2 text-xs font-medium transition-all disabled:opacity-50"
              style={{
                background: "var(--brand-default)",
                color: "var(--foreground-contrast)",
              }}
            >
              {installing ? "Installing..." : "Install Config"}
            </button>
          </div>

          {/* Preview toggle */}
          <div>
            <button
              onClick={() =>
                setConfigTarget(
                  configTarget === "claude_desktop"
                    ? "claude_code"
                    : "claude_desktop",
                )
              }
              className="text-[10px] font-medium"
              style={{ color: "var(--brand-default)" }}
            >
              {configTarget === "claude_desktop"
                ? "Showing Claude Desktop config"
                : "Showing Claude Code config"}{" "}
              (click to switch)
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Install to Claude Code */}
      <SectionCard
        title="Claude Code"
        description="Install Orchestra as an MCP server for Claude Code. Choose global (all projects) or project-specific."
      >
        <div className="space-y-4">
          {/* Global install */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--foreground-light)" }}>Global</p>
              <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                {configPaths?.claude_code_global ?? "~/.claude/mcp.json"}
              </p>
            </div>
            <button
              onClick={() => handleInstall("claude_code_global")}
              disabled={installing}
              className="rounded-md px-4 py-2 text-xs font-medium transition-all disabled:opacity-50"
              style={{
                background: "var(--brand-default)",
                color: "var(--foreground-contrast)",
              }}
            >
              {installing ? "Installing..." : "Install Global"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--border-default)" }} />

          {/* Project-specific install */}
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--foreground-light)" }}>
              Project-Specific
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--foreground-lighter)" }}>
              Creates a .mcp.json in the specified project directory.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="flex-1 rounded-md px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "var(--background-control)",
                  border: "1px solid var(--border-control)",
                  color: "var(--foreground-default)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--brand-default)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-control)"; }}
              />
              <button
                onClick={() => handleInstall("claude_code_project")}
                disabled={installing || !projectPath}
                className="rounded-md px-4 py-2 text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  background: "var(--brand-default)",
                  color: "var(--foreground-contrast)",
                }}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Install Result */}
      {installResult && (
        <div
          className="rounded-lg p-4"
          style={{
            background: installResult.success ? "var(--brand-400)" : "var(--destructive-200)",
            border: `1px solid ${installResult.success ? "var(--brand-500)" : "hsla(10.2, 77.9%, 53.9%, 0.3)"}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                background: installResult.success ? "var(--brand-default)" : "var(--destructive-default)",
              }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium"
                style={{
                  color: installResult.success ? "var(--brand-600)" : "var(--destructive-600)",
                }}
              >
                {installResult.success
                  ? "Config installed successfully"
                  : "Installation failed"}
              </p>
              {installResult.success && (
                <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--foreground-lighter)" }}>
                  {installResult.config_path}
                </p>
              )}
              {installResult.error && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--destructive-600)" }}>
                  {installResult.error}
                </p>
              )}
              {installResult.success && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--foreground-lighter)" }}>
                  Restart Claude Desktop / Claude Code for changes to take
                  effect.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Preview */}
      <SectionCard
        title="Config Preview"
        description="The JSON configuration that will be written. You can also copy this manually."
      >
        <div className="relative">
          <div className="absolute right-2 top-2">
            <CopyButton text={generatedConfig ?? ""} />
          </div>
          <pre
            className="max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed"
            style={{
              background: "var(--background-default)",
              color: "var(--foreground-lighter)",
            }}
          >
            {generatedConfig ?? "Loading..."}
          </pre>
        </div>
      </SectionCard>

      {/* Server Info (when connected) */}
      {testResult?.success && (
        <SectionCard title="Server Info">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Server", value: testResult.server_name },
              { label: "Version", value: testResult.server_version },
              { label: "Protocol", value: testResult.protocol_version },
              {
                label: "Tools",
                value:
                  testResult.tools_count !== null
                    ? String(testResult.tools_count)
                    : null,
              },
              { label: "Latency", value: `${testResult.latency_ms}ms` },
              { label: "URL", value: testResult.server_url },
            ].map(
              (item) =>
                item.value && (
                  <div key={item.label}>
                    <p className="text-[10px] font-medium" style={{ color: "var(--foreground-lighter)" }}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-light)" }}>
                      {item.value}
                    </p>
                  </div>
                ),
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default McpConnector;
