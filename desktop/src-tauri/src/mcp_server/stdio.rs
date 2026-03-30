// MCP Server — Stdio Transport
//
// Reads line-delimited JSON-RPC 2.0 messages from stdin,
// dispatches them to the MCP server handler, and writes
// JSON-RPC responses to stdout.
//
// This runs as a background tokio task spawned from server.rs.

use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

use super::types::*;
use super::{MCP_VERSION, SERVER_NAME, SERVER_VERSION};

/// Run the stdio MCP server loop.
///
/// Reads one JSON-RPC message per line from stdin, handles it,
/// and writes the response as a single line to stdout.
/// Exits when stdin is closed (EOF).
pub async fn run_stdio_loop() {
    log::info!("[MCP] Stdio transport started (spec {})", MCP_VERSION);

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();

    let mut initialized = false;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        log::debug!("[MCP] << {}", &line);

        // Parse JSON-RPC request
        let request: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(req) => req,
            Err(e) => {
                let resp = JsonRpcResponse::error(None, PARSE_ERROR, format!("Parse error: {}", e));
                write_response(&mut stdout, &resp).await;
                continue;
            }
        };

        // Dispatch by method
        let response = match request.method.as_str() {
            "initialize" => handle_initialize(&request),
            "initialized" => {
                // Notification — no response expected
                initialized = true;
                log::info!("[MCP] Client initialized");
                continue;
            }
            "ping" => handle_ping(&request),
            "tools/list" => {
                if !initialized {
                    JsonRpcResponse::error(
                        request.id.clone(),
                        INVALID_REQUEST,
                        "Server not yet initialized",
                    )
                } else {
                    handle_tools_list(&request)
                }
            }
            "tools/call" => {
                if !initialized {
                    JsonRpcResponse::error(
                        request.id.clone(),
                        INVALID_REQUEST,
                        "Server not yet initialized",
                    )
                } else {
                    handle_tools_call(&request)
                }
            }
            "notifications/cancelled" => {
                // Client-initiated cancellation — acknowledge silently
                log::debug!("[MCP] Cancellation notification received");
                continue;
            }
            _ => {
                log::warn!("[MCP] Unknown method: {}", request.method);
                JsonRpcResponse::error(
                    request.id.clone(),
                    METHOD_NOT_FOUND,
                    format!("Method not found: {}", request.method),
                )
            }
        };

        write_response(&mut stdout, &response).await;
    }

    log::info!("[MCP] Stdio transport exiting (stdin closed)");
}

// ---------------------------------------------------------------------------
// MCP Method Handlers
// ---------------------------------------------------------------------------

/// Handle `initialize` — return server capabilities.
fn handle_initialize(req: &JsonRpcRequest) -> JsonRpcResponse {
    log::info!("[MCP] Initialize request received");

    let result = InitializeResult {
        protocol_version: MCP_VERSION.to_string(),
        capabilities: ServerCapabilities {
            tools: Some(ToolsCapability {
                list_changed: false,
            }),
        },
        server_info: ServerInfo {
            name: SERVER_NAME.to_string(),
            version: SERVER_VERSION.to_string(),
        },
    };

    JsonRpcResponse::success(
        req.id.clone(),
        serde_json::to_value(result).unwrap_or_default(),
    )
}

/// Handle `ping` — return empty result.
fn handle_ping(req: &JsonRpcRequest) -> JsonRpcResponse {
    JsonRpcResponse::success(req.id.clone(), serde_json::json!({}))
}

/// Handle `tools/list` — return all tool definitions.
fn handle_tools_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let tools = super::tools::tool_definitions();

    let result = ToolsListResult { tools };

    JsonRpcResponse::success(
        req.id.clone(),
        serde_json::to_value(result).unwrap_or_default(),
    )
}

/// Handle `tools/call` — execute a tool and return results.
fn handle_tools_call(req: &JsonRpcRequest) -> JsonRpcResponse {
    let params = match &req.params {
        Some(p) => p,
        None => {
            return JsonRpcResponse::error(
                req.id.clone(),
                INVALID_PARAMS,
                "Missing params for tools/call",
            );
        }
    };

    let tool_name = match params.get("name").and_then(|v| v.as_str()) {
        Some(n) => n,
        None => {
            return JsonRpcResponse::error(
                req.id.clone(),
                INVALID_PARAMS,
                "Missing 'name' in tools/call params",
            );
        }
    };

    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    log::info!("[MCP] tools/call: {}", tool_name);

    let result = super::tools::execute_tool(tool_name, &arguments);

    JsonRpcResponse::success(
        req.id.clone(),
        serde_json::to_value(result).unwrap_or_default(),
    )
}

// ---------------------------------------------------------------------------
// I/O Helpers
// ---------------------------------------------------------------------------

/// Write a JSON-RPC response as a single line to stdout.
async fn write_response(stdout: &mut io::Stdout, response: &JsonRpcResponse) {
    let json = match serde_json::to_string(response) {
        Ok(j) => j,
        Err(e) => {
            log::error!("[MCP] Failed to serialize response: {}", e);
            return;
        }
    };

    log::debug!("[MCP] >> {}", &json);

    let line = format!("{}\n", json);
    if let Err(e) = stdout.write_all(line.as_bytes()).await {
        log::error!("[MCP] Failed to write to stdout: {}", e);
    }
    if let Err(e) = stdout.flush().await {
        log::error!("[MCP] Failed to flush stdout: {}", e);
    }
}
