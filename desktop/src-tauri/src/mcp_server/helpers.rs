// MCP Server — Markdown response formatting helpers
//
// Provides a consistent YAML-frontmatter + Markdown body + Next Steps
// format for all tool responses, replacing raw JSON text output.

/// Build a Markdown string with YAML frontmatter, a body, and optional next steps.
///
/// ```text
/// ---
/// tool: screen_scan
/// status: ok
/// ---
///
/// ## Displays
/// | id | size | main |
/// ...
///
/// ---
///
/// ## Next Steps
/// - **Interact with a window:** `screen_action`
/// ```
pub fn format_markdown(
    frontmatter: &[(&str, &str)],
    body: &str,
    next_steps: &[(&str, &str)],
) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_markdown_basic() {
        let result = format_markdown(
            &[("tool", "test"), ("status", "ok")],
            "Hello world",
            &[("Do something", "some_tool")],
        );
        assert!(result.starts_with("---\n"));
        assert!(result.contains("tool: test\n"));
        assert!(result.contains("status: ok\n"));
        assert!(result.contains("Hello world"));
        assert!(result.contains("## Next Steps"));
        assert!(result.contains("- **Do something:** `some_tool`"));
    }

    #[test]
    fn test_format_markdown_no_next_steps() {
        let result = format_markdown(
            &[("tool", "test")],
            "Body only",
            &[],
        );
        assert!(result.contains("Body only"));
        assert!(!result.contains("## Next Steps"));
    }
}
