// MCP Server — Entry Point
//
// Starts the stdio MCP server as a background tokio task.
// The server is started from lib.rs during Tauri app setup.
//
// When run with `--mcp-stdio` CLI arg, the app enters pure MCP
// server mode (no GUI) — reads from stdin, writes to stdout.
// Otherwise, the MCP server is available for on-demand use.

use std::path::PathBuf;

/// Read the MCP token from Tauri's settings.json file.
/// Returns empty string if not found.
fn read_mcp_token() -> String {
    // Tauri stores settings.json in the app data directory
    // macOS: ~/Library/Application Support/io.orchestra.desktop/
    let app_data = dirs::data_dir()
        .or_else(|| dirs::config_dir())
        .unwrap_or_else(|| PathBuf::from("."));
    let settings_path = app_data.join("io.orchestra.desktop").join("settings.json");

    if let Ok(content) = std::fs::read_to_string(&settings_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(token) = json.get("connection")
                .and_then(|c| c.get("mcpToken"))
                .and_then(|t| t.as_str())
            {
                if !token.is_empty() {
                    log::info!("[MCP] Token loaded from settings: {}...{}", &token[..8.min(token.len())], &token[token.len().saturating_sub(4)..]);
                    return token.to_string();
                }
            }
        }
    }

    log::warn!("[MCP] No token found in settings.json");
    String::new()
}

/// Start the MCP stdio server as a background tokio task.
///
/// This is called from lib.rs setup() when the app launches.
/// The server runs indefinitely until stdin is closed.
pub fn start_mcp_server() {
    // Check if we were launched in MCP stdio mode (standalone)
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--mcp-stdio") {
        log::info!("[MCP] Starting in stdio server mode");
        // stdio mode needs tokio — but that's only used when launched as subprocess
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async {
                super::stdio::run_stdio_loop().await;
            });
        });
    } else {
        // Desktop GUI mode — start HTTP MCP server on localhost:9998
        let port = super::http::DEFAULT_PORT;
        log::info!("[MCP] Starting HTTP MCP server on port {}", port);

        // Start HTTP server in a plain OS thread (tiny_http is blocking, no tokio needed)
        std::thread::spawn(move || {
            super::http::run_http_server_blocking(port);
        });

        // Write .mcp.json config with token (synchronous, runs once)
        if let Some(home) = dirs::home_dir() {
            let workspace = std::env::args()
                .skip_while(|a| a != "--workspace")
                .nth(1)
                .unwrap_or_else(|| home.to_string_lossy().to_string());

            let workspace_path = PathBuf::from(&workspace);
            if workspace_path.exists() {
                match write_mcp_config(&workspace_path.to_string_lossy()) {
                    Ok(p) => log::info!("[MCP] Config written to {}", p),
                    Err(e) => log::warn!("[MCP] Failed to write config: {}", e),
                }
            }
        }
    }
}

/// Generate the .mcp.json config that Claude clients can use to connect
/// to the Desktop MCP HTTP server running on localhost.
pub fn generate_mcp_config(_workspace_path: &str) -> Result<String, String> {
    let port = super::http::DEFAULT_PORT;
    let token = read_mcp_token();

    let url = if token.is_empty() {
        format!("http://localhost:{}/mcp", port)
    } else {
        format!("http://localhost:{}/mcp?token={}", port, token)
    };

    let config = serde_json::json!({
        "mcpServers": {
            "orchestra-desktop": {
                "type": "http",
                "url": url
            }
        }
    });

    serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize MCP config: {}", e))
}

/// Write the .mcp.json config to the workspace directory.
pub fn write_mcp_config(workspace_path: &str) -> Result<String, String> {
    let config_content = generate_mcp_config(workspace_path)?;
    let config_path = PathBuf::from(workspace_path).join(".mcp.json");

    // If .mcp.json already exists, merge our server into it
    let final_content = if config_path.exists() {
        let existing = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read existing .mcp.json: {}", e))?;
        merge_mcp_config(&existing, workspace_path)?
    } else {
        config_content.clone()
    };

    std::fs::write(&config_path, &final_content)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))?;

    Ok(config_path.to_string_lossy().to_string())
}

/// Merge our `orchestra-desktop` server entry into an existing .mcp.json.
fn merge_mcp_config(existing_json: &str, _workspace_path: &str) -> Result<String, String> {
    let mut existing: serde_json::Value = serde_json::from_str(existing_json)
        .map_err(|e| format!("Failed to parse existing .mcp.json: {}", e))?;

    let port = super::http::DEFAULT_PORT;
    let token = read_mcp_token();

    let url = if token.is_empty() {
        format!("http://localhost:{}/mcp", port)
    } else {
        format!("http://localhost:{}/mcp?token={}", port, token)
    };

    let our_server = serde_json::json!({
        "type": "http",
        "url": url
    });

    // Ensure mcpServers object exists
    if !existing.get("mcpServers").is_some() {
        existing["mcpServers"] = serde_json::json!({});
    }

    existing["mcpServers"]["orchestra-desktop"] = our_server;

    serde_json::to_string_pretty(&existing)
        .map_err(|e| format!("Failed to serialize merged config: {}", e))
}

