// RAG Store — SQLite-based vector storage
//
// Uses SQLite with a simple embedding table instead of LanceDB
// to avoid heavy dependencies. Vector similarity computed in Rust.
//
// This is a lightweight alternative that works embedded in Tauri
// without external processes or large binary deps.

use rusqlite::{Connection, params};
use serde_json;
use std::path::Path;
use std::sync::Mutex;

use super::{Chunk, RagConfig, SearchResult};

/// The RAG store backed by SQLite.
pub struct RagStore {
    conn: Mutex<Connection>,
    #[allow(dead_code)]
    config: RagConfig,
}

impl RagStore {
    /// Open or create the RAG database.
    pub fn open(config: RagConfig) -> Result<Self, String> {
        // Ensure data directory exists
        let data_dir = Path::new(&config.data_dir);
        std::fs::create_dir_all(data_dir)
            .map_err(|e| format!("Failed to create RAG dir: {}", e))?;

        let db_path = data_dir.join("rag.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open RAG DB: {}", e))?;

        // Create tables
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                source_type TEXT NOT NULL,
                content TEXT NOT NULL,
                title TEXT DEFAULT '',
                metadata TEXT DEFAULT '{}',
                embedding BLOB,
                indexed_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
            CREATE INDEX IF NOT EXISTS idx_chunks_source_type ON chunks(source_type);

            CREATE TABLE IF NOT EXISTS rag_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        ").map_err(|e| format!("Failed to create tables: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
            config,
        })
    }

    /// Insert a chunk with its embedding vector.
    pub fn insert(&self, chunk: &Chunk, embedding: Option<&[f32]>) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let embedding_blob: Option<Vec<u8>> = embedding.map(|emb| {
            emb.iter().flat_map(|f| f.to_le_bytes()).collect()
        });

        let metadata_str = serde_json::to_string(&chunk.metadata).unwrap_or_default();

        conn.execute(
            "INSERT OR REPLACE INTO chunks (id, source, source_type, content, title, metadata, embedding, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                chunk.id,
                chunk.source,
                chunk.source_type,
                chunk.content,
                chunk.title,
                metadata_str,
                embedding_blob,
                chunk.indexed_at,
            ],
        ).map_err(|e| format!("Insert failed: {}", e))?;

        Ok(())
    }

    /// Search by text (keyword match using FTS-like LIKE queries).
    pub fn search_text(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let pattern = format!("%{}%", query.to_lowercase());
        let mut stmt = conn.prepare(
            "SELECT id, source, source_type, content, title, metadata, indexed_at
             FROM chunks
             WHERE LOWER(content) LIKE ?1 OR LOWER(title) LIKE ?1
             ORDER BY indexed_at DESC
             LIMIT ?2"
        ).map_err(|e| format!("Query prepare failed: {}", e))?;

        let results = stmt.query_map(params![pattern, limit as i64], |row| {
            Ok(SearchResult {
                chunk: Chunk {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    source_type: row.get(2)?,
                    content: row.get(3)?,
                    title: row.get(4)?,
                    metadata: serde_json::from_str(&row.get::<_, String>(5).unwrap_or_default())
                        .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                    indexed_at: row.get(6)?,
                },
                score: 1.0,
                rank: 0,
            })
        }).map_err(|e| format!("Query failed: {}", e))?;

        let mut search_results: Vec<SearchResult> = Vec::new();
        for (i, r) in results.enumerate() {
            if let Ok(mut sr) = r {
                sr.rank = i + 1;
                search_results.push(sr);
            }
        }

        Ok(search_results)
    }

    /// Search by vector similarity (cosine distance).
    pub fn search_vector(&self, query_embedding: &[f32], limit: usize) -> Result<Vec<SearchResult>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        // Load all chunks with embeddings and compute cosine similarity in Rust
        let mut stmt = conn.prepare(
            "SELECT id, source, source_type, content, title, metadata, embedding, indexed_at
             FROM chunks
             WHERE embedding IS NOT NULL"
        ).map_err(|e| format!("Query prepare failed: {}", e))?;

        let mut scored: Vec<(f32, Chunk)> = Vec::new();

        let rows = stmt.query_map([], |row| {
            let embedding_blob: Vec<u8> = row.get(6)?;
            let chunk = Chunk {
                id: row.get(0)?,
                source: row.get(1)?,
                source_type: row.get(2)?,
                content: row.get(3)?,
                title: row.get(4)?,
                metadata: serde_json::from_str(&row.get::<_, String>(5).unwrap_or_default())
                    .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                indexed_at: row.get(7)?,
            };
            Ok((embedding_blob, chunk))
        }).map_err(|e| format!("Query failed: {}", e))?;

        for r in rows {
            if let Ok((blob, chunk)) = r {
                let stored_emb = bytes_to_f32(&blob);
                let score = cosine_similarity(query_embedding, &stored_emb);
                scored.push((score, chunk));
            }
        }

        // Sort by score descending
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<SearchResult> = scored
            .into_iter()
            .take(limit)
            .enumerate()
            .map(|(i, (score, chunk))| SearchResult {
                chunk,
                score,
                rank: i + 1,
            })
            .collect();

        Ok(results)
    }

    /// Delete all chunks from a source.
    pub fn delete_source(&self, source: &str) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count = conn.execute("DELETE FROM chunks WHERE source = ?1", params![source])
            .map_err(|e| format!("Delete failed: {}", e))?;
        Ok(count)
    }

    /// Get total chunk count.
    pub fn count(&self) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
            .map_err(|e| format!("Count failed: {}", e))?;
        Ok(count as usize)
    }

    /// List indexed sources.
    pub fn list_sources(&self) -> Result<Vec<(String, String, usize)>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT source, source_type, COUNT(*) as chunk_count
             FROM chunks GROUP BY source, source_type ORDER BY chunk_count DESC"
        ).map_err(|e| format!("Query failed: {}", e))?;

        let results = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)? as usize))
        }).map_err(|e| format!("Query failed: {}", e))?;

        results.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Collect failed: {}", e))
    }
}

/// Convert byte slice to f32 vector.
fn bytes_to_f32(bytes: &[u8]) -> Vec<f32> {
    bytes.chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

/// Compute cosine similarity between two vectors.
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}
