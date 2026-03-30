// RAG Indexer — chunks documents and stores in the RAG store
//
// Supports: markdown files, code files, plain text
// Chunking: sliding window with configurable size and overlap

use std::path::Path;
use uuid::Uuid;

use super::{Chunk, RagConfig};
use super::store::RagStore;

/// Index a file from the filesystem.
pub fn index_file(store: &RagStore, config: &RagConfig, file_path: &str, source_type: &str) -> Result<usize, String> {
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", file_path, e))?;

    let title = Path::new(file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    // Delete existing chunks for this source
    store.delete_source(file_path)?;

    // Chunk the content
    let chunks = chunk_text(&content, config.chunk_size, config.chunk_overlap);

    let now = chrono_now();
    let mut count = 0;

    for (i, chunk_text) in chunks.iter().enumerate() {
        let chunk = Chunk {
            id: Uuid::new_v4().to_string(),
            source: file_path.to_string(),
            source_type: source_type.to_string(),
            content: chunk_text.clone(),
            title: if i == 0 { title.clone() } else { format!("{} (part {})", title, i + 1) },
            metadata: serde_json::json!({
                "chunk_index": i,
                "total_chunks": chunks.len(),
                "file_path": file_path,
            }),
            indexed_at: now.clone(),
        };

        // Store without embedding for now (text search only)
        // Embeddings can be added later via a separate pass
        store.insert(&chunk, None)?;
        count += 1;
    }

    Ok(count)
}

/// Index a text blob directly (for meeting transcripts, task comments, etc.)
pub fn index_text(
    store: &RagStore,
    config: &RagConfig,
    source: &str,
    source_type: &str,
    title: &str,
    content: &str,
    metadata: serde_json::Value,
) -> Result<usize, String> {
    // Delete existing chunks for this source
    store.delete_source(source)?;

    let chunks = chunk_text(content, config.chunk_size, config.chunk_overlap);
    let now = chrono_now();
    let mut count = 0;

    for (i, chunk_text) in chunks.iter().enumerate() {
        let chunk = Chunk {
            id: Uuid::new_v4().to_string(),
            source: source.to_string(),
            source_type: source_type.to_string(),
            content: chunk_text.clone(),
            title: if i == 0 { title.to_string() } else { format!("{} (part {})", title, i + 1) },
            metadata: metadata.clone(),
            indexed_at: now.clone(),
        };

        store.insert(&chunk, None)?;
        count += 1;
    }

    Ok(count)
}

/// Index all markdown/code files in a directory recursively.
pub fn index_directory(store: &RagStore, config: &RagConfig, dir_path: &str) -> Result<usize, String> {
    let mut total = 0;

    let entries = walkdir(dir_path)?;
    for entry in entries {
        let ext = Path::new(&entry)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let source_type = match ext.as_str() {
            "md" | "mdx" => "markdown",
            "go" | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "php" | "rb" => "code",
            "yaml" | "yml" | "toml" | "json" => "config",
            "sql" => "migration",
            "txt" => "text",
            _ => continue, // skip unsupported files
        };

        match index_file(store, config, &entry, source_type) {
            Ok(count) => total += count,
            Err(e) => log::warn!("Failed to index {}: {}", entry, e),
        }
    }

    Ok(total)
}

/// Split text into chunks with sliding window.
fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    if text.len() <= chunk_size {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut start = 0;

    while start < chars.len() {
        let end = (start + chunk_size).min(chars.len());
        let chunk: String = chars[start..end].iter().collect();

        // Try to break at a paragraph or sentence boundary
        let chunk = if end < chars.len() {
            if let Some(break_pos) = chunk.rfind("\n\n") {
                if break_pos > chunk_size / 2 {
                    chars[start..start + break_pos + 2].iter().collect()
                } else {
                    chunk
                }
            } else if let Some(break_pos) = chunk.rfind(". ") {
                if break_pos > chunk_size / 2 {
                    chars[start..start + break_pos + 2].iter().collect()
                } else {
                    chunk
                }
            } else {
                chunk
            }
        } else {
            chunk
        };

        let chunk_len = chunk.chars().count();
        chunks.push(chunk);

        if start + chunk_len >= chars.len() {
            break;
        }

        start += chunk_len.saturating_sub(overlap);
    }

    chunks
}

/// Recursively list files in a directory.
fn walkdir(dir: &str) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let dir_path = Path::new(dir);

    if !dir_path.is_dir() {
        return Err(format!("{} is not a directory", dir));
    }

    fn visit(path: &Path, files: &mut Vec<String>) {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

                // Skip hidden dirs, node_modules, vendor, target, .git
                if name.starts_with('.') || name == "node_modules" || name == "vendor"
                    || name == "target" || name == "dist" || name == "build" {
                    continue;
                }

                if p.is_dir() {
                    visit(&p, files);
                } else if p.is_file() {
                    files.push(p.to_string_lossy().to_string());
                }
            }
        }
    }

    visit(dir_path, &mut files);
    Ok(files)
}

/// Simple ISO timestamp without chrono dependency.
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    // Rough ISO format
    format!("{}", secs)
}
