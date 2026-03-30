// RAG Query — search the local RAG index and format results

use super::store::RagStore;
use super::SearchResult;

/// Search the RAG index by text and return formatted markdown results.
pub fn search(store: &RagStore, query: &str, top_k: usize) -> Result<(Vec<SearchResult>, String), String> {
    let results = store.search_text(query, top_k)?;

    let md = format_results(query, &results);
    Ok((results, md))
}

/// Format search results as markdown.
fn format_results(query: &str, results: &[SearchResult]) -> String {
    if results.is_empty() {
        return format!("No results found for: **{}**", query);
    }

    let mut md = String::new();
    md.push_str(&format!("---\ntype: rag_search\nquery: \"{}\"\nresults: {}\n---\n\n", query, results.len()));
    md.push_str(&format!("# RAG Search: {}\n\n", query));
    md.push_str(&format!("Found **{}** relevant chunks:\n\n", results.len()));

    for r in results {
        let preview = if r.chunk.content.len() > 200 {
            format!("{}...", &r.chunk.content[..200])
        } else {
            r.chunk.content.clone()
        };

        md.push_str(&format!(
            "### {}. {} (score: {:.2})\n**Source:** `{}` ({})\n\n{}\n\n---\n\n",
            r.rank,
            r.chunk.title,
            r.score,
            r.chunk.source,
            r.chunk.source_type,
            preview,
        ));
    }

    md.push_str("## Next Steps\n");
    md.push_str(&format!("- **Refine search:** `rag_search(query: \"more specific terms\")`\n"));
    md.push_str("- **Index more files:** `rag_index(path: \"/path/to/dir\")`\n");
    md.push_str("- **View full chunk:** `rag_get(chunk_id: \"...\")`\n");

    md
}
