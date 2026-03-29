// MCP Bridge — Local stdio MCP server that proxies to the Go MCP server
//
// This module provides:
// 1. A stdio-based MCP proxy that Claude Desktop/Code can connect to
// 2. Config generation for Claude Desktop and Claude Code
// 3. Connection testing against the remote MCP server
//
// The stdio bridge reads JSON-RPC messages from stdin, forwards them to
// the Go MCP server at http://localhost:9999/mcp via Streamable HTTP,
// and writes responses back to stdout.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

/// MCP endpoint path on the Go server.
const MCP_ENDPOINT: &str = "/mcp";

/// Health check endpoint.
const HEALTH_ENDPOINT: &str = "/mcp/health";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Configuration for the MCP bridge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpBridgeConfig {
    pub server_url: String,
    pub token: String,
}

/// Result of a connection test.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub server_url: String,
    pub server_name: Option<String>,
    pub server_version: Option<String>,
    pub protocol_version: Option<String>,
    pub tools_count: Option<usize>,
    pub error: Option<String>,
    pub latency_ms: u64,
}

/// Result of config generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGenerationResult {
    pub success: bool,
    pub config_path: String,
    pub config_content: String,
    pub written: bool,
    pub error: Option<String>,
}

/// Claude Desktop config entry for an MCP server.
#[derive(Debug, Serialize, Deserialize)]
struct ClaudeDesktopMcpEntry {
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    headers: Option<std::collections::HashMap<String, String>>,
}

/// Full Claude Desktop config shape (mcpServers section).
#[derive(Debug, Serialize, Deserialize)]
struct ClaudeDesktopConfig {
    #[serde(rename = "mcpServers")]
    mcp_servers: std::collections::HashMap<String, ClaudeDesktopMcpEntry>,
}

/// Claude Code .mcp.json entry using streamableHttp transport.
#[derive(Debug, Serialize, Deserialize)]
struct ClaudeCodeMcpEntry {
    #[serde(rename = "type")]
    transport_type: String,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    headers: Option<std::collections::HashMap<String, String>>,
}

/// Full Claude Code .mcp.json shape.
#[derive(Debug, Serialize, Deserialize)]
struct ClaudeCodeConfig {
    #[serde(rename = "mcpServers")]
    mcp_servers: std::collections::HashMap<String, ClaudeCodeMcpEntry>,
}

// ---------------------------------------------------------------------------
// Connection Testing
// ---------------------------------------------------------------------------

/// Test the connection to the MCP server by sending an initialize request
/// and optionally a tools/list request.
pub async fn test_connection(server_url: &str, token: &str) -> ConnectionTestResult {
    let client = Client::new();
    let start = std::time::Instant::now();

    // First try the health endpoint.
    let health_url = format!("{}{}", server_url, HEALTH_ENDPOINT);
    let health_result = client.get(&health_url).send().await;

    if let Err(e) = health_result {
        return ConnectionTestResult {
            success: false,
            server_url: server_url.to_string(),
            server_name: None,
            server_version: None,
            protocol_version: None,
            tools_count: None,
            error: Some(format!("Cannot reach server: {}", e)),
            latency_ms: start.elapsed().as_millis() as u64,
        };
    }

    // Send an MCP initialize request via POST.
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);
    let init_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {
                "name": "orchestra-desktop",
                "version": env!("CARGO_PKG_VERSION")
            }
        }
    });

    let mut req_builder = client
        .post(&mcp_url)
        .header("Content-Type", "application/json");

    if !token.is_empty() {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", token));
    }

    let init_response = match req_builder.json(&init_request).send().await {
        Ok(resp) => resp,
        Err(e) => {
            return ConnectionTestResult {
                success: false,
                server_url: server_url.to_string(),
                server_name: None,
                server_version: None,
                protocol_version: None,
                tools_count: None,
                error: Some(format!("Initialize request failed: {}", e)),
                latency_ms: start.elapsed().as_millis() as u64,
            };
        }
    };

    if !init_response.status().is_success() {
        let status = init_response.status();
        let body = init_response.text().await.unwrap_or_default();
        return ConnectionTestResult {
            success: false,
            server_url: server_url.to_string(),
            server_name: None,
            server_version: None,
            protocol_version: None,
            tools_count: None,
            error: Some(format!("Server returned {}: {}", status, body)),
            latency_ms: start.elapsed().as_millis() as u64,
        };
    }

    // Extract session ID from response header.
    let session_id = init_response
        .headers()
        .get("mcp-session-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Parse the initialize response.
    let init_body: serde_json::Value = match init_response.json().await {
        Ok(v) => v,
        Err(e) => {
            return ConnectionTestResult {
                success: false,
                server_url: server_url.to_string(),
                server_name: None,
                server_version: None,
                protocol_version: None,
                tools_count: None,
                error: Some(format!("Failed to parse response: {}", e)),
                latency_ms: start.elapsed().as_millis() as u64,
            };
        }
    };

    let result = init_body.get("result");
    let server_name = result
        .and_then(|r| r.get("serverInfo"))
        .and_then(|si| si.get("name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());
    let server_version = result
        .and_then(|r| r.get("serverInfo"))
        .and_then(|si| si.get("version"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let protocol_version = result
        .and_then(|r| r.get("protocolVersion"))
        .and_then(|pv| pv.as_str())
        .map(|s| s.to_string());

    // Now try tools/list to get tool count.
    let mut tools_count = None;
    if let Some(ref sid) = session_id {
        let tools_request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        });

        let mut tools_req_builder = client
            .post(&mcp_url)
            .header("Content-Type", "application/json")
            .header("Mcp-Session-Id", sid.as_str());

        if !token.is_empty() {
            tools_req_builder =
                tools_req_builder.header("Authorization", format!("Bearer {}", token));
        }

        if let Ok(tools_resp) = tools_req_builder.json(&tools_request).send().await {
            if tools_resp.status().is_success() {
                if let Ok(tools_body) = tools_resp.json::<serde_json::Value>().await {
                    tools_count = tools_body
                        .get("result")
                        .and_then(|r| r.get("tools"))
                        .and_then(|t| t.as_array())
                        .map(|arr| arr.len());
                }
            }
        }
    }

    ConnectionTestResult {
        success: true,
        server_url: server_url.to_string(),
        server_name,
        server_version,
        protocol_version,
        tools_count,
        error: None,
        latency_ms: start.elapsed().as_millis() as u64,
    }
}

// ---------------------------------------------------------------------------
// Config Generation
// ---------------------------------------------------------------------------

/// Get the path to the Claude Desktop config file.
pub fn claude_desktop_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));

    #[cfg(target_os = "macos")]
    {
        home.join("Library")
            .join("Application Support")
            .join("Claude")
            .join("claude_desktop_config.json")
    }

    #[cfg(target_os = "windows")]
    {
        home.join("AppData")
            .join("Roaming")
            .join("Claude")
            .join("claude_desktop_config.json")
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        home.join(".config")
            .join("claude")
            .join("claude_desktop_config.json")
    }
}

/// Get the path to the Claude Code global MCP config.
pub fn claude_code_global_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    home.join(".claude").join("mcp.json")
}

/// Generate the Claude Desktop configuration entry.
pub fn generate_claude_desktop_config(server_url: &str, token: &str) -> String {
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);
    let mut headers = std::collections::HashMap::new();
    if !token.is_empty() {
        headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    }

    let entry = ClaudeDesktopMcpEntry {
        url: mcp_url,
        headers: if headers.is_empty() {
            None
        } else {
            Some(headers)
        },
    };

    let mut servers = std::collections::HashMap::new();
    servers.insert("orchestra".to_string(), entry);

    let config = ClaudeDesktopConfig {
        mcp_servers: servers,
    };

    serde_json::to_string_pretty(&config).unwrap_or_default()
}

/// Generate the Claude Code .mcp.json configuration entry.
pub fn generate_claude_code_config(server_url: &str, token: &str) -> String {
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);
    let mut headers = std::collections::HashMap::new();
    if !token.is_empty() {
        headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    }

    let entry = ClaudeCodeMcpEntry {
        transport_type: "streamableHttp".to_string(),
        url: mcp_url,
        headers: if headers.is_empty() {
            None
        } else {
            Some(headers)
        },
    };

    let mut servers = std::collections::HashMap::new();
    servers.insert("orchestra".to_string(), entry);

    let config = ClaudeCodeConfig {
        mcp_servers: servers,
    };

    serde_json::to_string_pretty(&config).unwrap_or_default()
}

/// Write the Claude Desktop config, merging with any existing configuration.
pub fn write_claude_desktop_config(
    server_url: &str,
    token: &str,
) -> Result<ConfigGenerationResult, String> {
    let config_path = claude_desktop_config_path();
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);

    // Read existing config or start fresh.
    let mut existing: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read existing config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Build our orchestra entry.
    let mut entry = serde_json::json!({
        "url": mcp_url
    });

    if !token.is_empty() {
        entry["headers"] = serde_json::json!({
            "Authorization": format!("Bearer {}", token)
        });
    }

    // Merge into mcpServers.
    if !existing.get("mcpServers").is_some() {
        existing["mcpServers"] = serde_json::json!({});
    }
    existing["mcpServers"]["orchestra"] = entry;

    let config_content =
        serde_json::to_string_pretty(&existing).map_err(|e| format!("Serialize error: {}", e))?;

    // Ensure parent directory exists.
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Write the file.
    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(ConfigGenerationResult {
        success: true,
        config_path: config_path.to_string_lossy().to_string(),
        config_content,
        written: true,
        error: None,
    })
}

/// Write a project-level .mcp.json for Claude Code.
pub fn write_claude_code_project_config(
    project_path: &str,
    server_url: &str,
    token: &str,
) -> Result<ConfigGenerationResult, String> {
    let config_path = PathBuf::from(project_path).join(".mcp.json");
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);

    // Read existing config or start fresh.
    let mut existing: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read existing config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Build our orchestra entry.
    let mut entry = serde_json::json!({
        "type": "streamableHttp",
        "url": mcp_url
    });

    if !token.is_empty() {
        entry["headers"] = serde_json::json!({
            "Authorization": format!("Bearer {}", token)
        });
    }

    // Merge into mcpServers.
    if !existing.get("mcpServers").is_some() {
        existing["mcpServers"] = serde_json::json!({});
    }
    existing["mcpServers"]["orchestra"] = entry;

    let config_content =
        serde_json::to_string_pretty(&existing).map_err(|e| format!("Serialize error: {}", e))?;

    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(ConfigGenerationResult {
        success: true,
        config_path: config_path.to_string_lossy().to_string(),
        config_content,
        written: true,
        error: None,
    })
}

/// Write the Claude Code global MCP config (~/.claude/mcp.json).
pub fn write_claude_code_global_config(
    server_url: &str,
    token: &str,
) -> Result<ConfigGenerationResult, String> {
    let config_path = claude_code_global_config_path();
    let mcp_url = format!("{}{}", server_url, MCP_ENDPOINT);

    // Read existing config or start fresh.
    let mut existing: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read existing config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Build our orchestra entry.
    let mut entry = serde_json::json!({
        "type": "streamableHttp",
        "url": mcp_url
    });

    if !token.is_empty() {
        entry["headers"] = serde_json::json!({
            "Authorization": format!("Bearer {}", token)
        });
    }

    // Merge into mcpServers.
    if !existing.get("mcpServers").is_some() {
        existing["mcpServers"] = serde_json::json!({});
    }
    existing["mcpServers"]["orchestra"] = entry;

    let config_content =
        serde_json::to_string_pretty(&existing).map_err(|e| format!("Serialize error: {}", e))?;

    // Ensure parent directory exists.
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(ConfigGenerationResult {
        success: true,
        config_path: config_path.to_string_lossy().to_string(),
        config_content,
        written: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Stdio Bridge (spawned as a sidecar process)
// ---------------------------------------------------------------------------

/// Run the stdio MCP bridge. This is meant to be called as a standalone
/// process that reads JSON-RPC from stdin and writes responses to stdout.
/// Each message is forwarded to the Go MCP server via HTTP POST.
pub async fn run_stdio_bridge(config: McpBridgeConfig) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let mcp_url = format!("{}{}", config.server_url, MCP_ENDPOINT);
    let mut session_id: Option<String> = None;

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();

    while let Some(line) = lines.next_line().await? {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        // Parse as JSON to validate.
        let request: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let error_response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {}", e)
                    }
                });
                let resp_str = serde_json::to_string(&error_response)?;
                stdout.write_all(resp_str.as_bytes()).await?;
                stdout.write_all(b"\n").await?;
                stdout.flush().await?;
                continue;
            }
        };

        // Forward to the Go server.
        let mut req_builder = client
            .post(&mcp_url)
            .header("Content-Type", "application/json");

        if !config.token.is_empty() {
            req_builder =
                req_builder.header("Authorization", format!("Bearer {}", config.token));
        }

        if let Some(ref sid) = session_id {
            req_builder = req_builder.header("Mcp-Session-Id", sid.as_str());
        }

        match req_builder.json(&request).send().await {
            Ok(response) => {
                // Capture session ID from initialize response.
                if let Some(sid) = response.headers().get("mcp-session-id") {
                    if let Ok(sid_str) = sid.to_str() {
                        session_id = Some(sid_str.to_string());
                    }
                }

                // Check if notification (HTTP 202 = accepted, no body to relay).
                if response.status() == reqwest::StatusCode::ACCEPTED {
                    continue;
                }

                let body = response.text().await.unwrap_or_default();
                if !body.is_empty() {
                    stdout.write_all(body.as_bytes()).await?;
                    stdout.write_all(b"\n").await?;
                    stdout.flush().await?;
                }
            }
            Err(e) => {
                let id = request.get("id").cloned();
                let error_response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": {
                        "code": -32603,
                        "message": format!("Proxy error: {}", e)
                    }
                });
                let resp_str = serde_json::to_string(&error_response)?;
                stdout.write_all(resp_str.as_bytes()).await?;
                stdout.write_all(b"\n").await?;
                stdout.flush().await?;
            }
        }
    }

    Ok(())
}
