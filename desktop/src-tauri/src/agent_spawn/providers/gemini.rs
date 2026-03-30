// Gemini adapter — stub
//
// Calls Google's Generative Language API via curl.
// The response is written to stdout of the spawned process so that the
// existing wait_with_output() machinery in agent_spawn/mod.rs captures it
// without any changes.
//
// Model aliases:
//   "sonnet"  → gemini-1.5-pro
//   "opus"    → gemini-2.0-flash-thinking-exp
//   "haiku"   → gemini-1.5-flash
//   anything else → used verbatim

use super::{AgentSpawnConfig, ProviderAdapter};

pub struct Gemini;

impl Gemini {
    /// Map a logical model alias to a concrete Gemini model ID.
    fn resolve_model(model: &str) -> &str {
        match model {
            "sonnet" => "gemini-1.5-pro",
            "opus" => "gemini-2.0-flash-thinking-exp",
            "haiku" => "gemini-1.5-flash",
            other => other,
        }
    }

    /// Build the JSON request body for the Gemini generateContent API.
    fn build_request_body(system_prompt: &str, instruction: &str) -> String {
        // Escape double-quotes and backslashes for embedding in a shell argument.
        let full_prompt = format!(
            "{}\n\n{}\n\nYou have access to MCP tools. \
             To use them, output JSON tool calls in the format: \
             {{\"tool\": \"<name>\", \"arguments\": {{...}}}}",
            system_prompt, instruction
        );
        let escaped = full_prompt.replace('\\', "\\\\").replace('"', "\\\"");
        format!(
            r#"{{"contents":[{{"parts":[{{"text":"{}"}}]}}]}}"#,
            escaped
        )
    }
}

impl ProviderAdapter for Gemini {
    fn name() -> &'static str {
        "gemini"
    }

    fn spawn(config: &AgentSpawnConfig) -> Result<std::process::Child, String> {
        let api_key = config
            .api_key
            .clone()
            .or_else(|| std::env::var("GEMINI_API_KEY").ok())
            .or_else(|| std::env::var("GOOGLE_API_KEY").ok())
            .ok_or_else(|| {
                "Gemini provider requires GEMINI_API_KEY or GOOGLE_API_KEY environment variable, \
                 or pass api_key in the tool call."
                    .to_string()
            })?;

        let model = Self::resolve_model(&config.model);
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, api_key
        );
        let body = Self::build_request_body(&config.system_prompt, &config.instruction);

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
            .map_err(|e| format!("Failed to spawn curl for Gemini API: {}", e))
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
        assert_eq!(Gemini::name(), "gemini");
    }

    #[test]
    fn test_model_aliases() {
        assert_eq!(Gemini::resolve_model("sonnet"), "gemini-1.5-pro");
        assert_eq!(Gemini::resolve_model("opus"), "gemini-2.0-flash-thinking-exp");
        assert_eq!(Gemini::resolve_model("haiku"), "gemini-1.5-flash");
        // Passthrough for unknown/explicit model IDs
        assert_eq!(Gemini::resolve_model("gemini-pro"), "gemini-pro");
    }

    #[test]
    fn test_build_request_body_contains_prompt() {
        let body = Gemini::build_request_body("sys", "do task");
        assert!(body.contains("sys"));
        assert!(body.contains("do task"));
        assert!(body.contains("contents"));
        assert!(body.contains("parts"));
    }
}
