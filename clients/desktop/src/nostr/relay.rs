//! Nostr relay WebSocket client implementation with certificate pinning
//!
//! All relay connections use certificate pinning to prevent MITM attacks.
//! Supports both pre-configured pins and Trust-on-First-Use (TOFU).

use super::cert_pinning::{create_pinned_tls_config, CertPinStore};
use super::types::{Filter, NostrMessage, RelayEvent, Subscription};
use buildit_crypto::NostrEvent;
use futures::{SinkExt, StreamExt};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use tokio::net::TcpStream;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{
    connect_async_tls_with_config, tungstenite::Message, Connector, MaybeTlsStream,
    WebSocketStream,
};

/// Relay operation errors
#[derive(Debug, Error)]
pub enum RelayError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Already connected to relay: {0}")]
    AlreadyConnected(String),

    #[error("Not connected to relay: {0}")]
    NotConnected(String),

    #[error("Send failed: {0}")]
    SendFailed(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Subscription not found: {0}")]
    SubscriptionNotFound(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("WebSocket error: {0}")]
    WebSocketError(String),

    #[error("Certificate pinning failed: {0}")]
    CertificatePinningFailed(String),

    #[error("TLS error: {0}")]
    TlsError(String),
}

/// Relay connection status
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RelayStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

/// Nostr relay client with certificate pinning
pub struct NostrRelay {
    url: String,
    status: Arc<RwLock<RelayStatus>>,
    ws: Arc<RwLock<Option<WebSocketStream<MaybeTlsStream<TcpStream>>>>>,
    subscriptions: Arc<RwLock<HashMap<String, Subscription>>>,
    event_tx: broadcast::Sender<RelayEvent>,
    /// Certificate pin store for MITM protection
    pin_store: Arc<CertPinStore>,
}

impl NostrRelay {
    /// Create a new relay client with certificate pinning
    ///
    /// All connections will be verified against certificate pins to prevent MITM attacks.
    pub fn new(url: String, pin_store: Arc<CertPinStore>) -> Self {
        let (event_tx, _) = broadcast::channel(100);

        Self {
            url,
            status: Arc::new(RwLock::new(RelayStatus::Disconnected)),
            ws: Arc::new(RwLock::new(None)),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            pin_store,
        }
    }

    /// Create a new relay client with default certificate pinning
    ///
    /// Loads known pins from configuration and enables TOFU for unknown relays.
    pub fn new_with_default_pinning(url: String) -> Result<Self, RelayError> {
        let config = super::cert_pinning::CertPinConfig::default();
        let mut pin_store = CertPinStore::new(config);

        pin_store
            .load_known_pins()
            .map_err(|e| RelayError::CertificatePinningFailed(e.to_string()))?;

        Ok(Self::new(url, Arc::new(pin_store)))
    }

    /// Connect to the relay with certificate pinning
    ///
    /// The connection will verify the server's certificate against known pins
    /// or use TOFU (Trust-on-First-Use) for unknown relays.
    pub async fn connect(&self) -> Result<(), RelayError> {
        // Check if already connected
        let status = self.status.read().await;
        if *status == RelayStatus::Connected || *status == RelayStatus::Connecting {
            return Err(RelayError::AlreadyConnected(self.url.clone()));
        }
        drop(status);

        // Update status to connecting
        *self.status.write().await = RelayStatus::Connecting;

        // Create pinned TLS configuration
        let tls_config = create_pinned_tls_config(Arc::clone(&self.pin_store));

        // Create TLS connector with certificate pinning
        let connector = Connector::Rustls(tls_config);

        // Connect WebSocket with certificate pinning
        let (ws_stream, _) = connect_async_tls_with_config(&self.url, None, false, Some(connector))
            .await
            .map_err(|e| {
                // Check if this is a certificate pinning error
                let error_msg = e.to_string();
                if error_msg.contains("Certificate pinning failed")
                    || error_msg.contains("pin mismatch")
                {
                    RelayError::CertificatePinningFailed(error_msg)
                } else {
                    RelayError::ConnectionFailed(error_msg)
                }
            })?;

        // Store connection
        *self.ws.write().await = Some(ws_stream);
        *self.status.write().await = RelayStatus::Connected;

        // Log certificate pinning status
        if self.pin_store.is_pinned(&self.url) {
            log::info!(
                "Connected to Nostr relay with certificate pinning: {}",
                self.url
            );
        } else {
            log::info!(
                "Connected to Nostr relay (TOFU - first use): {}",
                self.url
            );
        }

        // Broadcast connected event
        let _ = self.event_tx.send(RelayEvent::Connected {
            url: self.url.clone(),
        });

        // Start message handling task
        self.start_message_handler();

        Ok(())
    }

    /// Disconnect from the relay
    pub async fn disconnect(&self) -> Result<(), RelayError> {
        let mut ws = self.ws.write().await;
        if let Some(mut stream) = ws.take() {
            let _ = stream.close(None).await;
        }

        *self.status.write().await = RelayStatus::Disconnected;
        self.subscriptions.write().await.clear();

        // Broadcast disconnected event
        let _ = self.event_tx.send(RelayEvent::Disconnected {
            url: self.url.clone(),
            reason: "Manual disconnect".to_string(),
        });

        log::info!("Disconnected from Nostr relay: {}", self.url);
        Ok(())
    }

    /// Publish an event to the relay
    pub async fn publish(&self, event: NostrEvent) -> Result<(), RelayError> {
        let ws = self.ws.read().await;
        if ws.is_none() {
            return Err(RelayError::NotConnected(self.url.clone()));
        }
        drop(ws);

        let message = json!(["EVENT", event]);
        let msg_str = serde_json::to_string(&message)
            .map_err(|e| RelayError::SerializationError(e.to_string()))?;

        self.send_message(Message::Text(msg_str)).await?;

        log::debug!("Published event {} to {}", event.id, self.url);
        Ok(())
    }

    /// Subscribe to events matching filters
    pub async fn subscribe(
        &self,
        subscription_id: String,
        filters: Vec<Filter>,
    ) -> Result<(), RelayError> {
        let ws = self.ws.read().await;
        if ws.is_none() {
            return Err(RelayError::NotConnected(self.url.clone()));
        }
        drop(ws);

        // Build REQ message
        let mut req = vec![json!("REQ"), json!(subscription_id)];
        for filter in &filters {
            req.push(serde_json::to_value(filter)
                .map_err(|e| RelayError::SerializationError(e.to_string()))?);
        }

        let msg_str = serde_json::to_string(&req)
            .map_err(|e| RelayError::SerializationError(e.to_string()))?;

        self.send_message(Message::Text(msg_str)).await?;

        // Store subscription
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let subscription = Subscription {
            id: subscription_id.clone(),
            filters,
            created_at: now,
            eose_received: false,
        };

        self.subscriptions
            .write()
            .await
            .insert(subscription_id.clone(), subscription);

        log::debug!("Subscribed with ID: {}", subscription_id);
        Ok(())
    }

    /// Unsubscribe from a subscription
    pub async fn unsubscribe(&self, subscription_id: String) -> Result<(), RelayError> {
        let ws = self.ws.read().await;
        if ws.is_none() {
            return Err(RelayError::NotConnected(self.url.clone()));
        }
        drop(ws);

        // Remove from subscriptions
        if self.subscriptions.write().await.remove(&subscription_id).is_none() {
            return Err(RelayError::SubscriptionNotFound(subscription_id));
        }

        // Send CLOSE message
        let message = json!(["CLOSE", subscription_id]);
        let msg_str = serde_json::to_string(&message)
            .map_err(|e| RelayError::SerializationError(e.to_string()))?;

        self.send_message(Message::Text(msg_str)).await?;

        log::debug!("Unsubscribed from: {}", subscription_id);
        Ok(())
    }

    /// Get current relay status
    pub async fn status(&self) -> RelayStatus {
        self.status.read().await.clone()
    }

    /// Subscribe to relay events
    pub fn subscribe_events(&self) -> broadcast::Receiver<RelayEvent> {
        self.event_tx.subscribe()
    }

    /// Get the certificate pin store
    ///
    /// Can be used to check pinning status or clear TOFU pins
    pub fn pin_store(&self) -> &Arc<CertPinStore> {
        &self.pin_store
    }

    /// Check if this relay has a pinned certificate
    pub fn is_certificate_pinned(&self) -> bool {
        self.pin_store.is_pinned(&self.url)
    }

    /// Clear the TOFU pin for this relay
    ///
    /// Use this when you know the certificate is rotating legitimately
    pub fn clear_tofu_pin(&self) {
        self.pin_store.clear_tofu_pin(&self.url)
    }

    /// Send a message to the relay
    async fn send_message(&self, message: Message) -> Result<(), RelayError> {
        let mut ws = self.ws.write().await;
        if let Some(stream) = ws.as_mut() {
            stream
                .send(message)
                .await
                .map_err(|e| RelayError::SendFailed(e.to_string()))?;
            Ok(())
        } else {
            Err(RelayError::NotConnected(self.url.clone()))
        }
    }

    /// Start the message handler task
    fn start_message_handler(&self) {
        let ws = Arc::clone(&self.ws);
        let subscriptions = Arc::clone(&self.subscriptions);
        let event_tx = self.event_tx.clone();
        let url = self.url.clone();
        let status = Arc::clone(&self.status);

        tokio::spawn(async move {
            loop {
                let mut ws_lock = ws.write().await;
                if let Some(stream) = ws_lock.as_mut() {
                    match stream.next().await {
                        Some(Ok(Message::Text(text))) => {
                            drop(ws_lock);
                            if let Err(e) = Self::handle_message(
                                &text,
                                &subscriptions,
                                &event_tx,
                                &url,
                            )
                            .await
                            {
                                log::warn!("Failed to handle message: {}", e);
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            drop(ws_lock);
                            *status.write().await = RelayStatus::Disconnected;
                            let _ = event_tx.send(RelayEvent::Disconnected {
                                url: url.clone(),
                                reason: "Connection closed by relay".to_string(),
                            });
                            break;
                        }
                        Some(Err(e)) => {
                            drop(ws_lock);
                            log::error!("WebSocket error: {}", e);
                            *status.write().await = RelayStatus::Error(e.to_string());
                            break;
                        }
                        None => {
                            drop(ws_lock);
                            *status.write().await = RelayStatus::Disconnected;
                            break;
                        }
                        _ => {
                            drop(ws_lock);
                        }
                    }
                } else {
                    drop(ws_lock);
                    break;
                }
            }
        });
    }

    /// Handle incoming message from relay
    async fn handle_message(
        text: &str,
        subscriptions: &Arc<RwLock<HashMap<String, Subscription>>>,
        event_tx: &broadcast::Sender<RelayEvent>,
        url: &str,
    ) -> Result<(), RelayError> {
        let value: serde_json::Value = serde_json::from_str(text)
            .map_err(|e| RelayError::SerializationError(e.to_string()))?;

        if let Some(array) = value.as_array() {
            if array.is_empty() {
                return Ok(());
            }

            match array[0].as_str() {
                Some("EVENT") if array.len() >= 3 => {
                    let sub_id = array[1].as_str().unwrap_or("").to_string();
                    let event: NostrEvent = serde_json::from_value(array[2].clone())
                        .map_err(|e| RelayError::SerializationError(e.to_string()))?;

                    let _ = event_tx.send(RelayEvent::Event {
                        subscription_id: sub_id,
                        event,
                    });
                }
                Some("EOSE") if array.len() >= 2 => {
                    let sub_id = array[1].as_str().unwrap_or("").to_string();

                    // Mark subscription as having received EOSE
                    if let Some(sub) = subscriptions.write().await.get_mut(&sub_id) {
                        sub.eose_received = true;
                    }

                    let _ = event_tx.send(RelayEvent::EndOfStoredEvents {
                        subscription_id: sub_id,
                    });
                }
                Some("NOTICE") if array.len() >= 2 => {
                    let message = array[1].as_str().unwrap_or("").to_string();

                    let _ = event_tx.send(RelayEvent::Notice {
                        url: url.to_string(),
                        message,
                    });
                }
                Some("OK") if array.len() >= 3 => {
                    let event_id = array[1].as_str().unwrap_or("").to_string();
                    let success = array[2].as_bool().unwrap_or(false);
                    let message = array.get(3).and_then(|v| v.as_str()).unwrap_or("").to_string();

                    if success {
                        let _ = event_tx.send(RelayEvent::EventPublished { event_id });
                    } else {
                        let _ = event_tx.send(RelayEvent::EventFailed { event_id, message });
                    }
                }
                _ => {
                    log::debug!("Unknown message type: {:?}", array[0]);
                }
            }
        }

        Ok(())
    }
}

use serde::{Deserialize, Serialize};
