// Digital Twin — Alert formatting and MCP tool handlers

use serde_json::Value;
use crate::mcp_server::{ContentItem, ToolCallResult, ToolDefinition};

fn format_markdown(frontmatter: &[(&str, &str)], body: &str, next_steps: &[(&str, &str)]) -> String {
    let mut md = String::from("---\n");
    for (k, v) in frontmatter { md.push_str(&format!("{}: {}\n", k, v)); }
    md.push_str("---\n\n");
    md.push_str(body);
    if !next_steps.is_empty() {
        md.push_str("\n\n---\n\n## Next Steps\n");
        for (label, cmd) in next_steps { md.push_str(&format!("- **{}:** `{}`\n", label, cmd)); }
    }
    md
}
use serde_json::json;

/// Return tool definitions for digital twin MCP tools.
pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "twin_start".to_string(),
            description: "Start the digital twin background listener. Monitors mail for new messages.".to_string(),
            input_schema: json!({"type":"object","properties":{},"required":[]}),
        },
        ToolDefinition {
            name: "twin_stop".to_string(),
            description: "Stop the digital twin background listener.".to_string(),
            input_schema: json!({"type":"object","properties":{},"required":[]}),
        },
        ToolDefinition {
            name: "twin_alerts".to_string(),
            description: "Get recent alerts from the digital twin (mail, notifications).".to_string(),
            input_schema: json!({"type":"object","properties":{"limit":{"type":"integer","description":"Max alerts (default 20)"}},"required":[]}),
        },
        ToolDefinition {
            name: "twin_status".to_string(),
            description: "Check digital twin status — running/stopped, alert count.".to_string(),
            input_schema: json!({"type":"object","properties":{},"required":[]}),
        },
        ToolDefinition {
            name: "twin_remember".to_string(),
            description: "Search the twin's memory for past messages, contacts, routines, preferences.".to_string(),
            input_schema: json!({"type":"object","properties":{"query":{"type":"string","description":"What to remember (e.g. 'morning routine', 'Abdul', 'last meeting')"}},"required":["query"]}),
        },
        ToolDefinition {
            name: "twin_learn".to_string(),
            description: "Teach the twin something new — a preference, routine, contact info, or habit to remember.".to_string(),
            input_schema: json!({"type":"object","properties":{"topic":{"type":"string","description":"Topic key (e.g. 'morning-routine', 'contact-abdul', 'preference-prs')"},"content":{"type":"string","description":"What to remember"}},"required":["topic","content"]}),
        },
    ]
}

/// Execute a digital twin tool.
pub fn execute_tool(name: &str, args: &Value) -> ToolCallResult {
    match name {
        "twin_start" => exec_twin_start(),
        "twin_stop" => exec_twin_stop(),
        "twin_alerts" => exec_twin_alerts(args),
        "twin_status" => exec_twin_status(),
        "twin_remember" => exec_twin_remember(args),
        "twin_learn" => exec_twin_learn(args),
        _ => ToolCallResult {
            content: vec![ContentItem::Text { text: format!("Unknown twin tool: {}", name) }],
            is_error: Some(true),
        },
    }
}

fn exec_twin_start() -> ToolCallResult {
    match super::start() {
        Ok(msg) => {
            let md = format_markdown(
                &[("type", "twin"), ("status", "running")],
                &format!("# Digital Twin Started\n\n{}\n\n**Monitoring:** Mail (every 60s)", msg),
                &[("Check alerts", "twin_alerts()"), ("Stop", "twin_stop()")],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => ToolCallResult {
            content: vec![ContentItem::Text { text: format!("Failed to start twin: {}", e) }],
            is_error: Some(true),
        },
    }
}

fn exec_twin_stop() -> ToolCallResult {
    match super::stop() {
        Ok(msg) => {
            let md = format_markdown(
                &[("type", "twin"), ("status", "stopped")],
                &format!("# Digital Twin Stopped\n\n{}", msg),
                &[("Start again", "twin_start()")],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => ToolCallResult {
            content: vec![ContentItem::Text { text: format!("Failed to stop twin: {}", e) }],
            is_error: Some(true),
        },
    }
}

fn exec_twin_alerts(args: &Value) -> ToolCallResult {
    let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
    let alerts = super::get_alerts(limit);

    if alerts.is_empty() {
        let md = format_markdown(
            &[("type", "twin_alerts"), ("count", "0")],
            "# No Alerts\n\nNo new alerts from the digital twin.",
            &[("Start twin", "twin_start()"), ("Check status", "twin_status()")],
        );
        return ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None };
    }

    let mut table = String::from("| # | Source | Priority | From | Subject | Time |\n|---|--------|----------|------|---------|------|\n");
    for (i, a) in alerts.iter().enumerate() {
        let subj = if a.title.len() > 40 { format!("{}...", &a.title[..37]) } else { a.title.clone() };
        let sender = if a.sender.len() > 25 { format!("{}...", &a.sender[..22]) } else { a.sender.clone() };
        table.push_str(&format!("| {} | {} | **{}** | {} | {} | {} |\n",
            i+1, a.source, a.priority, sender, subj, a.timestamp));
    }

    let high_count = alerts.iter().filter(|a| a.priority == "high").count();

    let md = format_markdown(
        &[("type", "twin_alerts"), ("count", &alerts.len().to_string()), ("high_priority", &high_count.to_string())],
        &format!("# Digital Twin Alerts\n\n**Total:** {} | **High priority:** {}\n\n{}", alerts.len(), high_count, table),
        &[("Check status", "twin_status()"), ("Stop twin", "twin_stop()")],
    );
    ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
}

fn exec_twin_status() -> ToolCallResult {
    let (running, count) = super::status();
    let status_str = if running { "running" } else { "stopped" };

    let md = format_markdown(
        &[("type", "twin_status"), ("status", status_str), ("alerts", &count.to_string())],
        &format!("# Digital Twin Status\n\n**Status:** {}\n**Alerts cached:** {}\n**Monitoring:** Mail (60s interval)",
            if running { "Running" } else { "Stopped" }, count),
        &[
            if running { ("Stop", "twin_stop()") } else { ("Start", "twin_start()") },
            ("View alerts", "twin_alerts()"),
        ],
    );
    ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
}

fn exec_twin_remember(args: &Value) -> ToolCallResult {
    let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
    if query.is_empty() {
        return ToolCallResult {
            content: vec![ContentItem::Text { text: "query is required".to_string() }],
            is_error: Some(true),
        };
    }

    let results = super::remember(query, 10);

    if results.is_empty() {
        let md = format_markdown(
            &[("type", "twin_remember"), ("query", query), ("results", "0")],
            &format!("# Twin Memory: {}\n\nNo memories found. I haven't learned about this yet.", query),
            &[("Teach me", &format!("twin_learn(topic: \"{}\", content: \"...\")", query))],
        );
        return ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None };
    }

    let mut body = format!("# Twin Memory: {}\n\nFound **{}** memories:\n\n", query, results.len());
    for r in &results {
        let preview = if r.chunk.content.len() > 300 { format!("{}...", &r.chunk.content[..297]) } else { r.chunk.content.clone() };
        body.push_str(&format!("### {} (score: {:.2})\n**Source:** `{}`\n\n{}\n\n---\n\n", r.chunk.title, r.score, r.chunk.source, preview));
    }

    let md = format_markdown(
        &[("type", "twin_remember"), ("query", query), ("results", &results.len().to_string())],
        &body,
        &[("Search more", "twin_remember(query: \"...\")"), ("Teach me", "twin_learn(topic: \"...\", content: \"...\")")],
    );
    ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
}

fn exec_twin_learn(args: &Value) -> ToolCallResult {
    let topic = args.get("topic").and_then(|v| v.as_str()).unwrap_or("");
    let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");

    if topic.is_empty() || content.is_empty() {
        return ToolCallResult {
            content: vec![ContentItem::Text { text: "topic and content are required".to_string() }],
            is_error: Some(true),
        };
    }

    match super::learn(topic, content) {
        Ok(()) => {
            let md = format_markdown(
                &[("type", "twin_learn"), ("topic", topic), ("status", "learned")],
                &format!("# Learned: {}\n\nI'll remember this:\n\n> {}", topic, content),
                &[("Recall", &format!("twin_remember(query: \"{}\")", topic)), ("Teach more", "twin_learn(topic: \"...\", content: \"...\")")],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => ToolCallResult {
            content: vec![ContentItem::Text { text: format!("Failed to learn: {}", e) }],
            is_error: Some(true),
        },
    }
}
