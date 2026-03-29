// Bridge: MCP Host
//
// Responsibilities:
// - Host an MCP server locally for Claude clients to connect
// - Expose desktop-native tools (screen capture, input sim, file access)
// - JSON-RPC 2.0 message handling
// - Tool registration and execution
// - stdio and SSE transport support

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<McpError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Get the list of tools this MCP host provides
pub fn list_tools() -> Vec<McpTool> {
    vec![
        McpTool {
            name: "screenshot".to_string(),
            description: "Capture a screenshot of the screen or a region".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "region": {
                        "type": "object",
                        "properties": {
                            "x": { "type": "integer" },
                            "y": { "type": "integer" },
                            "width": { "type": "integer" },
                            "height": { "type": "integer" }
                        }
                    }
                }
            }),
        },
        McpTool {
            name: "click".to_string(),
            description: "Click at a screen coordinate".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "x": { "type": "integer" },
                    "y": { "type": "integer" },
                    "button": { "type": "string", "enum": ["left", "right", "middle"] }
                },
                "required": ["x", "y"]
            }),
        },
        McpTool {
            name: "type_text".to_string(),
            description: "Type text using keyboard simulation".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string" }
                },
                "required": ["text"]
            }),
        },
    ]
}

/// Handle an incoming MCP JSON-RPC request
pub fn handle_request(_request: &McpRequest) -> McpResponse {
    // TODO: Route to appropriate tool handler
    McpResponse {
        jsonrpc: "2.0".to_string(),
        id: _request.id.clone(),
        result: None,
        error: Some(McpError {
            code: -32601,
            message: "Method not yet implemented".to_string(),
            data: None,
        }),
    }
}
