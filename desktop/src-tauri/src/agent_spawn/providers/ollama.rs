// Ollama adapter — local LLM inference
//
// Calls the local Ollama HTTP API (http://localhost:11434).
// No API key is required — Ollama runs entirely on the user's machine.
//
// Model aliases:
//   "sonnet"  → llama3.1:70b
//   "opus"    → llama3.1:70b   (use the largest available local model)
//   "haiku"   → llama3.1:8b
//   anything else → used verbatim (e.g. "mistral", "codellama:13b")

use super::{AgentSpawnConfig, ProviderAdapter};

pub struct Ollama;

impl Ollama {
    /// Map logical aliases to local Ollama model tags.
    fn resolve_model(model: &str) -> &str {
        match model {
            "sonnet" | "opus" => "llama3.1:70b",
            "haiku" => "llama3.1:8b",
            other => other,
        }
    }

    /// Build the JSON body for the Ollama /api/generate endpoint.
    fn build_request_body(system_prompt: &str, instruction: &str, model: &str) -> String {
        let full_prompt = format!(
            "System: {}\n\nUser: {}\n\nAssistant:",
            system_prompt, instruction
        );
        let escaped = full_prompt.replace('\\', "\\\\").replace('"', "\\\"");
        // stream:false → wait for the full response before returning
        format!(
            r#"{{"model":"{}","prompt":"{}","stream":false}}"#,
            model, escaped
        )
    }

    /// Allow overriding the Ollama host (e.g. for remote Ollama instances).
    fn ollama_host(_config: &AgentSpawnConfig) -> String {
        // Honour OLLAMA_HOST env var if set, otherwise default to localhost
        std::env::var("OLLAMA_HOST")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "http://localhost:11434".to_string())
    }
}

impl ProviderAdapter for Ollama {
    fn name() -> &'static str {
        "ollama"
    }

    fn spawn(config: &AgentSpawnConfig) -> Result<std::process::Child, String> {
        let model = Self::resolve_model(&config.model);
        let host = Self::ollama_host(config);
        let url = format!("{}/api/generate", host.trim_end_matches('/'));
        let body = Self::build_request_body(&config.system_prompt, &config.instruction, model);

        std::process::Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                &url,
                "-H", "Content-Type: application/json",
                "-d", &body,
            ])
            .current_dir(&config.workspace)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to spawn curl for Ollama at {}: {}. Is Ollama running?",
                    host, e
                )
            })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_name() {
        assert_eq!(Ollama::name(), "ollama");
    }

    #[test]
    fn test_model_aliases() {
        assert_eq!(Ollama::resolve_model("sonnet"), "llama3.1:70b");
        assert_eq!(Ollama::resolve_model("opus"), "llama3.1:70b");
        assert_eq!(Ollama::resolve_model("haiku"), "llama3.1:8b");
        // Explicit model tags pass through unchanged
        assert_eq!(Ollama::resolve_model("mistral"), "mistral");
        assert_eq!(Ollama::resolve_model("codellama:13b"), "codellama:13b");
    }

    #[test]
    fn test_build_request_body_stream_false() {
        let body = Ollama::build_request_body("sys", "task", "llama3.1:70b");
        assert!(body.contains("llama3.1:70b"));
        assert!(body.contains("stream"));
        assert!(body.contains("false"));
        assert!(body.contains("prompt"));
    }

    #[test]
    fn test_build_request_body_contains_prompts() {
        let body = Ollama::build_request_body("be helpful", "write code", "llama3.1:8b");
        assert!(body.contains("be helpful"));
        assert!(body.contains("write code"));
    }
}
