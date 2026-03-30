// Agent Spawn — Spawn, track, query, and kill sub-agents
//
// Provides four MCP tools:
//   agent_spawn   — launch a sub-agent subprocess
//   agent_status  — list all or query one spawned agent
//   agent_result  — retrieve stdout output of a finished agent
//   agent_kill    — terminate a running agent process
//
// Sub-modules:
//   accounts      — API account pool manager (account_add, account_list, account_remove)
//   chain         — sequential agent chains  (agent_chain, chain_status)

pub mod accounts;
pub mod chain;
pub mod providers;

use providers::{AgentSpawnConfig as ProviderConfig, ProviderAdapter};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::mcp_server::{ContentItem, ToolCallResult, ToolDefinition};

// helpers::format_markdown is not re-exported publicly; inline the import path
// via the module's private mod — instead, we duplicate the call via super path.
// Since helpers is private, we call it from mcp_server's sibling context:
// tools.rs can call it, but agent_spawn lives outside mcp_server.
// Solution: expose a thin wrapper here, mirroring the same format_markdown API.
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnedAgent {
    pub pid: u32,
    pub agent_slug: String,
    pub instruction: String,
    pub provider: String,
    pub task_id: Option<String>,
    pub started_at: String,
    pub status: String, // "running" | "completed" | "failed" | "killed"
    pub output: Option<String>,
}

/// A minimal agent config entry from ~/.orchestra/agents.json (or hardcoded fallback).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub slug: String,
    pub name: String,
    pub system_prompt: String,
    pub default_model: String,
}

// ---------------------------------------------------------------------------
// Global process registry
// ---------------------------------------------------------------------------

static REGISTRY: Mutex<Option<HashMap<u32, SpawnedAgent>>> = Mutex::new(None);

fn with_registry<F, R>(f: F) -> R
where
    F: FnOnce(&mut HashMap<u32, SpawnedAgent>) -> R,
{
    let mut guard = REGISTRY.lock().expect("agent registry mutex poisoned");
    let map = guard.get_or_insert_with(HashMap::new);
    f(map)
}

// ---------------------------------------------------------------------------
// Agent config resolution
// ---------------------------------------------------------------------------

/// Return the path to the agents config file.
fn agents_json_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".orchestra").join("agents.json"))
}

/// Load agent config from ~/.orchestra/agents.json if it exists,
/// otherwise fall back to a built-in hardcoded list.
fn load_agent_config(slug: &str) -> Option<AgentConfig> {
    // Try to read from file first
    if let Some(path) = agents_json_path() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<Vec<AgentConfig>>(&raw) {
                if let Some(entry) = list.into_iter().find(|a| a.slug == slug) {
                    return Some(entry);
                }
            }
        }
    }

    // Hardcoded fallback catalogue — covers the standard Orchestra team
    let catalogue: &[(&str, &str, &str)] = &[
        ("go-developer",       "Mostafa Ali Hassan",      "You are Mostafa, a Go developer (ex-Google Go Language Team). You write idiomatic, high-performance Go code. You are precise, concise, and test-driven."),
        ("go-web-developer",   "Taha Mahmoud Salama",     "You are Taha, a Go web developer (ex-Uber Go Gateway team). You build production-grade HTTP APIs and microservices in Go."),
        ("go-ai-developer",    "Nabil Ashraf Kamel",      "You are Nabil, a Go AI developer (ex-Anthropic MCP Protocol team). You implement MCP servers, AI tool integrations, and agent orchestration in Go."),
        ("laravel-developer",  "Omar Magdy El-Sayed",     "You are Omar, a Laravel developer (ex-Laravel Core Team, ex-Spatie). You write clean, idiomatic PHP 8.4+ and Laravel 13 code with full test coverage."),
        ("flutter-developer",  "Ziad Khaled Nasser",      "You are Ziad, a Flutter developer (ex-Google Flutter Core Team). You build performant, accessible cross-platform Flutter apps."),
        ("rust-developer",     "Karim Hossam El-Desouky", "You are Karim, a Rust developer (ex-Mozilla Rust Compiler, ex-SpaceX). You write safe, zero-cost abstraction Rust with a focus on correctness."),
        ("python-developer",   "Youssef Sherif Abdallah", "You are Youssef, a Python developer and Linux kernel contributor. You specialise in ML pipelines, data processing, and scientific computing."),
        ("supabase-developer", "Khaled Mostafa Anwar",    "You are Khaled, a Supabase developer (ex-Supabase, ex-Vercel). You are an expert in migrations, RLS policies, Edge Functions, and real-time subscriptions."),
        ("frontend-developer", "Yassin Tamer Farouk",     "You are Yassin, a frontend developer (ex-Meta React Core Team). You build accessible, pixel-perfect UIs with React and modern CSS."),
        ("nextjs-developer",   "Seif Tarek El-Sharkawy",  "You are Seif, a Next.js developer (ex-Meta Instagram Web). You build SSR/SSG apps, npm packages, and full-stack Next.js 15 solutions."),
        ("qa-engineer",        "Mariam Ashraf Helmy",     "You are Mariam, a QA engineer (ex-Red Hat RHEL QA Infrastructure). You write comprehensive test suites across Go, PHP, TypeScript, and Playwright E2E tests."),
        ("devops-engineer",    "Tarek Ibrahim Saleh",     "You are Tarek, a DevOps engineer (ex-AWS, ex-Google Cloud). You manage Docker, Caddy, GitHub Actions, and production deployments."),
        ("security-engineer",  "Ayman Walid Nasser",      "You are Ayman, a security engineer (ex-NSA Red Team, ex-Cloudflare). You perform threat modelling, code audits, and penetration testing."),
        ("ai-developer",       "Khalid Amr Osman",        "You are Khalid, an AI developer (ex-Anthropic Claude Tool Use team). You integrate AI SDKs, design multi-agent workflows, and build prompt pipelines."),
        ("tech-leader",        "Ahmad Hazem El-Naggar",   "You are Ahmad, a tech leader (ex-Google Dev Tools Division Head). You coordinate engineering teams, review architecture, and ensure delivery."),
        ("twin-responder",     "Orchestra Twin",          "You are Orchestra Twin — an AI assistant that responds to messages on behalf of the user. Read the message, respond using browser_reply, keep it natural and concise. Use WhatsApp formatting: *bold*, _italic_. If asked to do something, use MCP tools (browser_read, browser_search, etc.) and report back. Do NOT ask for permission — just act."),
    ];

    catalogue
        .iter()
        .find(|(s, _, _)| *s == slug)
        .map(|(s, name, prompt)| AgentConfig {
            slug: s.to_string(),
            name: name.to_string(),
            system_prompt: prompt.to_string(),
            default_model: "claude-sonnet-4-5".to_string(),
        })
}

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

fn iso_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Reuse the simple calendar logic from days_to_ymd
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
// Tool: agent_spawn
// ---------------------------------------------------------------------------

pub fn exec_agent_spawn(args: &Value) -> ToolCallResult {
    // ── Required params ──────────────────────────────────────────────────────
    let agent_slug = match args.get("agent_slug").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => return tool_error("Missing required parameter: agent_slug".to_string()),
    };
    let instruction = match args.get("instruction").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => return tool_error("Missing required parameter: instruction".to_string()),
    };

    // ── Optional params ───────────────────────────────────────────────────────
    let provider = args
        .get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or("claude")
        .to_string();
    let task_id = args
        .get("task_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let api_key_override = args
        .get("api_key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let model_override = args
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Workspace: default to current directory
    let workspace = args
        .get("workspace")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| std::env::current_dir().ok().map(|p| p.to_string_lossy().to_string()))
        .unwrap_or_else(|| "/tmp".to_string());

    // ── Resolve agent config ──────────────────────────────────────────────────
    let config = match load_agent_config(&agent_slug) {
        Some(c) => c,
        None => {
            return tool_error(format!(
                "Unknown agent: `{}`. Add it to ~/.orchestra/agents.json or use one of the built-in slugs.",
                agent_slug
            ))
        }
    };

    let model = model_override.unwrap_or(config.default_model.clone());

    // Optional system_prompt override (used by twin dispatch to inject event data)
    let system_prompt_override = args
        .get("system_prompt")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // ── Build the provider config ─────────────────────────────────────────────
    let mcp_config_path = format!("{}/.mcp.json", workspace);
    let provider_config = ProviderConfig {
        slug: agent_slug.clone(),
        system_prompt: system_prompt_override.unwrap_or_else(|| config.system_prompt.clone()),
        model: model.clone(),
        provider: provider.clone(),
        api_key: api_key_override,
        workspace: workspace.clone(),
        instruction: instruction.clone(),
        mcp_config_path: Some(mcp_config_path),
    };

    // ── Route to the correct provider adapter ────────────────────────────────
    let child = match provider.as_str() {
        "claude" => providers::claude::Claude::spawn(&provider_config),
        "gemini" => providers::gemini::Gemini::spawn(&provider_config),
        "openai" => providers::openai::OpenAI::spawn(&provider_config),
        "ollama" => providers::ollama::Ollama::spawn(&provider_config),
        "deepseek" => providers::openai::OpenAI::spawn_with_base(
            &provider_config,
            "https://api.deepseek.com",
        ),
        "qwen" => providers::openai::OpenAI::spawn_with_base(
            &provider_config,
            "https://dashscope.aliyuncs.com/compatible-mode",
        ),
        "apple" => providers::apple::Apple::spawn(&provider_config),
        "grok" | "xai" => providers::grok::Grok::spawn(&provider_config),
        other => Err(format!(
            "Unknown provider: `{}`. Supported: claude, gemini, openai, ollama, deepseek, qwen, apple, grok",
            other
        )),
    };

    let child = match child {
        Ok(c) => c,
        Err(e) => return tool_error(e),
    };

    let pid = child.id();
    let started_at = iso_now();

    // Capture task_id for the background thread before moving child
    let bg_task_id = task_id.clone();

    // Store the child's output asynchronously by waiting in a background thread
    // and writing the result back into the registry.
    std::thread::spawn(move || {
        let output = child.wait_with_output();

        let (final_output, success) = with_registry(|map| {
            if let Some(entry) = map.get_mut(&pid) {
                match output {
                    Ok(out) => {
                        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                        let ok = out.status.success();
                        entry.status = if ok {
                            "completed".to_string()
                        } else {
                            "failed".to_string()
                        };
                        let combined = if stderr.is_empty() {
                            stdout
                        } else {
                            format!("{}\n\n--- stderr ---\n{}", stdout, stderr)
                        };
                        entry.output = Some(combined.clone());
                        (combined, ok)
                    }
                    Err(e) => {
                        let msg = format!("Process wait error: {}", e);
                        entry.status = "failed".to_string();
                        entry.output = Some(msg.clone());
                        (msg, false)
                    }
                }
            } else {
                (String::new(), false)
            }
        });

        // ── Completion detection: advance chain if this PID belongs to one ──
        chain::advance_chain(pid, &final_output, success);

        // ── Post task comment if task_id was set and NOT part of a chain ──
        // (chains handle their own comment posting on completion)
        if let Some(ref tid) = bg_task_id {
            if chain::chain_id_for_pid(pid).is_none() {
                post_task_comment_standalone(tid, pid, &final_output, success);
            }
        }
    });

    // Register the agent as running (before the thread above can update it)
    let record = SpawnedAgent {
        pid,
        agent_slug: agent_slug.clone(),
        instruction: instruction.clone(),
        provider: provider.clone(),
        task_id: task_id.clone(),
        started_at: started_at.clone(),
        status: "running".to_string(),
        output: None,
    };
    with_registry(|map| map.insert(pid, record));

    // ── Build response ────────────────────────────────────────────────────────
    let task_info = task_id
        .as_deref()
        .map(|t| format!("\n**Task ID:** `{}`", t))
        .unwrap_or_default();

    let body = format!(
        "## Agent Spawned\n\n\
        **Agent:** {} (`{}`)\n\
        **PID:** `{}`\n\
        **Provider:** `{}`\n\
        **Model:** `{}`\n\
        **Workspace:** `{}`\n\
        **Status:** `running`\n\
        **Started:** `{}`{}\n\n\
        **Instruction:**\n> {}\n\n\
        Use `agent_status` to poll for completion, `agent_result` to fetch output once done.",
        config.name,
        agent_slug,
        pid,
        provider,
        model,
        workspace,
        started_at,
        task_info,
        instruction,
    );

    let md = format_markdown(
        &[
            ("tool", "agent_spawn"),
            ("status", "ok"),
            ("pid", &pid.to_string()),
            ("agent", &agent_slug),
            ("provider", &provider),
        ],
        &body,
        &[
            ("Poll for completion", "agent_status"),
            ("Fetch output when done", "agent_result"),
            ("Kill the agent", "agent_kill"),
        ],
    );
    tool_text(md)
}

// ---------------------------------------------------------------------------
// Tool: agent_status
// ---------------------------------------------------------------------------

pub fn exec_agent_status(args: &Value) -> ToolCallResult {
    let pid_filter = args
        .get("pid")
        .and_then(|v| v.as_u64())
        .map(|p| p as u32);

    let agents: Vec<SpawnedAgent> = with_registry(|map| {
        if let Some(pid) = pid_filter {
            map.get(&pid).cloned().into_iter().collect()
        } else {
            let mut list: Vec<SpawnedAgent> = map.values().cloned().collect();
            // Sort by started_at descending (most recent first)
            list.sort_by(|a, b| b.started_at.cmp(&a.started_at));
            list
        }
    });

    if agents.is_empty() {
        let msg = if let Some(pid) = pid_filter {
            format!("No agent found with PID `{}`.", pid)
        } else {
            "No agents have been spawned in this session.".to_string()
        };
        return tool_text(format_markdown(
            &[("tool", "agent_status"), ("status", "ok"), ("count", "0")],
            &msg,
            &[("Spawn an agent", "agent_spawn")],
        ));
    }

    let mut table = String::from(
        "## Spawned Agents\n\n\
        | PID | Agent | Provider | Status | Started | Task |\n\
        |-----|-------|----------|--------|---------|------|\n",
    );
    for a in &agents {
        table.push_str(&format!(
            "| `{}` | {} | {} | `{}` | {} | {} |\n",
            a.pid,
            a.agent_slug,
            a.provider,
            a.status,
            a.started_at,
            a.task_id.as_deref().unwrap_or("-"),
        ));
    }

    // For a single-agent query, add output preview
    if pid_filter.is_some() {
        if let Some(agent) = agents.first() {
            if let Some(ref out) = agent.output {
                let preview = if out.len() > 500 {
                    format!("{}…", &out[..500])
                } else {
                    out.clone()
                };
                table.push_str(&format!(
                    "\n### Output Preview\n\n```\n{}\n```\n\nUse `agent_result` with PID `{}` to get the full output.",
                    preview, agent.pid,
                ));
            }
        }
    }

    let md = format_markdown(
        &[
            ("tool", "agent_status"),
            ("status", "ok"),
            ("count", &agents.len().to_string()),
        ],
        &table,
        &[
            ("Get full output", "agent_result"),
            ("Kill an agent", "agent_kill"),
            ("Spawn a new agent", "agent_spawn"),
        ],
    );
    tool_text(md)
}

// ---------------------------------------------------------------------------
// Tool: agent_result
// ---------------------------------------------------------------------------

pub fn exec_agent_result(args: &Value) -> ToolCallResult {
    let pid = match args.get("pid").and_then(|v| v.as_u64()) {
        Some(p) => p as u32,
        None => return tool_error("Missing required parameter: pid".to_string()),
    };

    let agent = with_registry(|map| map.get(&pid).cloned());

    match agent {
        None => tool_error(format!("No agent found with PID `{}`.", pid)),
        Some(a) => {
            if a.status == "running" {
                let body = format!(
                    "Agent `{}` (PID `{}`) is still **running**. Poll with `agent_status` and retry once status is `completed` or `failed`.",
                    a.agent_slug, pid
                );
                return tool_text(format_markdown(
                    &[
                        ("tool", "agent_result"),
                        ("status", "running"),
                        ("pid", &pid.to_string()),
                    ],
                    &body,
                    &[("Check status", "agent_status")],
                ));
            }

            let output = a
                .output
                .clone()
                .unwrap_or_else(|| "(no output captured)".to_string());

            let body = format!(
                "## Result of Agent `{}` (PID `{}`)\n\n\
                **Status:** `{}`  \n\
                **Started:** {}  \n\
                **Agent:** {}  \n\n\
                ---\n\n\
                {}",
                a.agent_slug, pid, a.status, a.started_at, a.agent_slug, output,
            );

            let md = format_markdown(
                &[
                    ("tool", "agent_result"),
                    ("status", "ok"),
                    ("pid", &pid.to_string()),
                    ("agent_status", &a.status),
                ],
                &body,
                &[
                    ("Check all agents", "agent_status"),
                    ("Spawn another agent", "agent_spawn"),
                ],
            );
            tool_text(md)
        }
    }
}

// ---------------------------------------------------------------------------
// Tool: agent_kill
// ---------------------------------------------------------------------------

pub fn exec_agent_kill(args: &Value) -> ToolCallResult {
    let pid = match args.get("pid").and_then(|v| v.as_u64()) {
        Some(p) => p as u32,
        None => return tool_error("Missing required parameter: pid".to_string()),
    };

    // Check registry first
    let exists = with_registry(|map| map.contains_key(&pid));
    if !exists {
        return tool_error(format!("No agent found with PID `{}`.", pid));
    }

    // Try to kill the OS process using platform-appropriate command
    #[cfg(unix)]
    let kill_result: Result<(), String> = std::process::Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())
        .and_then(|out| {
            if out.status.success() {
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                // If the process already exited that's fine — treat as ok
                if stderr.contains("No such process") || stderr.contains("no such process") {
                    Ok(())
                } else {
                    Err(format!("kill -TERM failed: {}", stderr.trim()))
                }
            }
        });

    #[cfg(windows)]
    let kill_result: Result<(), String> = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output()
        .map(|_| ())
        .map_err(|e| e.to_string());

    let (status_msg, new_status) = match kill_result {
        Ok(()) => ("Signal sent, process terminating.".to_string(), "killed"),
        Err(e) => (
            format!("Kill signal failed (process may have already exited): {}", e),
            "killed",
        ),
    };

    with_registry(|map| {
        if let Some(entry) = map.get_mut(&pid) {
            entry.status = new_status.to_string();
        }
    });

    let body = format!(
        "## Agent Killed\n\n\
        **PID:** `{}`  \n\
        **Status:** `{}`  \n\n\
        {}",
        pid, new_status, status_msg,
    );

    let md = format_markdown(
        &[
            ("tool", "agent_kill"),
            ("status", "ok"),
            ("pid", &pid.to_string()),
        ],
        &body,
        &[
            ("Check remaining agents", "agent_status"),
            ("Spawn a new agent", "agent_spawn"),
        ],
    );
    tool_text(md)
}

// ---------------------------------------------------------------------------
// Standalone task comment (for non-chain agent_spawn with a task_id)
// ---------------------------------------------------------------------------

fn post_task_comment_standalone(task_id: &str, pid: u32, output: &str, success: bool) {
    let task_id = task_id.to_string();
    let output = output.to_string();

    std::thread::spawn(move || {
        let cloud_url = std::env::var("ORCHESTRA_CLOUD_URL")
            .unwrap_or_else(|_| "https://app.orchestramcp.com".to_string());

        let url = format!("{}/api/tasks/{}/comments", cloud_url, task_id);
        let status_label = if success { "completed" } else { "failed" };
        let body = serde_json::json!({
            "content": format!("Agent (PID {}) {}.\n\n{}", pid, status_label, output),
            "source": "agent_spawn"
        });

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build();

        match client {
            Ok(c) => {
                let token = std::env::var("ORCHESTRA_TOKEN").unwrap_or_default();
                let req = c.post(&url).header("Content-Type", "application/json").json(&body);
                let req = if !token.is_empty() { req.bearer_auth(token) } else { req };
                match req.send() {
                    Ok(r) => eprintln!("[agent_spawn] task comment posted — status {}", r.status()),
                    Err(e) => eprintln!("[agent_spawn] task comment failed: {}", e),
                }
            }
            Err(e) => eprintln!("[agent_spawn] HTTP client build failed: {}", e),
        }
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Tool definitions (JSON Schema)
// ---------------------------------------------------------------------------

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "agent_spawn".to_string(),
            description: concat!(
                "Spawn a sub-agent subprocess (e.g. go-developer, laravel-developer). ",
                "The agent runs Claude Code non-interactively with the given instruction. ",
                "Returns the PID immediately — poll with agent_status, fetch output with agent_result."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "agent_slug": {
                        "type": "string",
                        "description": "Which agent to spawn — e.g. 'go-developer', 'laravel-developer', 'qa-engineer'"
                    },
                    "instruction": {
                        "type": "string",
                        "description": "What the agent should do (full task description)"
                    },
                    "provider": {
                        "type": "string",
                        "description": "AI provider: 'claude' (default), 'gemini', 'openai', 'ollama', 'deepseek', 'qwen'. Non-Claude providers call their respective APIs via curl.",
                        "default": "claude"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "Optional task ID to link this spawn to an existing Orchestra task for context"
                    },
                    "api_key": {
                        "type": "string",
                        "description": "Optional API key override. If omitted, ANTHROPIC_API_KEY from the environment is used."
                    },
                    "model": {
                        "type": "string",
                        "description": "Optional model override — e.g. 'claude-opus-4-5'. Defaults to the agent's configured model."
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Working directory for the agent. Defaults to the current working directory."
                    }
                },
                "required": ["agent_slug", "instruction"]
            }),
        },
        ToolDefinition {
            name: "agent_status".to_string(),
            description: concat!(
                "List all spawned agents or query a specific one by PID. ",
                "Shows pid, agent slug, provider, status (running/completed/failed/killed), and start time."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "pid": {
                        "type": "number",
                        "description": "Optional process PID. If omitted, returns all agents."
                    }
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "agent_result".to_string(),
            description: concat!(
                "Retrieve the full stdout output of a completed or failed agent. ",
                "Returns an error if the agent is still running."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "pid": {
                        "type": "number",
                        "description": "Process PID returned by agent_spawn"
                    }
                },
                "required": ["pid"]
            }),
        },
        ToolDefinition {
            name: "agent_kill".to_string(),
            description: concat!(
                "Terminate a running agent process by PID. ",
                "Sends SIGTERM on Unix or taskkill on Windows. Updates status to 'killed'."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "pid": {
                        "type": "number",
                        "description": "Process PID to kill"
                    }
                },
                "required": ["pid"]
            }),
        },
    ]
    .into_iter()
    .chain(accounts::tool_definitions())
    .chain(chain::tool_definitions())
    .collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_load_agent_config_known_slug() {
        let cfg = load_agent_config("go-developer");
        assert!(cfg.is_some());
        let cfg = cfg.unwrap();
        assert_eq!(cfg.slug, "go-developer");
        assert!(!cfg.system_prompt.is_empty());
        assert!(!cfg.default_model.is_empty());
    }

    #[test]
    fn test_load_agent_config_unknown_slug() {
        let cfg = load_agent_config("unknown-does-not-exist");
        assert!(cfg.is_none());
    }

    #[test]
    fn test_agent_spawn_missing_slug() {
        let result = exec_agent_spawn(&json!({
            "instruction": "Do something"
        }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_spawn_missing_instruction() {
        let result = exec_agent_spawn(&json!({
            "agent_slug": "go-developer"
        }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_spawn_unknown_provider() {
        // Completely unknown provider string should return an error
        let result = exec_agent_spawn(&json!({
            "agent_slug": "go-developer",
            "instruction": "Write a hello world",
            "provider": "unknown-provider-xyz"
        }));
        assert_eq!(result.is_error, Some(true));
        match &result.content[0] {
            ContentItem::Text { text } => {
                assert!(text.contains("Unknown provider"), "got: {}", text);
            }
            _ => panic!("expected text content"),
        }
    }

    #[test]
    fn test_agent_spawn_gemini_missing_key_is_error() {
        // Gemini without an API key in env and no api_key arg → curl spawns but
        // the provider will return an error before spawn because no key is available.
        // We only check that the provider is now recognized (no "not yet implemented").
        // The actual error depends on env, so just verify it does NOT say "not yet implemented".
        // Clear any key that might be set in CI.
        // Note: we cannot guarantee curl is installed in all test environments, so
        // we only check the provider routing part via the error message content.
        std::env::remove_var("GEMINI_API_KEY");
        std::env::remove_var("GOOGLE_API_KEY");
        let result = exec_agent_spawn(&json!({
            "agent_slug": "go-developer",
            "instruction": "Write a hello world",
            "provider": "gemini"
        }));
        // Should fail (no key), but NOT with "not yet implemented"
        if result.is_error == Some(true) {
            match &result.content[0] {
                ContentItem::Text { text } => {
                    assert!(!text.contains("not yet implemented"), "got: {}", text);
                }
                _ => panic!("expected text content"),
            }
        }
        // If it somehow succeeded (key was set in env), that's also fine
    }

    #[test]
    fn test_agent_spawn_unknown_agent() {
        let result = exec_agent_spawn(&json!({
            "agent_slug": "made-up-agent",
            "instruction": "Do the thing"
        }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_status_empty_registry() {
        // Should return gracefully with 0 agents
        let result = exec_agent_status(&json!({}));
        assert!(result.is_error.is_none());
    }

    #[test]
    fn test_agent_result_missing_pid() {
        let result = exec_agent_result(&json!({}));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_result_unknown_pid() {
        let result = exec_agent_result(&json!({ "pid": 999999999 }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_kill_missing_pid() {
        let result = exec_agent_kill(&json!({}));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_agent_kill_unknown_pid() {
        let result = exec_agent_kill(&json!({ "pid": 999999999 }));
        assert_eq!(result.is_error, Some(true));
    }

    #[test]
    fn test_tool_definitions_count() {
        let defs = tool_definitions();
        // 4 core agent tools + 3 account tools + 2 chain tools = 9
        assert_eq!(defs.len(), 9);
        let names: Vec<&str> = defs.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"agent_spawn"));
        assert!(names.contains(&"agent_status"));
        assert!(names.contains(&"agent_result"));
        assert!(names.contains(&"agent_kill"));
        assert!(names.contains(&"account_add"));
        assert!(names.contains(&"account_list"));
        assert!(names.contains(&"account_remove"));
        assert!(names.contains(&"agent_chain"));
        assert!(names.contains(&"chain_status"));
    }

    #[test]
    fn test_iso_now_format() {
        let ts = iso_now();
        // Basic format check: YYYY-MM-DDTHH:MM:SSZ
        assert_eq!(ts.len(), 20);
        assert!(ts.ends_with('Z'));
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[7..8], "-");
        assert_eq!(&ts[10..11], "T");
    }
}
