// Digital Twin — Background Listener Agent
//
// A persistent background agent that monitors:
// - Mail (macOS Mail.app via AppleScript)
// - Notifications (macOS Notification Center)
// - Calendar events (EventKit)
//
// Saves alerts to local RAG + posts summaries to cloud MCP.
// Runs on Apple Intelligence or Ollama (free, local).

pub mod alerts;
pub mod dispatch;
pub mod listener;
pub mod ws_bridge;

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub source: String,      // mail, notification, calendar
    pub title: String,
    pub body: String,
    pub sender: String,
    pub timestamp: String,
    pub is_read: bool,
    pub priority: String,    // high, medium, low
}

/// Global twin state
static TWIN_RUNNING: AtomicBool = AtomicBool::new(false);

use std::sync::LazyLock;
static ALERTS: LazyLock<Arc<Mutex<Vec<Alert>>>> = LazyLock::new(|| Arc::new(Mutex::new(Vec::new())));

/// Start the digital twin background listener.
pub fn start() -> Result<String, String> {
    if TWIN_RUNNING.load(Ordering::SeqCst) {
        return Ok("Digital twin already running".to_string());
    }

    TWIN_RUNNING.store(true, Ordering::SeqCst);

    // Spawn background thread for mail checking
    std::thread::spawn(|| {
        loop {
            if !TWIN_RUNNING.load(Ordering::SeqCst) {
                break;
            }

            // Check for new mail
            if let Ok(new_alerts) = listener::check_mail() {
                let mut alerts = ALERTS.lock().unwrap();
                for alert in new_alerts {
                    // Avoid duplicates
                    if !alerts.iter().any(|a| a.id == alert.id) {
                        // Index into local RAG for memory
                        index_alert_to_rag(&alert);
                        alerts.push(alert);
                    }
                }
                // Keep last 100 alerts
                if alerts.len() > 100 {
                    let drain_count = alerts.len() - 100;
                    alerts.drain(0..drain_count);
                }
            }

            // Check every 60 seconds
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    });

    Ok("Digital twin started — monitoring mail every 60s".to_string())
}

/// Stop the digital twin.
pub fn stop() -> Result<String, String> {
    TWIN_RUNNING.store(false, Ordering::SeqCst);
    Ok("Digital twin stopped".to_string())
}

/// Get current alerts.
pub fn get_alerts(limit: usize) -> Vec<Alert> {
    let alerts = ALERTS.lock().unwrap();
    alerts.iter().rev().take(limit).cloned().collect()
}

/// Push a browser alert into the shared store (called from ws_bridge).
pub fn push_alert(alert: Alert) {
    let mut alerts = ALERTS.lock().unwrap();
    if !alerts.iter().any(|a| a.id == alert.id) {
        alerts.push(alert);
        if alerts.len() > 100 {
            let excess = alerts.len() - 100;
            alerts.drain(0..excess);
        }
    }
}

/// Get twin status.
pub fn status() -> (bool, usize) {
    let running = TWIN_RUNNING.load(Ordering::SeqCst);
    let count = ALERTS.lock().map(|a| a.len()).unwrap_or(0);
    (running, count)
}

/// Store an alert in local RAG for long-term memory.
fn index_alert_to_rag(alert: &Alert) {
    let config = crate::rag::RagConfig::default();
    if let Ok(store) = crate::rag::store::RagStore::open(config.clone()) {
        let content = format!(
            "From: {}\nSubject: {}\nPriority: {}\nTime: {}\n\n{}",
            alert.sender, alert.title, alert.priority, alert.timestamp, alert.body
        );
        let _ = crate::rag::indexer::index_text(
            &store,
            &config,
            &format!("twin/{}/{}", alert.source, alert.id),
            "message",
            &alert.title,
            &content,
            serde_json::json!({
                "source": alert.source,
                "sender": alert.sender,
                "priority": alert.priority,
            }),
        );
    }
}

/// Search twin's memory via RAG.
pub fn remember(query: &str, limit: usize) -> Vec<crate::rag::SearchResult> {
    let config = crate::rag::RagConfig::default();
    if let Ok(store) = crate::rag::store::RagStore::open(config) {
        crate::rag::query::search(&store, query, limit)
            .map(|(results, _)| results)
            .unwrap_or_default()
    } else {
        Vec::new()
    }
}

/// Store a learning/preference in RAG for future recall.
pub fn learn(topic: &str, content: &str) -> Result<(), String> {
    let config = crate::rag::RagConfig::default();
    let store = crate::rag::store::RagStore::open(config.clone())?;
    crate::rag::indexer::index_text(
        &store,
        &config,
        &format!("twin/learned/{}", topic),
        "memory",
        topic,
        content,
        serde_json::json!({"type": "learned", "topic": topic}),
    )?;
    Ok(())
}
