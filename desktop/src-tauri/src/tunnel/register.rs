// Orchestra Desktop — Tunnel Auto-Register
//
// HTTP POST to /api/tunnels/auto-register to obtain tunnel_id + connection_token.

use crate::tunnel::types::{AutoRegisterRequest, AutoRegisterResponse};

/// Register this desktop instance with the gateway and receive tunnel credentials.
///
/// # Arguments
/// * `gateway_api_url` - Base API URL (e.g. "https://gateway.orchestra-mcp.dev")
/// * `auth_token` - Bearer token for authentication
/// * `hostname` - This machine's hostname
/// * `os` - Operating system identifier (e.g. "macos", "windows", "linux")
/// * `workspace` - Optional workspace/project name
pub async fn auto_register(
    gateway_api_url: &str,
    auth_token: &str,
    hostname: &str,
    os: &str,
    workspace: Option<&str>,
) -> Result<AutoRegisterResponse, String> {
    let url = format!(
        "{}/api/tunnels/auto-register",
        gateway_api_url.trim_end_matches('/')
    );

    let body = AutoRegisterRequest {
        hostname: hostname.to_string(),
        os: os.to_string(),
        workspace: workspace.map(|s| s.to_string()),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("auto-register request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body_text = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!(
            "auto-register failed (HTTP {}): {}",
            status, body_text
        ));
    }

    let result: AutoRegisterResponse = response
        .json()
        .await
        .map_err(|e| format!("auto-register: invalid response JSON: {}", e))?;

    log::info!(
        "[tunnel] auto-registered: tunnel_id={}, hostname={}, os={}",
        result.tunnel_id,
        hostname,
        os
    );

    Ok(result)
}
