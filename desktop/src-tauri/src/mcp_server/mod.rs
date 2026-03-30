// MCP Server — Local Desktop MCP Server (2025-11-25 spec)
//
// Implements the Model Context Protocol directly inside the Tauri app,
// exposing desktop vision, input, window management, and workspace tools
// to any MCP client (Claude Desktop, Claude Code, Claude Mobile/Web).
//
// Transport: stdio (line-delimited JSON-RPC 2.0)
// Spec version: 2025-11-25

pub mod http;
pub mod server;
pub mod stdio;
mod helpers;
pub(crate) mod tools;
mod types;

pub use server::start_mcp_server;
pub use types::*;

/// MCP protocol version this server implements.
pub const MCP_VERSION: &str = "2025-11-25";

/// Server identity.
pub const SERVER_NAME: &str = "orchestra-desktop";
pub const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");
