// Provider: Grok (xAI)
//
// Uses xAI's OpenAI-compatible API at api.x.ai
// Models: grok-3, grok-3-mini, grok-2

use super::{AgentSpawnConfig, ProviderAdapter};
use std::process::{Command, Child, Stdio};

pub struct Grok;

impl ProviderAdapter for Grok {
    fn spawn(config: &AgentSpawnConfig) -> Result<Child, String> {
        let api_key = config.api_key.clone()
            .or_else(|| std::env::var("XAI_API_KEY").ok())
            .or_else(|| std::env::var("GROK_API_KEY").ok())
            .ok_or("No xAI API key found. Set XAI_API_KEY or GROK_API_KEY env var, or pass api_key parameter.")?;

        let model = match config.model.as_str() {
            "opus" | "large" => "grok-3",
            "sonnet" | "medium" => "grok-3-mini",
            "haiku" | "small" | "fast" => "grok-2",
            other => other,
        };

        let body = serde_json::json!({
            "model": model,
            "messages": [
                {"role": "system", "content": config.system_prompt},
                {"role": "user", "content": config.instruction}
            ],
            "temperature": 0.7,
            "max_tokens": 8192
        });

        let child = Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                "https://api.x.ai/v1/chat/completions",
                "-H", &format!("Authorization: Bearer {}", api_key),
                "-H", "Content-Type: application/json",
                "-d", &body.to_string(),
            ])
            .current_dir(&config.workspace)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Grok: {}", e))?;

        Ok(child)
    }

    fn name() -> &'static str {
        "grok"
    }
}
