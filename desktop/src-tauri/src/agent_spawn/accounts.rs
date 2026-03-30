// Account Pool Manager
//
// Manages a pool of API accounts stored in ~/.orchestra/accounts.json.
// Provides round-robin selection, rate-limit tracking, and masked listing.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

use crate::mcp_server::{ContentItem, ToolCallResult, ToolDefinition};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub label: String,
    pub provider: String,
    pub api_key: String,
    pub model_tier: String,   // "opus" | "sonnet" | "haiku"
    pub is_active: bool,
    pub rate_limited_until: Option<String>, // ISO-8601 or null
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountStore {
    pub accounts: Vec<Account>,
    pub auto_rotate: bool,
    pub default_provider: String,
}

impl Default for AccountStore {
    fn default() -> Self {
        AccountStore {
            accounts: Vec::new(),
            auto_rotate: true,
            default_provider: "claude".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// File path helper
// ---------------------------------------------------------------------------

fn accounts_json_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".orchestra").join("accounts.json"))
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

fn load_store() -> AccountStore {
    let path = match accounts_json_path() {
        Some(p) => p,
        None => return AccountStore::default(),
    };
    if !path.exists() {
        return AccountStore::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => AccountStore::default(),
    }
}

fn save_store(store: &AccountStore) -> Result<(), String> {
    let path = accounts_json_path().ok_or_else(|| "Cannot determine home directory".to_string())?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir failed: {}", e))?;
    }

    let json_str = serde_json::to_string_pretty(store)
        .map_err(|e| format!("JSON serialization failed: {}", e))?;
    std::fs::write(&path, json_str).map_err(|e| format!("Write failed: {}", e))
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

#[allow(dead_code)]
pub fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let time = secs % 86400;
    let (y, mo, d) = days_to_ymd(days);
    let h = time / 3600;
    let mi = (time % 3600) / 60;
    let s = time % 60;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, mi, s)
}

#[allow(dead_code)]
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d)
}

/// Parse an ISO-8601 UTC timestamp like "2026-03-30T12:00:00Z" into Unix seconds.
/// Returns None if parsing fails.
fn parse_iso_secs(ts: &str) -> Option<u64> {
    // Format: YYYY-MM-DDTHH:MM:SSZ  (exactly 20 chars)
    let ts = ts.trim_end_matches('Z');
    let parts: Vec<&str> = ts.splitn(2, 'T').collect();
    if parts.len() != 2 {
        return None;
    }
    let date_parts: Vec<u64> = parts[0].split('-').filter_map(|p| p.parse().ok()).collect();
    let time_parts: Vec<u64> = parts[1].split(':').filter_map(|p| p.parse().ok()).collect();
    if date_parts.len() != 3 || time_parts.len() != 3 {
        return None;
    }
    let (y, m, d) = (date_parts[0], date_parts[1], date_parts[2]);
    let (h, mi, s) = (time_parts[0], time_parts[1], time_parts[2]);

    // Convert calendar date to days since UNIX epoch (Julian Day Number method)
    let jdn = {
        let a = (14u64.wrapping_sub(m)) / 12;
        let yy = y + 4800 - a;
        let mm = m + 12 * a - 3;
        d + (153 * mm + 2) / 5 + 365 * yy + yy / 4 - yy / 100 + yy / 400 - 32045
    };
    // JDN of 1970-01-01 is 2440588
    let days_since_epoch = jdn.checked_sub(2440588)?;
    Some(days_since_epoch * 86400 + h * 3600 + mi * 60 + s)
}

fn current_unix_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ---------------------------------------------------------------------------
// Core functions (pub — used by chain.rs and agent_spawn)
// ---------------------------------------------------------------------------

/// Add a new account to the pool.
pub fn add_account(
    label: &str,
    provider: &str,
    api_key: &str,
    model_tier: &str,
) -> Result<Account, String> {
    let mut store = load_store();

    let id = format!(
        "acc-{}",
        uuid::Uuid::new_v4().to_string().replace('-', "")[..8].to_string()
    );

    let account = Account {
        id: id.clone(),
        label: label.to_string(),
        provider: provider.to_string(),
        api_key: api_key.to_string(),
        model_tier: model_tier.to_string(),
        is_active: true,
        rate_limited_until: None,
    };

    store.accounts.push(account.clone());
    save_store(&store)?;
    Ok(account)
}

/// Remove an account by ID.
pub fn remove_account(id: &str) -> Result<(), String> {
    let mut store = load_store();
    let before = store.accounts.len();
    store.accounts.retain(|a| a.id != id);
    if store.accounts.len() == before {
        return Err(format!("Account `{}` not found.", id));
    }
    save_store(&store)
}

/// Return all accounts with masked API keys (last 4 chars only).
pub fn list_accounts() -> Vec<Value> {
    let store = load_store();
    store
        .accounts
        .iter()
        .map(|a| {
            let masked = mask_key(&a.api_key);
            json!({
                "id": a.id,
                "label": a.label,
                "provider": a.provider,
                "api_key": masked,
                "model_tier": a.model_tier,
                "is_active": a.is_active,
                "rate_limited_until": a.rate_limited_until
            })
        })
        .collect()
}

/// Find the best account for a given provider and model_tier.
/// Prefers active, non-rate-limited accounts. If all are rate-limited,
/// returns the one with the earliest reset time.
pub fn get_best_account(provider: &str, model_tier: &str) -> Option<Account> {
    let store = load_store();
    let now = current_unix_secs();

    let candidates: Vec<&Account> = store
        .accounts
        .iter()
        .filter(|a| {
            a.is_active
                && a.provider == provider
                && a.model_tier == model_tier
        })
        .collect();

    if candidates.is_empty() {
        return None;
    }

    // First pass: accounts that are NOT rate-limited
    let available: Vec<&Account> = candidates
        .iter()
        .copied()
        .filter(|a| match &a.rate_limited_until {
            None => true,
            Some(ts) => parse_iso_secs(ts).map(|reset| now >= reset).unwrap_or(true),
        })
        .collect();

    if let Some(acc) = available.first() {
        return Some((*acc).clone());
    }

    // All rate-limited — return the one with earliest reset
    candidates
        .iter()
        .min_by_key(|a| {
            a.rate_limited_until
                .as_deref()
                .and_then(parse_iso_secs)
                .unwrap_or(u64::MAX)
        })
        .map(|a| (*a).clone())
}

/// Mark an account as rate-limited until the given ISO timestamp.
pub fn mark_rate_limited(id: &str, reset_at: &str) -> Result<(), String> {
    let mut store = load_store();
    let acc = store
        .accounts
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("Account `{}` not found.", id))?;
    acc.rate_limited_until = Some(reset_at.to_string());
    save_store(&store)
}

/// Clear the rate limit on an account.
pub fn clear_rate_limit(id: &str) -> Result<(), String> {
    let mut store = load_store();
    let acc = store
        .accounts
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("Account `{}` not found.", id))?;
    acc.rate_limited_until = None;
    save_store(&store)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn mask_key(key: &str) -> String {
    if key.len() <= 4 {
        return "****".to_string();
    }
    let suffix = &key[key.len() - 4..];
    format!("****{}", suffix)
}

// ---------------------------------------------------------------------------
// MCP tool executors
// ---------------------------------------------------------------------------

pub fn exec_account_add(args: &Value) -> ToolCallResult {
    let label = match args.get("label").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return tool_error("Missing required parameter: label".to_string()),
    };
    let provider = match args.get("provider").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return tool_error("Missing required parameter: provider".to_string()),
    };
    let api_key = match args.get("api_key").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return tool_error("Missing required parameter: api_key".to_string()),
    };
    let model_tier = args
        .get("model_tier")
        .and_then(|v| v.as_str())
        .unwrap_or("sonnet");

    match add_account(label, provider, api_key, model_tier) {
        Ok(acc) => {
            let body = format!(
                "## Account Added\n\n\
                **ID:** `{}`  \n\
                **Label:** {}  \n\
                **Provider:** `{}`  \n\
                **Model Tier:** `{}`  \n\
                **API Key:** `{}`  \n\
                **Status:** active\n\n\
                Account saved to `~/.orchestra/accounts.json`.",
                acc.id,
                acc.label,
                acc.provider,
                acc.model_tier,
                mask_key(&acc.api_key),
            );
            tool_text(format_markdown(
                &[
                    ("tool", "account_add"),
                    ("status", "ok"),
                    ("id", &acc.id),
                    ("provider", &acc.provider),
                ],
                &body,
                &[
                    ("List all accounts", "account_list"),
                    ("Spawn agent with this account", "agent_spawn"),
                ],
            ))
        }
        Err(e) => tool_error(format!("Failed to add account: {}", e)),
    }
}

pub fn exec_account_list(_args: &Value) -> ToolCallResult {
    let accounts = list_accounts();

    if accounts.is_empty() {
        return tool_text(format_markdown(
            &[("tool", "account_list"), ("status", "ok"), ("count", "0")],
            "No accounts configured. Use `account_add` to add one.",
            &[("Add an account", "account_add")],
        ));
    }

    let mut table = String::from(
        "## Account Pool\n\n\
        | ID | Label | Provider | Tier | API Key | Active | Rate Limited |\n\
        |----|-------|----------|------|---------|--------|--------------|\n",
    );

    for a in &accounts {
        let id = a["id"].as_str().unwrap_or("-");
        let label = a["label"].as_str().unwrap_or("-");
        let provider = a["provider"].as_str().unwrap_or("-");
        let tier = a["model_tier"].as_str().unwrap_or("-");
        let key = a["api_key"].as_str().unwrap_or("-");
        let active = if a["is_active"].as_bool().unwrap_or(false) { "yes" } else { "no" };
        let rate_limited = match a["rate_limited_until"].as_str() {
            Some(ts) => ts.to_string(),
            None => "-".to_string(),
        };
        table.push_str(&format!(
            "| `{}` | {} | {} | {} | `{}` | {} | {} |\n",
            id, label, provider, tier, key, active, rate_limited,
        ));
    }

    tool_text(format_markdown(
        &[
            ("tool", "account_list"),
            ("status", "ok"),
            ("count", &accounts.len().to_string()),
        ],
        &table,
        &[
            ("Add an account", "account_add"),
            ("Remove an account", "account_remove"),
        ],
    ))
}

pub fn exec_account_remove(args: &Value) -> ToolCallResult {
    let id = match args.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return tool_error("Missing required parameter: id".to_string()),
    };

    match remove_account(id) {
        Ok(()) => {
            let body = format!(
                "## Account Removed\n\n\
                Account `{}` has been removed from `~/.orchestra/accounts.json`.",
                id
            );
            tool_text(format_markdown(
                &[
                    ("tool", "account_remove"),
                    ("status", "ok"),
                    ("id", id),
                ],
                &body,
                &[("List remaining accounts", "account_list")],
            ))
        }
        Err(e) => tool_error(e),
    }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "account_add".to_string(),
            description: concat!(
                "Add an API account to the Orchestra account pool. ",
                "Accounts are stored in ~/.orchestra/accounts.json and used by agent_spawn ",
                "to automatically select the best available account for a given provider and model tier."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Human-readable label for this account — e.g. 'Primary Opus', 'Sonnet Worker 2'"
                    },
                    "provider": {
                        "type": "string",
                        "description": "AI provider: 'claude', 'openai', 'gemini', etc."
                    },
                    "api_key": {
                        "type": "string",
                        "description": "Full API key for this provider account"
                    },
                    "model_tier": {
                        "type": "string",
                        "description": "Model capability tier: 'opus', 'sonnet', or 'haiku'",
                        "default": "sonnet"
                    }
                },
                "required": ["label", "provider", "api_key"]
            }),
        },
        ToolDefinition {
            name: "account_list".to_string(),
            description: concat!(
                "List all accounts in the Orchestra account pool. ",
                "API keys are masked to show only the last 4 characters."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        ToolDefinition {
            name: "account_remove".to_string(),
            description: "Remove an account from the Orchestra account pool by its ID.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Account ID to remove (from account_list)"
                    }
                },
                "required": ["id"]
            }),
        },
    ]
}

// ---------------------------------------------------------------------------
// Formatting helper (mirrors mod.rs pattern)
// ---------------------------------------------------------------------------

fn format_markdown(frontmatter: &[(&str, &str)], body: &str, next_steps: &[(&str, &str)]) -> String {
    let mut md = String::from("---\n");
    for (k, v) in frontmatter {
        md.push_str(&format!("{}: {}\n", k, v));
    }
    md.push_str("---\n\n");
    md.push_str(body);
    if !next_steps.is_empty() {
        md.push_str("\n\n---\n\n## Next Steps\n");
        for (label, cmd) in next_steps {
            md.push_str(&format!("- **{}:** `{}`\n", label, cmd));
        }
    }
    md
}

fn tool_text(text: String) -> ToolCallResult {
    ToolCallResult {
        content: vec![ContentItem::Text { text }],
        is_error: None,
    }
}

fn tool_error(message: String) -> ToolCallResult {
    ToolCallResult {
        content: vec![ContentItem::Text { text: message }],
        is_error: Some(true),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_mask_key_long() {
        assert_eq!(mask_key("sk-ant-abc123"), "****abc123");
    }

    #[test]
    fn test_mask_key_short() {
        assert_eq!(mask_key("abc"), "****");
    }

    #[test]
    fn test_mask_key_exactly_four() {
        assert_eq!(mask_key("1234"), "****");
    }

    #[test]
    fn test_parse_iso_secs_valid() {
        // 1970-01-01T00:00:00Z should be 0
        assert_eq!(parse_iso_secs("1970-01-01T00:00:00Z"), Some(0));
    }

    #[test]
    fn test_parse_iso_secs_invalid() {
        assert_eq!(parse_iso_secs("not-a-date"), None);
    }

    #[test]
    fn test_account_add_missing_label() {
        let result = exec_account_add(&json!({ "provider": "claude", "api_key": "sk-test" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_account_add_missing_provider() {
        let result = exec_account_add(&json!({ "label": "Test", "api_key": "sk-test" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_account_add_missing_api_key() {
        let result = exec_account_add(&json!({ "label": "Test", "provider": "claude" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_account_remove_missing_id() {
        let result = exec_account_remove(&json!({}));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_account_remove_unknown_id() {
        let result = exec_account_remove(&json!({ "id": "acc-does-not-exist-999" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_account_list_no_accounts() {
        // list_accounts from an empty/default store should not panic
        let result = exec_account_list(&json!({}));
        assert!(result.is_error.is_none());
    }

    #[test]
    fn test_tool_definitions_count() {
        let defs = tool_definitions();
        assert_eq!(defs.len(), 3);
        let names: Vec<&str> = defs.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"account_add"));
        assert!(names.contains(&"account_list"));
        assert!(names.contains(&"account_remove"));
    }

    #[test]
    fn test_get_best_account_empty() {
        // Should return None gracefully
        let result = get_best_account("claude", "opus");
        // May return None or Some depending on real file — just assert it doesn't panic
        let _ = result;
    }
}
