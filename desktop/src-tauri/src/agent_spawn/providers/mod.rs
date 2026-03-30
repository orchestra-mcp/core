// Provider router — multi-provider agent spawning
//
// Each provider adapter implements the ProviderAdapter trait.
// New providers can be added by:
//   1. Creating a module file (e.g. providers/newprovider.rs)
//   2. Adding the module declaration below
//   3. Implementing ProviderAdapter for the new struct
//   4. Adding a match arm in exec_agent_spawn

pub mod apple;
pub mod claude;
pub mod gemini;
pub mod grok;
pub mod ollama;
pub mod openai;

// ---------------------------------------------------------------------------
// Shared config and output types
// ---------------------------------------------------------------------------

/// Full configuration passed to a provider adapter at spawn time.
pub struct AgentSpawnConfig {
    /// Agent slug (e.g. "go-developer") — informational only for most providers
    pub slug: String,
    /// System prompt loaded from the agent catalogue
    pub system_prompt: String,
    /// Model name (may be a logical alias like "sonnet" or a concrete ID)
    pub model: String,
    /// Provider name string ("claude", "gemini", "openai", "deepseek", "qwen", "ollama")
    pub provider: String,
    /// Optional API key override — if None, adapters fall back to env vars
    pub api_key: Option<String>,
    /// Absolute path to the workspace directory
    pub workspace: String,
    /// The instruction / task text the agent should execute
    pub instruction: String,
    /// Path to the MCP config JSON file (e.g. <workspace>/.mcp.json)
    pub mcp_config_path: Option<String>,
}

/// Supported providers enum — used internally for exhaustive matching.
#[allow(dead_code)]
pub enum Provider {
    Claude,
    Gemini,
    OpenAI,
    DeepSeek,
    Qwen,
    Ollama,
    Apple,
    Grok,
}

// ---------------------------------------------------------------------------
// Provider adapter trait
// ---------------------------------------------------------------------------

/// Every provider adapter must implement this trait.
pub trait ProviderAdapter {
    /// Human-readable provider name for error messages.
    fn name() -> &'static str;

    /// Spawn a subprocess (or virtual process) for the given config.
    /// Returns the spawned Child on success, or an error string.
    fn spawn(config: &AgentSpawnConfig) -> Result<std::process::Child, String>;
}
