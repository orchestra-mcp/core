// Orchestra Desktop — Cloud-Desktop Tunnel (Spec 6)
//
// Reverse WebSocket tunnel that connects the desktop app to the cloud gateway.
// The local machine dials outbound to the gateway, and the gateway relays
// browser traffic through this connection.
//
// Architecture matches the Go plugin-tunnel reference implementation:
// - TunnelClient: WebSocket connection lifecycle + message relay
// - ReconnectConfig: Exponential backoff with jitter
// - auto_register: HTTP POST to obtain tunnel credentials

pub mod reconnect;
pub mod register;
pub mod types;

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{mpsc, Mutex, Notify};
use tokio_tungstenite::tungstenite::Message;

use types::{ConnectionStats, ReconnectConfig, RelayEnvelope, TunnelConfig};

/// Callback type for incoming relay envelopes from the gateway.
pub type MessageHandler = Box<dyn Fn(RelayEnvelope) -> Option<RelayEnvelope> + Send + Sync>;

/// TunnelClient manages a WebSocket connection to the gateway's reverse tunnel
/// endpoint. It handles reading relay envelopes, writing responses, reconnection,
/// and connection lifecycle.
pub struct TunnelClient {
    config: TunnelConfig,
    reconnect_config: ReconnectConfig,
    on_message: Option<Arc<MessageHandler>>,

    // Internal state (all behind Arc<Mutex<>> for thread-safe async access)
    state: Arc<Mutex<TunnelState>>,

    // Channel for sending outbound messages
    tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,

    // Shutdown signal
    shutdown: Arc<Notify>,
}

struct TunnelState {
    connected: bool,
    connected_at: Option<Instant>,
    last_ping_at: Option<Instant>,
    messages_in: u64,
    messages_out: u64,
    reconnect_attempts: u32,
    last_error: Option<String>,
}

impl TunnelState {
    fn new() -> Self {
        Self {
            connected: false,
            connected_at: None,
            last_ping_at: None,
            messages_in: 0,
            messages_out: 0,
            reconnect_attempts: 0,
            last_error: None,
        }
    }
}

impl TunnelClient {
    /// Create a new TunnelClient with the given configuration.
    pub fn new(config: TunnelConfig) -> Self {
        Self {
            config,
            reconnect_config: ReconnectConfig::default(),
            on_message: None,
            state: Arc::new(Mutex::new(TunnelState::new())),
            tx: Arc::new(Mutex::new(None)),
            shutdown: Arc::new(Notify::new()),
        }
    }

    /// Set the reconnection configuration.
    pub fn with_reconnect_config(mut self, config: ReconnectConfig) -> Self {
        self.reconnect_config = config;
        self
    }

    /// Set the message handler for incoming relay envelopes.
    pub fn with_message_handler<F>(mut self, handler: F) -> Self
    where
        F: Fn(RelayEnvelope) -> Option<RelayEnvelope> + Send + Sync + 'static,
    {
        self.on_message = Some(Arc::new(Box::new(handler)));
        self
    }

    /// Establish the WebSocket connection to the gateway. If auto_reconnect is
    /// enabled, disconnections will trigger automatic reconnection with backoff.
    pub async fn connect(&self) -> Result<(), String> {
        // Check if already connected
        {
            let state = self.state.lock().await;
            if state.connected {
                return Err("already connected".to_string());
            }
        }

        self.connect_inner().await?;

        // If auto-reconnect is enabled, spawn the reconnection monitor
        if self.config.auto_reconnect {
            self.spawn_reconnect_loop();
        }

        Ok(())
    }

    /// Internal connect that establishes the WebSocket connection and starts
    /// the read/write loops.
    async fn connect_inner(&self) -> Result<(), String> {
        let url = format!(
            "{}?tunnel_id={}&connection_token={}",
            self.config.gateway_url, self.config.tunnel_id, self.config.connection_token
        );

        log::info!(
            "[tunnel] connecting to {} (tunnel: {})",
            self.config.gateway_url,
            self.config.tunnel_id
        );

        let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
            .await
            .map_err(|e| format!("websocket dial: {}", e))?;

        let (mut write, mut read) = ws_stream.split();

        // Create message channel for outbound messages
        let (sender, mut receiver) = mpsc::channel::<String>(256);

        {
            let mut tx_guard = self.tx.lock().await;
            *tx_guard = Some(sender);
        }

        // Mark as connected
        {
            let mut state = self.state.lock().await;
            state.connected = true;
            state.connected_at = Some(Instant::now());
            state.reconnect_attempts = 0;
            state.last_error = None;
        }

        log::info!(
            "[tunnel] connected to {} (tunnel: {})",
            self.config.gateway_url,
            self.config.tunnel_id
        );

        let state = Arc::clone(&self.state);
        let shutdown = Arc::clone(&self.shutdown);
        let on_message = self.on_message.clone();
        let tx_for_response = Arc::clone(&self.tx);

        // Spawn the write loop — sends outbound messages from the channel
        let write_state = Arc::clone(&self.state);
        let write_shutdown = Arc::clone(&self.shutdown);
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = write_shutdown.notified() => {
                        // Send close frame
                        let _ = write.send(Message::Close(None)).await;
                        break;
                    }
                    msg = receiver.recv() => {
                        match msg {
                            Some(text) => {
                                if let Err(e) = write.send(Message::Text(text.into())).await {
                                    log::error!("[tunnel] write error: {}", e);
                                    break;
                                }
                                let mut s = write_state.lock().await;
                                s.messages_out += 1;
                            }
                            None => break, // channel closed
                        }
                    }
                }
            }
        });

        // Spawn the read loop — reads relay envelopes and dispatches them
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = shutdown.notified() => {
                        break;
                    }
                    msg = read.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                {
                                    let mut s = state.lock().await;
                                    s.messages_in += 1;
                                }

                                if let Some(ref handler) = on_message {
                                    match serde_json::from_str::<RelayEnvelope>(&text) {
                                        Ok(envelope) => {
                                            if let Some(response) = handler(envelope) {
                                                if let Ok(json) = serde_json::to_string(&response) {
                                                    let tx_guard = tx_for_response.lock().await;
                                                    if let Some(ref tx) = *tx_guard {
                                                        let _ = tx.send(json).await;
                                                    }
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            log::warn!("[tunnel] invalid envelope: {}", e);
                                        }
                                    }
                                }
                            }
                            Some(Ok(Message::Ping(data))) => {
                                let mut s = state.lock().await;
                                s.last_ping_at = Some(Instant::now());
                                // Pong is sent automatically by tungstenite
                                drop(s);
                                let _ = data; // acknowledge
                            }
                            Some(Ok(Message::Close(_))) => {
                                log::info!("[tunnel] received close frame");
                                break;
                            }
                            Some(Err(e)) => {
                                log::error!("[tunnel] read error: {}", e);
                                let mut s = state.lock().await;
                                s.last_error = Some(format!("{}", e));
                                break;
                            }
                            None => {
                                log::info!("[tunnel] stream ended");
                                break;
                            }
                            _ => {} // Binary, Pong, Frame — ignore
                        }
                    }
                }
            }

            // Mark as disconnected
            let mut s = state.lock().await;
            s.connected = false;
            log::info!("[tunnel] disconnected");
        });

        Ok(())
    }

    /// Spawn the reconnection loop that watches for disconnections and retries.
    fn spawn_reconnect_loop(&self) {
        let state = Arc::clone(&self.state);
        let config = self.config.clone();
        let reconnect_config = self.reconnect_config.clone();
        let shutdown = Arc::clone(&self.shutdown);
        let tx = Arc::clone(&self.tx);
        let on_message = self.on_message.clone();

        tokio::spawn(async move {
            // Wait a bit for initial connection to settle
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            loop {
                // Check if we should keep running
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;

                let is_connected = {
                    let s = state.lock().await;
                    s.connected
                };

                if is_connected {
                    continue;
                }

                // Connection lost — start reconnection attempts
                let mut attempt: u32 = 0;
                loop {
                    attempt += 1;

                    if reconnect::should_give_up(&reconnect_config, attempt) {
                        log::error!(
                            "[tunnel-reconnect] gave up after {} attempts",
                            attempt - 1
                        );
                        return;
                    }

                    let delay = reconnect::calculate_delay(&reconnect_config, attempt);
                    log::info!(
                        "[tunnel-reconnect] attempt {} in {:?}",
                        attempt,
                        delay
                    );

                    {
                        let mut s = state.lock().await;
                        s.reconnect_attempts = attempt;
                    }

                    tokio::time::sleep(delay).await;

                    // Attempt to reconnect
                    let url = format!(
                        "{}?tunnel_id={}&connection_token={}",
                        config.gateway_url, config.tunnel_id, config.connection_token
                    );

                    match tokio_tungstenite::connect_async(&url).await {
                        Ok((ws_stream, _)) => {
                            let (mut write, mut read) = ws_stream.split();
                            let (sender, mut receiver) = mpsc::channel::<String>(256);

                            {
                                let mut tx_guard = tx.lock().await;
                                *tx_guard = Some(sender);
                            }

                            {
                                let mut s = state.lock().await;
                                s.connected = true;
                                s.connected_at = Some(Instant::now());
                                s.reconnect_attempts = 0;
                                s.last_error = None;
                            }

                            log::info!(
                                "[tunnel-reconnect] reconnected after {} attempts",
                                attempt
                            );

                            // Spawn write loop
                            let write_state = Arc::clone(&state);
                            let write_shutdown = Arc::clone(&shutdown);
                            tokio::spawn(async move {
                                loop {
                                    tokio::select! {
                                        _ = write_shutdown.notified() => {
                                            let _ = write.send(Message::Close(None)).await;
                                            break;
                                        }
                                        msg = receiver.recv() => {
                                            match msg {
                                                Some(text) => {
                                                    if let Err(e) = write.send(Message::Text(text.into())).await {
                                                        log::error!("[tunnel] write error: {}", e);
                                                        break;
                                                    }
                                                    let mut s = write_state.lock().await;
                                                    s.messages_out += 1;
                                                }
                                                None => break,
                                            }
                                        }
                                    }
                                }
                            });

                            // Spawn read loop
                            let read_state = Arc::clone(&state);
                            let read_shutdown = Arc::clone(&shutdown);
                            let read_on_message = on_message.clone();
                            let read_tx = Arc::clone(&tx);
                            tokio::spawn(async move {
                                loop {
                                    tokio::select! {
                                        _ = read_shutdown.notified() => break,
                                        msg = read.next() => {
                                            match msg {
                                                Some(Ok(Message::Text(text))) => {
                                                    {
                                                        let mut s = read_state.lock().await;
                                                        s.messages_in += 1;
                                                    }
                                                    if let Some(ref handler) = read_on_message {
                                                        if let Ok(envelope) = serde_json::from_str::<RelayEnvelope>(&text) {
                                                            if let Some(response) = handler(envelope) {
                                                                if let Ok(json) = serde_json::to_string(&response) {
                                                                    let tx_guard = read_tx.lock().await;
                                                                    if let Some(ref tx) = *tx_guard {
                                                                        let _ = tx.send(json).await;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                Some(Ok(Message::Ping(_))) => {
                                                    let mut s = read_state.lock().await;
                                                    s.last_ping_at = Some(Instant::now());
                                                }
                                                Some(Ok(Message::Close(_))) | None => break,
                                                Some(Err(e)) => {
                                                    let mut s = read_state.lock().await;
                                                    s.last_error = Some(format!("{}", e));
                                                    break;
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                }
                                let mut s = read_state.lock().await;
                                s.connected = false;
                            });

                            break; // Exit reconnection loop, outer loop will monitor
                        }
                        Err(e) => {
                            log::warn!(
                                "[tunnel-reconnect] attempt {} failed: {}",
                                attempt,
                                e
                            );
                            let mut s = state.lock().await;
                            s.last_error = Some(format!("{}", e));
                        }
                    }
                }
            }
        });
    }

    /// Close the WebSocket connection gracefully.
    pub async fn disconnect(&self) {
        self.shutdown.notify_waiters();

        {
            let mut tx_guard = self.tx.lock().await;
            *tx_guard = None;
        }

        {
            let mut state = self.state.lock().await;
            state.connected = false;
        }

        log::info!("[tunnel] disconnect requested");
    }

    /// Send a relay envelope through the WebSocket connection.
    pub async fn send_envelope(&self, envelope: RelayEnvelope) -> Result<(), String> {
        let json =
            serde_json::to_string(&envelope).map_err(|e| format!("serialize envelope: {}", e))?;

        let tx_guard = self.tx.lock().await;
        match &*tx_guard {
            Some(tx) => tx
                .send(json)
                .await
                .map_err(|e| format!("send envelope: {}", e)),
            None => Err("not connected".to_string()),
        }
    }

    /// Check if the tunnel is currently connected.
    pub async fn is_connected(&self) -> bool {
        let state = self.state.lock().await;
        state.connected
    }

    /// Get connection statistics.
    pub async fn stats(&self) -> ConnectionStats {
        let state = self.state.lock().await;
        let now = Instant::now();

        ConnectionStats {
            connected: state.connected,
            connected_at: state.connected_at.map(|t| {
                let elapsed = now.duration_since(t);
                let dt = chrono_from_elapsed(elapsed);
                dt
            }),
            uptime_seconds: state
                .connected_at
                .filter(|_| state.connected)
                .map(|t| now.duration_since(t).as_secs_f64()),
            last_ping_at: state.last_ping_at.map(|t| {
                let elapsed = now.duration_since(t);
                chrono_from_elapsed(elapsed)
            }),
            messages_in: state.messages_in,
            messages_out: state.messages_out,
            reconnect_attempts: state.reconnect_attempts,
            last_error: state.last_error.clone(),
            tunnel_id: Some(self.config.tunnel_id.clone()),
            gateway_url: Some(self.config.gateway_url.clone()),
        }
    }
}

/// Convert an elapsed duration to an approximate ISO-like timestamp string.
fn chrono_from_elapsed(elapsed: std::time::Duration) -> String {
    format!("{:.1}s ago", elapsed.as_secs_f64())
}

/// Global tunnel client singleton for Tauri commands.
///
/// Using a static to share state between Tauri commands. The client is wrapped
/// in an Arc<Mutex<Option<...>>> so it can be lazily initialized and replaced.
static TUNNEL: std::sync::LazyLock<Arc<Mutex<Option<TunnelClient>>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(None)));

/// Connect the tunnel (Tauri command entrypoint).
pub async fn cmd_connect(config: TunnelConfig) -> Result<ConnectionStats, String> {
    let mut guard = TUNNEL.lock().await;

    // Disconnect any existing connection
    if let Some(ref existing) = *guard {
        existing.disconnect().await;
    }

    let client = TunnelClient::new(config.clone()).with_message_handler(|envelope| {
        log::info!(
            "[tunnel] incoming message for session: {}",
            envelope.relay_to
        );
        // TODO: Route to local MCP server and return response
        None
    });

    client.connect().await?;
    let stats = client.stats().await;

    *guard = Some(client);

    Ok(stats)
}

/// Disconnect the tunnel (Tauri command entrypoint).
pub async fn cmd_disconnect() -> Result<(), String> {
    let mut guard = TUNNEL.lock().await;

    match guard.take() {
        Some(client) => {
            client.disconnect().await;
            Ok(())
        }
        None => Err("tunnel not connected".to_string()),
    }
}

/// Get tunnel status (Tauri command entrypoint).
pub async fn cmd_status() -> Result<ConnectionStats, String> {
    let guard = TUNNEL.lock().await;

    match &*guard {
        Some(client) => Ok(client.stats().await),
        None => Ok(ConnectionStats {
            connected: false,
            connected_at: None,
            uptime_seconds: None,
            last_ping_at: None,
            messages_in: 0,
            messages_out: 0,
            reconnect_attempts: 0,
            last_error: None,
            tunnel_id: None,
            gateway_url: None,
        }),
    }
}
