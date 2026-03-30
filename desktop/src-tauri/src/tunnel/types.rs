// Orchestra Desktop — Tunnel Types
//
// Data structures for the cloud-desktop reverse WebSocket tunnel.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// RelayEnvelope wraps JSON-RPC messages with a browser session ID,
/// matching the gateway's tunnel.RelayEnvelope format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayEnvelope {
    /// The browser session ID to relay the message to/from.
    pub relay_to: String,

    /// Optional message type hint (e.g. "jsonrpc-request", "jsonrpc-response").
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub message_type: Option<String>,

    /// The JSON-RPC message payload.
    pub message: serde_json::Value,
}

/// TunnelConfig holds the connection parameters for the WebSocket tunnel client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelConfig {
    /// WebSocket URL of the gateway reverse tunnel endpoint.
    /// Example: "wss://gateway.orchestra-mcp.dev/api/tunnels/reverse"
    pub gateway_url: String,

    /// The registered tunnel identifier from the gateway.
    pub tunnel_id: String,

    /// Authentication token for the tunnel connection.
    pub connection_token: String,

    /// Enable automatic reconnection with exponential backoff.
    #[serde(default = "default_true")]
    pub auto_reconnect: bool,
}

fn default_true() -> bool {
    true
}

/// ReconnectConfig controls the auto-reconnect behavior with
/// exponential backoff and jitter.
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    /// Delay before the first reconnection attempt.
    pub initial_delay: Duration,

    /// Maximum delay between reconnection attempts.
    pub max_delay: Duration,

    /// Backoff multiplier applied after each failed attempt.
    pub multiplier: f64,

    /// Randomness factor added to delays (0.0 - 1.0) to prevent thundering herd.
    pub jitter: f64,

    /// Maximum consecutive reconnection attempts before giving up.
    /// Zero means unlimited.
    pub max_attempts: u32,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            multiplier: 2.0,
            jitter: 0.3,
            max_attempts: 0, // unlimited
        }
    }
}

/// AutoRegisterRequest is the payload sent to the gateway's
/// auto-register endpoint.
#[derive(Debug, Clone, Serialize)]
pub struct AutoRegisterRequest {
    pub hostname: String,
    pub os: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace: Option<String>,
}

/// AutoRegisterResponse is the response from the gateway's
/// auto-register endpoint containing the tunnel credentials.
#[derive(Debug, Clone, Deserialize)]
pub struct AutoRegisterResponse {
    pub tunnel_id: String,
    pub connection_token: String,
}

/// ConnectionStats holds connection metrics exposed via the status command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_ping_at: Option<String>,
    pub messages_in: u64,
    pub messages_out: u64,
    pub reconnect_attempts: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tunnel_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway_url: Option<String>,
}
