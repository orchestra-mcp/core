// Agent Chain — Sequential multi-step agent execution
//
// A chain is a sequence of agent steps that fire automatically when the
// previous step completes. Each step is an agent_spawn call whose output
// is forwarded as context to the next step.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::mcp_server::{ContentItem, ToolCallResult, ToolDefinition};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainStep {
    pub agent_slug: String,
    pub instruction: String,
    pub provider: Option<String>,
    pub wait_for_previous: bool,
    pub status: String,      // "pending" | "running" | "completed" | "failed" | "skipped"
    pub pid: Option<u32>,
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chain {
    pub id: String,
    pub steps: Vec<ChainStep>,
    pub current_step: usize,
    pub task_id: Option<String>,
    pub status: String, // "pending" | "running" | "completed" | "failed"
    pub created_at: String,
}

/// Deserializable step definition as received from MCP tool arguments.
#[derive(Debug, Clone, Deserialize)]
pub struct StepInput {
    pub agent: String,
    pub instruction: String,
    pub provider: Option<String>,
}

// ---------------------------------------------------------------------------
// Global chain registry
// ---------------------------------------------------------------------------

static CHAINS: Mutex<Option<HashMap<String, Chain>>> = Mutex::new(None);

fn with_chains<F, R>(f: F) -> R
where
    F: FnOnce(&mut HashMap<String, Chain>) -> R,
{
    let mut guard = CHAINS.lock().expect("chain registry mutex poisoned");
    let map = guard.get_or_insert_with(HashMap::new);
    f(map)
}

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

fn iso_now() -> String {
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

// ---------------------------------------------------------------------------
// Core: create_chain
// ---------------------------------------------------------------------------

/// Create a new chain and immediately start the first step.
/// Returns the chain ID.
pub fn create_chain(step_inputs: Vec<StepInput>, task_id: Option<String>) -> Result<String, String> {
    if step_inputs.is_empty() {
        return Err("Chain must have at least one step.".to_string());
    }

    let chain_id = format!(
        "chain-{}",
        uuid::Uuid::new_v4().to_string().replace('-', "")[..8].to_string()
    );

    let steps: Vec<ChainStep> = step_inputs
        .into_iter()
        .enumerate()
        .map(|(i, s)| ChainStep {
            agent_slug: s.agent,
            instruction: s.instruction,
            provider: s.provider,
            wait_for_previous: i > 0, // first step never waits
            status: if i == 0 { "pending".to_string() } else { "pending".to_string() },
            pid: None,
            output: None,
        })
        .collect();

    let chain = Chain {
        id: chain_id.clone(),
        steps,
        current_step: 0,
        task_id: task_id.clone(),
        status: "running".to_string(),
        created_at: iso_now(),
    };

    with_chains(|map| map.insert(chain_id.clone(), chain));

    // Fire the first step
    fire_step(&chain_id, 0, None)?;

    Ok(chain_id)
}

// ---------------------------------------------------------------------------
// Core: advance_chain
// ---------------------------------------------------------------------------

/// Called when an agent (identified by PID) completes. If this agent belongs
/// to a chain, fires the next step with the previous output as context.
pub fn advance_chain(pid: u32, completed_output: &str, success: bool) {
    // Find the chain that owns this pid
    let chain_id = with_chains(|map| {
        map.iter_mut().find_map(|(id, chain)| {
            let idx = chain.steps.iter().position(|s| s.pid == Some(pid));
            if let Some(idx) = idx {
                let step = &mut chain.steps[idx];
                step.status = if success { "completed".to_string() } else { "failed".to_string() };
                step.output = Some(completed_output.to_string());
                Some(id.clone())
            } else {
                None
            }
        })
    });

    let chain_id = match chain_id {
        Some(id) => id,
        None => return, // PID not part of any chain
    };

    // If the step failed, mark chain as failed and stop
    if !success {
        with_chains(|map| {
            if let Some(chain) = map.get_mut(&chain_id) {
                chain.status = "failed".to_string();
            }
        });
        return;
    }

    // Find the next pending step
    let next = with_chains(|map| {
        map.get(&chain_id).and_then(|chain| {
            let current = chain.steps.iter().position(|s| s.pid == Some(pid));
            current.and_then(|i| {
                if i + 1 < chain.steps.len() {
                    Some((i + 1, chain.steps[i].output.clone()))
                } else {
                    None
                }
            })
        })
    });

    match next {
        None => {
            // All steps done
            with_chains(|map| {
                if let Some(chain) = map.get_mut(&chain_id) {
                    chain.status = "completed".to_string();
                }
            });

            // Post final result as task comment if task_id is set
            let task_id = with_chains(|map| {
                map.get(&chain_id)
                    .and_then(|c| c.task_id.clone())
            });
            if let Some(tid) = task_id {
                post_task_comment(&tid, &chain_id, completed_output);
            }
        }
        Some((next_idx, prev_output)) => {
            // Advance current_step pointer
            with_chains(|map| {
                if let Some(chain) = map.get_mut(&chain_id) {
                    chain.current_step = next_idx;
                }
            });

            // Fire the next step (ignore errors — already logged via eprintln)
            let _ = fire_step(&chain_id, next_idx, prev_output.as_deref());
        }
    }
}

// ---------------------------------------------------------------------------
// Core: chain_status
// ---------------------------------------------------------------------------

/// Returns a JSON value describing the chain's full status.
pub fn chain_status(chain_id: &str) -> Option<Value> {
    with_chains(|map| {
        map.get(chain_id).map(|chain| {
            let steps_json: Vec<Value> = chain
                .steps
                .iter()
                .enumerate()
                .map(|(i, s)| {
                    json!({
                        "index": i,
                        "agent": s.agent_slug,
                        "status": s.status,
                        "pid": s.pid,
                        "has_output": s.output.is_some(),
                        "output_preview": s.output.as_deref().map(|o| {
                            if o.len() > 200 { format!("{}…", &o[..200]) } else { o.to_string() }
                        })
                    })
                })
                .collect();

            json!({
                "id": chain.id,
                "status": chain.status,
                "current_step": chain.current_step,
                "total_steps": chain.steps.len(),
                "task_id": chain.task_id,
                "created_at": chain.created_at,
                "steps": steps_json
            })
        })
    })
}

// ---------------------------------------------------------------------------
// Internal: fire_step
// ---------------------------------------------------------------------------

fn fire_step(chain_id: &str, step_idx: usize, previous_output: Option<&str>) -> Result<(), String> {
    // Read step info without holding the lock during spawn
    let (agent_slug, instruction, provider, task_id) = with_chains(|map| {
        map.get(chain_id).and_then(|chain| {
            chain.steps.get(step_idx).map(|s| {
                (
                    s.agent_slug.clone(),
                    s.instruction.clone(),
                    s.provider.clone(),
                    chain.task_id.clone(),
                )
            })
        })
    })
    .ok_or_else(|| format!("Chain `{}` step {} not found.", chain_id, step_idx))?;

    // Build augmented instruction including previous step output as context
    let full_instruction = match previous_output {
        Some(prev) if !prev.is_empty() => format!(
            "{}\n\n---\n**Context from previous step:**\n{}",
            instruction, prev
        ),
        _ => instruction.clone(),
    };

    let provider_str = provider.as_deref().unwrap_or("claude").to_string();

    // Build args JSON for exec_agent_spawn
    let mut spawn_args = json!({
        "agent_slug": agent_slug,
        "instruction": full_instruction,
        "provider": provider_str,
    });

    if let Some(ref tid) = task_id {
        spawn_args["task_id"] = json!(tid);
    }

    // Also inject the best API key from the account pool if available
    if let Some(acc) = crate::agent_spawn::accounts::get_best_account(&provider_str, "sonnet") {
        spawn_args["api_key"] = json!(acc.api_key);
    }

    // Mark step as running before spawn
    with_chains(|map| {
        if let Some(chain) = map.get_mut(chain_id) {
            if let Some(step) = chain.steps.get_mut(step_idx) {
                step.status = "running".to_string();
            }
        }
    });

    let result = crate::agent_spawn::exec_agent_spawn(&spawn_args);

    // Extract PID from the result text (it's embedded in the markdown output)
    let pid = extract_pid_from_result(&result);

    with_chains(|map| {
        if let Some(chain) = map.get_mut(chain_id) {
            if let Some(step) = chain.steps.get_mut(step_idx) {
                match pid {
                    Some(p) => {
                        step.pid = Some(p);
                        // status stays "running" — background thread will call advance_chain
                    }
                    None => {
                        step.status = "failed".to_string();
                        step.output = Some("Failed to spawn agent (no PID returned).".to_string());
                    }
                }
            }
        }
    });

    // Register the chain-pid mapping so the background thread can advance it
    if let Some(p) = pid {
        register_chain_pid(p, chain_id.to_string());
    }

    Ok(())
}

/// Extract the PID integer from the markdown output of exec_agent_spawn.
fn extract_pid_from_result(result: &ToolCallResult) -> Option<u32> {
    let text = match result.content.first() {
        Some(ContentItem::Text { text }) => text,
        _ => return None,
    };
    // Look for "pid: <number>" in frontmatter or "**PID:** `<number>`" in body
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with("pid:") {
            let val = line.trim_start_matches("pid:").trim();
            if let Ok(n) = val.parse::<u32>() {
                return Some(n);
            }
        }
        if line.contains("**PID:**") {
            // Format: **PID:** `12345`
            if let Some(start) = line.find('`') {
                let rest = &line[start + 1..];
                if let Some(end) = rest.find('`') {
                    if let Ok(n) = rest[..end].parse::<u32>() {
                        return Some(n);
                    }
                }
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Chain-PID mapping: lets the background thread resolve chains by PID
// ---------------------------------------------------------------------------

static CHAIN_PIDS: Mutex<Option<HashMap<u32, String>>> = Mutex::new(None);

fn register_chain_pid(pid: u32, chain_id: String) {
    let mut guard = CHAIN_PIDS.lock().expect("chain_pids mutex poisoned");
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(pid, chain_id);
}

/// Look up which chain owns a given PID. Returns the chain_id if found.
pub fn chain_id_for_pid(pid: u32) -> Option<String> {
    let guard = CHAIN_PIDS.lock().expect("chain_pids mutex poisoned");
    guard.as_ref().and_then(|m| m.get(&pid).cloned())
}

// ---------------------------------------------------------------------------
// Post task comment to cloud MCP
// ---------------------------------------------------------------------------

fn post_task_comment(task_id: &str, chain_id: &str, output: &str) {
    let task_id = task_id.to_string();
    let chain_id = chain_id.to_string();
    let output = output.to_string();

    // Fire-and-forget in a background thread
    std::thread::spawn(move || {
        let cloud_url = std::env::var("ORCHESTRA_CLOUD_URL")
            .unwrap_or_else(|_| "https://app.orchestramcp.com".to_string());

        let url = format!("{}/api/tasks/{}/comments", cloud_url, task_id);
        let body = json!({
            "content": format!("Chain `{}` completed.\n\n{}", chain_id, output),
            "source": "agent_chain"
        });

        // Best-effort POST — failures are logged but not fatal
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build();

        match client {
            Ok(c) => {
                let token = std::env::var("ORCHESTRA_TOKEN").unwrap_or_default();
                let req = c
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body);
                let req = if !token.is_empty() {
                    req.bearer_auth(token)
                } else {
                    req
                };
                match req.send() {
                    Ok(r) => eprintln!(
                        "[chain] task comment posted to {} — status {}",
                        url,
                        r.status()
                    ),
                    Err(e) => eprintln!("[chain] failed to post task comment: {}", e),
                }
            }
            Err(e) => eprintln!("[chain] failed to build HTTP client: {}", e),
        }
    });
}

// ---------------------------------------------------------------------------
// MCP tool executors
// ---------------------------------------------------------------------------

pub fn exec_agent_chain(args: &Value) -> ToolCallResult {
    let steps_val = match args.get("steps") {
        Some(v) => v,
        None => return tool_error("Missing required parameter: steps".to_string()),
    };

    let step_inputs: Vec<StepInput> = match serde_json::from_value(steps_val.clone()) {
        Ok(v) => v,
        Err(e) => return tool_error(format!("Invalid steps format: {}", e)),
    };

    if step_inputs.is_empty() {
        return tool_error("steps array must not be empty.".to_string());
    }

    // Validate each step
    for (i, s) in step_inputs.iter().enumerate() {
        if s.agent.is_empty() {
            return tool_error(format!("Step {} is missing 'agent'.", i));
        }
        if s.instruction.is_empty() {
            return tool_error(format!("Step {} is missing 'instruction'.", i));
        }
    }

    let task_id = args
        .get("task_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let total = step_inputs.len();
    let summary: Vec<String> = step_inputs
        .iter()
        .enumerate()
        .map(|(i, s)| format!("{}. **{}** — {}", i + 1, s.agent, &s.instruction[..s.instruction.len().min(80)]))
        .collect();

    match create_chain(step_inputs, task_id.clone()) {
        Ok(chain_id) => {
            let task_info = task_id
                .as_deref()
                .map(|t| format!("\n**Task ID:** `{}`", t))
                .unwrap_or_default();

            let steps_list = summary.join("\n");

            let body = format!(
                "## Agent Chain Created\n\n\
                **Chain ID:** `{}`  \n\
                **Steps:** {}  \n\
                **Status:** `running` — step 1 is executing{}\n\n\
                ### Steps\n\n{}\n\n\
                Use `chain_status` to monitor progress.",
                chain_id, total, task_info, steps_list,
            );

            tool_text(format_markdown(
                &[
                    ("tool", "agent_chain"),
                    ("status", "ok"),
                    ("chain_id", &chain_id),
                    ("steps", &total.to_string()),
                ],
                &body,
                &[
                    ("Monitor chain progress", "chain_status"),
                    ("Check individual agents", "agent_status"),
                ],
            ))
        }
        Err(e) => tool_error(format!("Failed to create chain: {}", e)),
    }
}

pub fn exec_chain_status(args: &Value) -> ToolCallResult {
    let chain_id = match args.get("chain_id").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return tool_error("Missing required parameter: chain_id".to_string()),
    };

    match chain_status(chain_id) {
        None => tool_error(format!("Chain `{}` not found.", chain_id)),
        Some(status_val) => {
            let overall = status_val["status"].as_str().unwrap_or("unknown");
            let current = status_val["current_step"].as_u64().unwrap_or(0);
            let total = status_val["total_steps"].as_u64().unwrap_or(0);

            let mut table = String::from(
                "## Chain Steps\n\n\
                | # | Agent | Status | PID | Output |\n\
                |---|-------|--------|-----|--------|\n",
            );

            if let Some(steps) = status_val["steps"].as_array() {
                for step in steps {
                    let idx = step["index"].as_u64().unwrap_or(0) + 1;
                    let agent = step["agent"].as_str().unwrap_or("-");
                    let st = step["status"].as_str().unwrap_or("-");
                    let pid = match step["pid"].as_u64() {
                        Some(p) => p.to_string(),
                        None => "-".to_string(),
                    };
                    let preview = step["output_preview"]
                        .as_str()
                        .unwrap_or("-")
                        .replace('\n', " ");
                    let preview = if preview.len() > 60 {
                        format!("{}…", &preview[..60])
                    } else {
                        preview
                    };
                    table.push_str(&format!(
                        "| {} | {} | `{}` | {} | {} |\n",
                        idx, agent, st, pid, preview
                    ));
                }
            }

            let body = format!(
                "## Chain `{}`\n\n\
                **Status:** `{}`  \n\
                **Progress:** step {}/{}\n\n\
                {}",
                chain_id, overall, current + 1, total, table,
            );

            tool_text(format_markdown(
                &[
                    ("tool", "chain_status"),
                    ("status", "ok"),
                    ("chain_id", chain_id),
                    ("chain_status", overall),
                ],
                &body,
                &[
                    ("Get agent output", "agent_result"),
                    ("Check all agents", "agent_status"),
                ],
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "agent_chain".to_string(),
            description: concat!(
                "Create and start a sequential chain of agent steps. ",
                "Each step fires automatically when the previous one completes, ",
                "with the previous step's output passed as context. ",
                "Returns a chain_id for monitoring with chain_status."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "description": "Ordered list of agent steps to execute",
                        "items": {
                            "type": "object",
                            "properties": {
                                "agent": {
                                    "type": "string",
                                    "description": "Agent slug — e.g. 'go-developer', 'qa-engineer'"
                                },
                                "instruction": {
                                    "type": "string",
                                    "description": "What this step should do (full task description)"
                                },
                                "provider": {
                                    "type": "string",
                                    "description": "Optional provider override: 'claude', 'openai', etc."
                                }
                            },
                            "required": ["agent", "instruction"]
                        }
                    },
                    "task_id": {
                        "type": "string",
                        "description": "Optional task ID — final chain output will be posted as a task comment"
                    }
                },
                "required": ["steps"]
            }),
        },
        ToolDefinition {
            name: "chain_status".to_string(),
            description: concat!(
                "Get the progress of an agent chain by its chain_id. ",
                "Returns the status of each step, PIDs, and output previews."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "chain_id": {
                        "type": "string",
                        "description": "Chain ID returned by agent_chain"
                    }
                },
                "required": ["chain_id"]
            }),
        },
    ]
}

// ---------------------------------------------------------------------------
// Formatting helpers
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
    fn test_chain_status_unknown_id() {
        let result = exec_chain_status(&json!({ "chain_id": "chain-doesnotexist" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_chain_status_missing_id() {
        let result = exec_chain_status(&json!({}));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_chain_missing_steps() {
        let result = exec_agent_chain(&json!({}));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_chain_empty_steps() {
        let result = exec_agent_chain(&json!({ "steps": [] }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_chain_invalid_steps_format() {
        let result = exec_agent_chain(&json!({ "steps": "not-an-array" }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_chain_step_missing_agent() {
        let result = exec_agent_chain(&json!({
            "steps": [{ "instruction": "do something" }]
        }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_chain_step_missing_instruction() {
        let result = exec_agent_chain(&json!({
            "steps": [{ "agent": "go-developer" }]
        }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_tool_definitions_count() {
        let defs = tool_definitions();
        assert_eq!(defs.len(), 2);
        let names: Vec<&str> = defs.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"agent_chain"));
        assert!(names.contains(&"chain_status"));
    }

    #[test]
    fn test_chain_id_for_pid_unknown() {
        // Should not panic for unknown PID
        let result = chain_id_for_pid(999999999);
        assert!(result.is_none());
    }

    #[test]
    fn test_chain_status_none_for_unknown() {
        let result = chain_status("chain-nonexistent");
        assert!(result.is_none());
    }

    #[test]
    fn test_advance_chain_unknown_pid() {
        // Should not panic for a PID that is not registered in any chain
        advance_chain(999999998, "some output", true);
    }
}
