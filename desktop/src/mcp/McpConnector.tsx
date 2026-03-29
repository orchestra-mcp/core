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
  const colors: Record<ConnectionStatus, string> = {
    idle: "bg-zinc-600",
    testing: "bg-amber-500 animate-pulse",
    connected: "bg-emerald-500 shadow-lg shadow-emerald-500/30",
    error: "bg-red-500 shadow-lg shadow-red-500/30",
  };
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />;
};

const SectionCard: FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
    <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
    {description && (
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
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
      className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
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
        <h1 className="text-2xl font-bold text-zinc-100">MCP Connection</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect Claude Desktop and Claude Code to your Orchestra MCP server.
        </p>
      </div>

      {/* Connection Status Banner */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-3">
          <StatusDot status={connectionStatus} />
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {connectionStatus === "idle" && "Not tested"}
              {connectionStatus === "testing" && "Testing connection..."}
              {connectionStatus === "connected" && "Connected"}
              {connectionStatus === "error" && "Connection failed"}
            </p>
            <p className="text-xs text-zinc-600">
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
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
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
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              MCP Server URL
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:9999"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              MCP Token
            </label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your MCP token"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
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
              <p className="text-xs text-zinc-400">Config file:</p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                {configPaths?.claude_desktop ?? "~/Library/Application Support/Claude/claude_desktop_config.json"}
              </p>
            </div>
            <button
              onClick={() => handleInstall("claude_desktop")}
              disabled={installing}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-violet-400 disabled:opacity-50"
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
              className="text-[10px] font-medium text-violet-400 hover:text-violet-300"
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
              <p className="text-xs font-medium text-zinc-300">Global</p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                {configPaths?.claude_code_global ?? "~/.claude/mcp.json"}
              </p>
            </div>
            <button
              onClick={() => handleInstall("claude_code_global")}
              disabled={installing}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
            >
              {installing ? "Installing..." : "Install Global"}
            </button>
          </div>

          <div className="border-t border-zinc-800" />

          {/* Project-specific install */}
          <div>
            <p className="text-xs font-medium text-zinc-300">
              Project-Specific
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Creates a .mcp.json in the specified project directory.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-blue-500"
              />
              <button
                onClick={() => handleInstall("claude_code_project")}
                disabled={installing || !projectPath}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
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
          className={`rounded-xl border p-4 ${
            installResult.success
              ? "border-emerald-800 bg-emerald-950/30"
              : "border-red-800 bg-red-950/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                installResult.success ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  installResult.success ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {installResult.success
                  ? "Config installed successfully"
                  : "Installation failed"}
              </p>
              {installResult.success && (
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  {installResult.config_path}
                </p>
              )}
              {installResult.error && (
                <p className="mt-0.5 text-xs text-red-400">
                  {installResult.error}
                </p>
              )}
              {installResult.success && (
                <p className="mt-2 text-[10px] text-zinc-500">
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
          <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
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
                    <p className="text-[10px] font-medium text-zinc-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-300">
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
