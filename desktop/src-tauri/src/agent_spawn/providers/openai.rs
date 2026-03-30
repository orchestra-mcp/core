// OpenAI adapter — stub
//
// Calls the OpenAI Chat Completions API (or any OpenAI-compatible endpoint)
// via curl.  The same adapter is reused for DeepSeek and Qwen by passing a
// different base URL via spawn_with_base().
//
// Model aliases (when base_url == OpenAI):
//   "sonnet"  → gpt-4o
//   "opus"    → o1
//   "haiku"   → gpt-4o-mini
//   anything else → used verbatim

use super::{AgentSpawnConfig, ProviderAdapter};

pub struct OpenAI;

impl OpenAI {
    /// Map a logical alias to an OpenAI model ID.
    fn resolve_model(model: &str) -> &str {
        match model {
            "sonnet" => "gpt-4o",
            "opus" => "o1",
            "haiku" => "gpt-4o-mini",
            other => other,
        }
    }

    /// Build the JSON request body for the chat completions endpoint.
    fn build_request_body(system_prompt: &str, instruction: &str, model: &str) -> String {
        let sys_escaped = system_prompt.replace('\\', "\\\\").replace('"', "\\\"");
        let instr_escaped = instruction.replace('\\', "\\\\").replace('"', "\\\"");
        format!(
            r#"{{"model":"{}","messages":[{{"role":"system","content":"{}"}},{{"role":"user","content":"{}"}}]}}"#,
            model, sys_escaped, instr_escaped
        )
    }

    /// Spawn using a custom base URL — used for DeepSeek, Qwen, and any other
    /// OpenAI-compatible provider.
    pub fn spawn_with_base(
        config: &AgentSpawnConfig,
        base_url: &str,
    ) -> Result<std::process::Child, String> {
        let api_key = config
            .api_key
            .clone()
            .or_else(|| {
                // Try provider-specific env vars based on the base URL
                if base_url.contains("deepseek") {
                    std::env::var("DEEPSEEK_API_KEY").ok()
                } else if base_url.contains("dashscope") || base_url.contains("qwen") {
                    std::env::var("DASHSCOPE_API_KEY")
                        .ok()
                        .or_else(|| std::env::var("QWEN_API_KEY").ok())
                } else {
                    std::env::var("OPENAI_API_KEY").ok()
                }
            })
            .ok_or_else(|| {
                format!(
                    "OpenAI-compatible provider at {} requires an API key. \
                     Set OPENAI_API_KEY (or DEEPSEEK_API_KEY / DASHSCOPE_API_KEY) \
                     or pass api_key in the tool call.",
                    base_url
                )
            })?;

        let model = Self::resolve_model(&config.model);
        let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
        let body = Self::build_request_body(&config.system_prompt, &config.instruction, model);

        std::process::Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                &url,
                "-H", "Content-Type: application/json",
                "-H", &format!("Authorization: Bearer {}", api_key),
                "-d", &body,
            ])
            .current_dir(&config.workspace)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn curl for OpenAI-compatible API at {}: {}", base_url, e))
    }
}

impl ProviderAdapter for OpenAI {
    fn name() -> &'static str {
        "openai"
    }

    fn spawn(config: &AgentSpawnConfig) -> Result<std::process::Child, String> {
        Self::spawn_with_base(config, "https://api.openai.com")
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
        assert_eq!(OpenAI::name(), "openai");
    }

    #[test]
    fn test_model_aliases() {
        assert_eq!(OpenAI::resolve_model("sonnet"), "gpt-4o");
        assert_eq!(OpenAI::resolve_model("opus"), "o1");
        assert_eq!(OpenAI::resolve_model("haiku"), "gpt-4o-mini");
        assert_eq!(OpenAI::resolve_model("gpt-4-turbo"), "gpt-4-turbo");
    }

    #[test]
    fn test_build_request_body_structure() {
        let body = OpenAI::build_request_body("be helpful", "write code", "gpt-4o");
        assert!(body.contains("gpt-4o"));
        assert!(body.contains("system"));
        assert!(body.contains("be helpful"));
        assert!(body.contains("user"));
        assert!(body.contains("write code"));
        assert!(body.contains("messages"));
    }

    #[test]
    fn test_build_request_body_escapes_quotes() {
        let body = OpenAI::build_request_body(r#"say "hello""#, "task", "gpt-4o");
        // JSON must not contain bare unescaped quotes inside string values
        assert!(body.contains(r#"say \"hello\""#));
    }
}
