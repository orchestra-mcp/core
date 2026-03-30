// MCP Server — HTTP Transport (Streamable HTTP, 2025-11-25 spec)
//
// Runs an HTTP server on localhost:9998 that handles MCP JSON-RPC requests.
// This is the primary transport for the Desktop MCP server when running as a GUI app.
// Claude Code/Desktop connect via .mcp.json with "type": "http".

use std::sync::{Arc, Mutex};
use tiny_http::{Header, Method, Response, Server};

use super::types::*;
use super::{MCP_VERSION, SERVER_NAME, SERVER_VERSION};

pub const DEFAULT_PORT: u16 = 9998;

struct SessionState {
    initialized: bool,
    session_id: String,
}

/// Start the HTTP MCP server on the given port.
/// Blocks on the tokio task — call via tokio::spawn.
pub fn run_http_server_blocking(port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let server = match Server::http(&addr) {
        Ok(s) => {
            log::info!("[MCP] HTTP server listening on http://localhost:{}/mcp", port);
            s
        }
        Err(e) => {
            log::error!("[MCP] Failed to start HTTP server on {}: {}", addr, e);
            return;
        }
    };

    let state = Arc::new(Mutex::new(SessionState {
        initialized: false,
        session_id: uuid::Uuid::new_v4().to_string(),
    }));

    for mut request in server.incoming_requests() {
        let path = request.url().split('?').next().unwrap_or("/").to_string();
        let method = request.method().clone();

        // CORS preflight
        if method == Method::Options {
            let resp = Response::empty(200)
                .with_header(cors_header("Access-Control-Allow-Origin", "*"))
                .with_header(cors_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"))
                .with_header(cors_header("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id"));
            let _ = request.respond(resp);
            continue;
        }

        if path != "/mcp" {
            let resp = Response::from_string(r#"{"error":"not found"}"#)
                .with_status_code(404)
                .with_header(content_type_json());
            let _ = request.respond(resp);
            continue;
        }

        match method {
            Method::Post => {
                // Read body
                let mut body = String::new();
                if request.as_reader().read_to_string(&mut body).is_err() {
                    let resp = Response::from_string(r#"{"error":"bad request"}"#)
                        .with_status_code(400)
                        .with_header(content_type_json());
                    let _ = request.respond(resp);
                    continue;
                }

                // Parse JSON-RPC
                let rpc_req: JsonRpcRequest = match serde_json::from_str(&body) {
                    Ok(r) => r,
                    Err(e) => {
                        let err_resp = JsonRpcResponse::error(
                            None,
                            PARSE_ERROR,
                            format!("Parse error: {}", e),
                        );
                        let json = serde_json::to_string(&err_resp).unwrap_or_default();
                        let resp = Response::from_string(json)
                            .with_status_code(200)
                            .with_header(content_type_json())
                            .with_header(cors_header("Access-Control-Allow-Origin", "*"));
                        let _ = request.respond(resp);
                        continue;
                    }
                };

                // Handle method
                let mut st = state.lock().unwrap();
                let rpc_resp = match rpc_req.method.as_str() {
                    "initialize" => {
                        st.initialized = true;
                        handle_initialize(&rpc_req)
                    }
                    "initialized" => {
                        st.initialized = true;
                        // Notification — respond with empty 200
                        let resp = Response::empty(200)
                            .with_header(cors_header("Access-Control-Allow-Origin", "*"))
                            .with_header(cors_header("Mcp-Session-Id", &st.session_id));
                        let _ = request.respond(resp);
                        continue;
                    }
                    "ping" => handle_ping(&rpc_req),
                    "tools/list" => handle_tools_list(&rpc_req),
                    "tools/call" => {
                        if !st.initialized {
                            JsonRpcResponse::error(
                                rpc_req.id.clone(),
                                INVALID_REQUEST,
                                "Server not yet initialized",
                            )
                        } else {
                            handle_tools_call(&rpc_req)
                        }
                    }
                    "notifications/cancelled" => {
                        let resp = Response::empty(200)
                            .with_header(cors_header("Access-Control-Allow-Origin", "*"));
                        let _ = request.respond(resp);
                        continue;
                    }
                    _ => JsonRpcResponse::error(
                        rpc_req.id.clone(),
                        METHOD_NOT_FOUND,
                        format!("Method not found: {}", rpc_req.method),
                    ),
                };

                let json = serde_json::to_string(&rpc_resp).unwrap_or_default();
                let resp = Response::from_string(json)
                    .with_status_code(200)
                    .with_header(content_type_json())
                    .with_header(cors_header("Access-Control-Allow-Origin", "*"))
                    .with_header(cors_header("Mcp-Session-Id", &st.session_id));
                let _ = request.respond(resp);
            }
            _ => {
                let resp = Response::from_string(r#"{"error":"method not allowed"}"#)
                    .with_status_code(405)
                    .with_header(content_type_json());
                let _ = request.respond(resp);
            }
        }
    }
}

// --- Handlers (reuse same logic as stdio) ---

fn handle_initialize(req: &JsonRpcRequest) -> JsonRpcResponse {
    let result = InitializeResult {
        protocol_version: MCP_VERSION.to_string(),
        capabilities: ServerCapabilities {
            tools: Some(ToolsCapability { list_changed: false }),
        },
        server_info: ServerInfo {
            name: SERVER_NAME.to_string(),
            version: SERVER_VERSION.to_string(),
        },
    };
    JsonRpcResponse::success(req.id.clone(), serde_json::to_value(result).unwrap_or_default())
}

fn handle_ping(req: &JsonRpcRequest) -> JsonRpcResponse {
    JsonRpcResponse::success(req.id.clone(), serde_json::json!({}))
}

fn handle_tools_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let tools = super::tools::tool_definitions();
    let result = ToolsListResult { tools };
    JsonRpcResponse::success(req.id.clone(), serde_json::to_value(result).unwrap_or_default())
}

fn handle_tools_call(req: &JsonRpcRequest) -> JsonRpcResponse {
    let params = match &req.params {
        Some(p) => p,
        None => {
            return JsonRpcResponse::error(req.id.clone(), INVALID_PARAMS, "Missing params");
        }
    };

    let tool_name = match params.get("name").and_then(|v| v.as_str()) {
        Some(n) => n,
        None => {
            return JsonRpcResponse::error(req.id.clone(), INVALID_PARAMS, "Missing tool name");
        }
    };

    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let result = super::tools::execute_tool(tool_name, &arguments);
    JsonRpcResponse::success(req.id.clone(), serde_json::to_value(result).unwrap_or_default())
}

// --- Helpers ---

fn content_type_json() -> Header {
    Header::from_bytes("Content-Type", "application/json").unwrap()
}

fn cors_header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).unwrap()
}
