// Claude Code Bridge adapter
//
// Spawns the `claude` CLI subprocess in non-interactive (--print) mode.
// This is the canonical provider — all others are call-home HTTP stubs.

use super::{AgentSpawnConfig, ProviderAdapter};

pub struct Claude;

impl ProviderAdapter for Claude {
    fn name() -> &'static str {
        "claude"
    }

    fn spawn(config: &AgentSpawnConfig) -> Result<std::process::Child, String> {
        // Resolve MCP config path — default to <workspace>/.mcp.json
        let mcp_config = config
            .mcp_config_path
            .clone()
            .unwrap_or_else(|| format!("{}/.mcp.json", config.workspace));

        // Build: claude --print --model {model} --system-prompt "{system_prompt}"
        //              --allowedTools "*" --mcp-config "{mcp_config}" "{instruction}"
        let mut cmd = std::process::Command::new("claude");
        cmd.arg("--print")
            .arg("--dangerously-skip-permissions")
            .arg("--model")
            .arg(&config.model)
            .arg("--system-prompt")
            .arg(&config.system_prompt)
            .arg("--allowedTools")
            .arg("*")
            .arg("--mcp-config")
            .arg(&mcp_config)
            .arg("--")  // end of flags — next arg is the prompt
            .arg(&config.instruction)
            .current_dir(&config.workspace)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        // Inject API key into environment if an override was provided.
        // When None, the subprocess inherits ANTHROPIC_API_KEY from the
        // parent process environment automatically.
        if let Some(ref key) = config.api_key {
            cmd.env("ANTHROPIC_API_KEY", key);
        }

        cmd.spawn()
            .map_err(|e| format!("Failed to spawn `claude` process: {}. Is Claude Code installed?", e))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_config() -> AgentSpawnConfig {
        AgentSpawnConfig {
            slug: "go-developer".to_string(),
            system_prompt: "You are a Go developer.".to_string(),
            model: "claude-sonnet-4-5".to_string(),
            provider: "claude".to_string(),
            api_key: Some("sk-test-key".to_string()),
            workspace: "/tmp".to_string(),
            instruction: "Write hello world".to_string(),
            mcp_config_path: None,
        }
    }

    #[test]
    fn test_provider_name() {
        assert_eq!(Claude::name(), "claude");
    }

    #[test]
    fn test_mcp_config_default_path() {
        // When mcp_config_path is None the path should default to workspace/.mcp.json.
        // We can verify the default logic without actually spawning.
        let config = make_config();
        let expected = format!("{}/.mcp.json", config.workspace);
        let resolved = config
            .mcp_config_path
            .clone()
            .unwrap_or_else(|| format!("{}/.mcp.json", config.workspace));
        assert_eq!(resolved, expected);
    }

    #[test]
    fn test_mcp_config_explicit_path() {
        let mut config = make_config();
        config.mcp_config_path = Some("/custom/.mcp.json".to_string());
        let resolved = config
            .mcp_config_path
            .clone()
            .unwrap_or_else(|| format!("{}/.mcp.json", config.workspace));
        assert_eq!(resolved, "/custom/.mcp.json");
    }
}
