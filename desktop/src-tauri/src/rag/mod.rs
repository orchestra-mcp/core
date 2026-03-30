// Local RAG System — Embedded Vector Search
//
// Uses LanceDB for vector storage and semantic search.
// All data stored locally at ~/.orchestra/rag/
//
// Architecture:
// 1. INDEX — chunk documents, generate embeddings, store in LanceDB
// 2. QUERY — embed query, search for similar chunks, return context
// 3. SOURCES — workspace files, meeting transcripts, task comments, messages
//
// Embedding generation uses the cloud MCP server's embedding endpoint
// or a local model via candle (future).

pub mod store;
pub mod indexer;
pub mod query;

use serde::{Deserialize, Serialize};

/// A document chunk stored in the RAG index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    /// Unique ID for this chunk
    pub id: String,
    /// Source file path or entity reference
    pub source: String,
    /// Source type: file, meeting, task, message, decision
    pub source_type: String,
    /// The text content of this chunk
    pub content: String,
    /// Title or heading context
    pub title: String,
    /// Metadata (tags, dates, agent, project)
    pub metadata: serde_json::Value,
    /// Timestamp when indexed
    pub indexed_at: String,
}

/// A search result from the RAG index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub chunk: Chunk,
    pub score: f32,
    pub rank: usize,
}

/// RAG configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagConfig {
    /// Path to the RAG data directory (default: ~/.orchestra/rag/)
    pub data_dir: String,
    /// Maximum chunk size in characters
    pub chunk_size: usize,
    /// Overlap between chunks in characters
    pub chunk_overlap: usize,
    /// Number of results to return from search
    pub top_k: usize,
}

impl Default for RagConfig {
    fn default() -> Self {
        let data_dir = dirs::home_dir()
            .map(|h| h.join(".orchestra").join("rag"))
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp/orchestra-rag"))
            .to_string_lossy()
            .to_string();

        Self {
            data_dir,
            chunk_size: 1000,
            chunk_overlap: 200,
            top_k: 10,
        }
    }
}
