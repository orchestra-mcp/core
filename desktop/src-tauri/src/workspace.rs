// Orchestra Desktop — Workspace Manager (Rust Backend)
//
// Provides Tauri commands for scanning, searching, reading, renaming,
// and deleting markdown files within a workspace folder.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ─── Types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEntry {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub folder: String,
    pub file_type: String,
    pub size: u64,
    pub modified: String,
    pub preview: String,
    pub title: Option<String>,
    pub frontmatter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub file_type: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line: String,
    pub highlight_start: usize,
    pub highlight_end: usize,
}

// ─── File Type Detection ──────────────────────────────────────────

fn detect_file_type(path: &Path, filename: &str) -> String {
    let path_str = path.to_string_lossy().replace('\\', "/");
    let lower_name = filename.to_lowercase();

    // Check path-based patterns first
    if path_str.contains(".claude/agents/") || path_str.contains(".claude\\agents\\") {
        return "agent".to_string();
    }
    if path_str.contains(".claude/skills/") || path_str.contains(".claude\\skills\\") {
        return "skill".to_string();
    }
    if path_str.contains(".claude/rules/") || path_str.contains(".claude\\rules\\") {
        return "rule".to_string();
    }

    // Filename-based patterns
    if lower_name == "claude.md" {
        return "claude-md".to_string();
    }
    if lower_name == "readme.md" || lower_name == "readme.mdx" {
        return "readme".to_string();
    }

    // Path directory patterns
    if path_str.contains(".plans/") || path_str.contains("/plans/") || path_str.contains("\\plans\\") {
        return "plan".to_string();
    }
    if path_str.contains("/spec/") || path_str.contains("\\spec\\") {
        return "spec".to_string();
    }
    if path_str.contains("/docs/") || path_str.contains("\\docs\\") {
        return "doc".to_string();
    }

    "generic".to_string()
}

// ─── Content Parsing Helpers ──────────────────────────────────────

fn extract_title(content: &str) -> Option<String> {
    // Skip frontmatter if present
    let text = if content.trim_start().starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            &content[end + 7..]
        } else {
            content
        }
    } else {
        content
    };

    // Find first # heading
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return Some(trimmed[2..].trim().to_string());
        }
    }
    None
}

fn extract_frontmatter(content: &str) -> Option<String> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    if let Some(end) = trimmed[3..].find("\n---") {
        let yaml = trimmed[3..end + 3].trim();
        if !yaml.is_empty() {
            return Some(yaml.to_string());
        }
    }
    None
}

fn make_preview(content: &str, max_len: usize) -> String {
    // Skip frontmatter for the preview
    let text = if content.trim_start().starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            content[end + 7..].trim_start()
        } else {
            content
        }
    } else {
        content
    };

    // Collect up to max_len characters, collapsing whitespace
    let preview: String = text.chars().take(max_len).collect();
    preview.trim().to_string()
}

fn format_system_time(time: SystemTime) -> String {
    match time.duration_since(SystemTime::UNIX_EPOCH) {
        Ok(dur) => {
            let secs = dur.as_secs() as i64;
            // Format as ISO 8601 (simplified — no timezone library needed)
            let days = secs / 86400;
            let remaining = secs % 86400;
            let hours = remaining / 3600;
            let minutes = (remaining % 3600) / 60;
            let seconds = remaining % 60;

            // Calculate year/month/day from days since epoch
            // Using a simplified algorithm
            let (year, month, day) = days_to_ymd(days);
            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                year, month, day, hours, minutes, seconds
            )
        }
        Err(_) => "1970-01-01T00:00:00Z".to_string(),
    }
}

fn days_to_ymd(days_since_epoch: i64) -> (i64, i64, i64) {
    // Civil days to Y/M/D (Howard Hinnant's algorithm)
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

// ─── Recursive Scanner ────────────────────────────────────────────

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "mdx", "markdown"];

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | "vendor"
            | "__pycache__"
            | ".dart_tool"
            | ".pub-cache"
    )
}

fn scan_dir_recursive(dir: &Path, root: &Path, entries: &mut Vec<WorkspaceEntry>) {
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            let should_scan = (!should_skip_dir(&file_name) && !file_name.starts_with('.'))
                || file_name == ".claude"
                || file_name == ".plans"
                || file_name == ".requests";
            if should_scan {
                scan_dir_recursive(&path, root, entries);
            }
            continue;
        }

        if !is_markdown_file(&path) {
            continue;
        }

        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let content = fs::read_to_string(&path).unwrap_or_default();

        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| file_name.clone());

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let folder = path
            .parent()
            .and_then(|p| p.file_name())
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        let file_type = detect_file_type(&path, &file_name);

        let modified = metadata
            .modified()
            .map(format_system_time)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

        let title = extract_title(&content);
        let frontmatter = extract_frontmatter(&content);
        let preview = make_preview(&content, 200);

        entries.push(WorkspaceEntry {
            path: path.to_string_lossy().to_string(),
            name,
            relative_path: relative,
            folder,
            file_type,
            size: metadata.len(),
            modified,
            preview,
            title,
            frontmatter,
        });
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────

/// Recursively scan a folder for markdown files and return structured entries
#[tauri::command]
pub async fn scan_workspace(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();
    scan_dir_recursive(&root, &root, &mut entries);

    // Sort by file_type first, then by name
    entries.sort_by(|a, b| {
        let type_order = file_type_order(&a.file_type).cmp(&file_type_order(&b.file_type));
        if type_order != std::cmp::Ordering::Equal {
            type_order
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}

fn file_type_order(ft: &str) -> u8 {
    match ft {
        "claude-md" => 0,
        "agent" => 1,
        "skill" => 2,
        "rule" => 3,
        "plan" => 4,
        "spec" => 5,
        "doc" => 6,
        "readme" => 7,
        "note" => 8,
        "generic" => 9,
        _ => 10,
    }
}

/// Full-text search across all markdown files in a workspace
#[tauri::command]
pub async fn search_workspace(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let query_lower = query.to_lowercase();
    if query_lower.is_empty() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    scan_dir_recursive(&root, &root, &mut entries);

    let mut results = Vec::new();

    for entry in &entries {
        let mut matches = Vec::new();

        // Check filename match
        if entry.name.to_lowercase().contains(&query_lower) {
            matches.push(SearchMatch {
                line_number: 0,
                line: format!("Filename: {}", entry.name),
                highlight_start: entry.name.to_lowercase().find(&query_lower).unwrap_or(0) + 10,
                highlight_end: entry.name.to_lowercase().find(&query_lower).unwrap_or(0) + 10 + query.len(),
            });
        }

        // Read content and search lines
        if let Ok(content) = fs::read_to_string(&entry.path) {
            for (i, line) in content.lines().enumerate() {
                let line_lower = line.to_lowercase();
                if let Some(pos) = line_lower.find(&query_lower) {
                    matches.push(SearchMatch {
                        line_number: i + 1,
                        line: line.to_string(),
                        highlight_start: pos,
                        highlight_end: pos + query.len(),
                    });

                    // Limit matches per file to avoid huge payloads
                    if matches.len() >= 10 {
                        break;
                    }
                }
            }
        }

        if !matches.is_empty() {
            results.push(SearchResult {
                path: entry.path.clone(),
                name: entry.name.clone(),
                relative_path: entry.relative_path.clone(),
                file_type: entry.file_type.clone(),
                matches,
            });
        }
    }

    Ok(results)
}

/// Read the content of a file in the workspace
#[tauri::command]
pub async fn read_workspace_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Rename a file in the workspace
#[tauri::command]
pub async fn rename_workspace_file(old_path: String, new_path: String) -> Result<(), String> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);

    if !old.exists() {
        return Err(format!("File not found: {}", old_path));
    }
    if new.exists() {
        return Err(format!("Target already exists: {}", new_path));
    }

    fs::rename(&old, &new).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file in the workspace (moves to OS trash on macOS, permanent delete otherwise)
#[tauri::command]
pub async fn delete_workspace_file(path: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    if !file.exists() {
        return Err(format!("File not found: {}", path));
    }

    // On macOS, try to use the `trash` command via osascript for Trash support
    #[cfg(target_os = "macos")]
    {
        let result = std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "tell application \"Finder\" to delete POSIX file \"{}\"",
                    path.replace('"', "\\\"")
                ),
            ])
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            _ => {
                // Fall back to permanent deletion
                log::warn!("Trash failed, falling back to permanent delete for {}", path);
            }
        }
    }

    fs::remove_file(&file).map_err(|e| format!("Failed to delete: {}", e))
}
