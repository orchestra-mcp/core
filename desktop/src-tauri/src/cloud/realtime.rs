use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Supabase Realtime client.
///
/// Connects to the Supabase Realtime WebSocket endpoint and subscribes
/// to Postgres changes on individual tables.
pub struct SupabaseRealtime {
    url: String,
    key: String,
    /// Optional bearer token for RLS-aware channels.
    access_token: Option<String>,
}

/// A single change event received from the Realtime channel.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RealtimeEvent {
    /// Table that was modified.
    pub table: String,
    /// One of `INSERT`, `UPDATE`, or `DELETE`.
    pub event_type: String,
    /// New row data (empty object for DELETE).
    pub new: serde_json::Value,
    /// Old row data (empty object for INSERT).
    pub old: serde_json::Value,
}

/// Internal: top-level message frame from Realtime WS.
#[derive(Deserialize)]
struct RealtimeMessage {
    #[serde(default)]
    event: String,
    #[serde(default)]
    payload: serde_json::Value,
    #[serde(default)]
    topic: String,
    #[serde(rename = "ref")]
    #[serde(default)]
    msg_ref: Option<String>,
}

/// Internal: the `payload.record` / `payload.old_record` shape inside
/// a postgres_changes event.
#[derive(Deserialize)]
struct PostgresChangePayload {
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    table: String,
    #[serde(default)]
    schema: String,
    #[serde(default)]
    record: serde_json::Value,
    #[serde(default)]
    old_record: serde_json::Value,
}

impl SupabaseRealtime {
    /// Create a new Realtime client.
    ///
    /// * `url` - Supabase project URL (e.g. `https://xyz.supabase.co`)
    /// * `key` - Supabase API key
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            key: key.to_string(),
            access_token: None,
        }
    }

    /// Set a user access token for RLS-aware subscriptions.
    pub fn set_access_token(&mut self, token: &str) {
        self.access_token = Some(token.to_string());
    }

    /// Subscribe to INSERT / UPDATE / DELETE events on `table`.
    ///
    /// The provided `callback` is invoked for every matching event.
    /// This method spawns a background tokio task and returns immediately.
    /// The returned `tokio::task::JoinHandle` can be used to cancel (abort)
    /// the subscription.
    ///
    /// * `table`    - Postgres table name to watch.
    /// * `schema`   - Schema name (typically `"public"`).
    /// * `callback` - Closure called with each `RealtimeEvent`.
    pub async fn subscribe<F>(
        &self,
        table: &str,
        schema: &str,
        callback: F,
    ) -> Result<tokio::task::JoinHandle<()>, String>
    where
        F: Fn(RealtimeEvent) + Send + 'static,
    {
        // Build WebSocket URL.
        // Supabase Realtime v2 endpoint:
        //   wss://<host>/realtime/v1/websocket?apikey=<key>&vsn=1.0.0
        let ws_url = {
            let base = self
                .url
                .replace("https://", "wss://")
                .replace("http://", "ws://");
            format!("{base}/realtime/v1/websocket?apikey={}&vsn=1.0.0", self.key)
        };

        let (ws_stream, _response) = connect_async(&ws_url)
            .await
            .map_err(|e| format!("realtime: WebSocket connection failed: {e}"))?;

        let (mut write, mut read) = ws_stream.split();

        let topic = format!("realtime:public:{table}");
        let token = self
            .access_token
            .clone()
            .unwrap_or_else(|| self.key.clone());

        // Send Phoenix-style join message for the channel.
        let join_msg = json!({
            "topic": topic,
            "event": "phx_join",
            "payload": {
                "config": {
                    "postgres_changes": [
                        {
                            "event": "*",
                            "schema": schema,
                            "table": table
                        }
                    ]
                },
                "access_token": token
            },
            "ref": "1"
        });

        write
            .send(Message::Text(join_msg.to_string()))
            .await
            .map_err(|e| format!("realtime: failed to send join: {e}"))?;

        // Spawn reader loop in the background.
        let topic_clone = topic.clone();
        let handle = tokio::spawn(async move {
            // Heartbeat interval — Phoenix expects a heartbeat every 30s.
            let mut heartbeat_interval = tokio::time::interval(std::time::Duration::from_secs(30));
            let mut heartbeat_ref: u64 = 100;

            loop {
                tokio::select! {
                    // Incoming message from the server.
                    msg = read.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                if let Ok(frame) = serde_json::from_str::<RealtimeMessage>(&text) {
                                    // We only care about postgres_changes events on our topic.
                                    if frame.topic == topic_clone
                                        && frame.event == "postgres_changes"
                                    {
                                        if let Ok(change) = serde_json::from_value::<PostgresChangePayload>(frame.payload.clone()) {
                                            let event = RealtimeEvent {
                                                table: change.table,
                                                event_type: change.r#type,
                                                new: change.record,
                                                old: change.old_record,
                                            };
                                            callback(event);
                                        }
                                    }
                                    // Also handle the nested "data" wrapper some versions use.
                                    if frame.topic == topic_clone
                                        && frame.event == "system"
                                    {
                                        // system events (e.g. subscription confirmation) — ignored.
                                    }
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => {
                                // Connection closed.
                                break;
                            }
                            Some(Err(e)) => {
                                eprintln!("realtime: read error: {e}");
                                break;
                            }
                            _ => {
                                // Binary / Ping / Pong — ignore.
                            }
                        }
                    }

                    // Send periodic heartbeat to keep the connection alive.
                    _ = heartbeat_interval.tick() => {
                        heartbeat_ref += 1;
                        let hb = json!({
                            "topic": "phoenix",
                            "event": "heartbeat",
                            "payload": {},
                            "ref": heartbeat_ref.to_string()
                        });
                        if write.send(Message::Text(hb.to_string())).await.is_err() {
                            break;
                        }
                    }
                }
            }
        });

        Ok(handle)
    }
}
