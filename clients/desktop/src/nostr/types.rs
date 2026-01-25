//! Nostr message types and filters

use buildit_crypto::NostrEvent;
use serde::{Deserialize, Serialize};

/// Nostr relay message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "0", content = "1")]
pub enum NostrMessage {
    /// Event message ["EVENT", subscription_id, event]
    #[serde(rename = "EVENT")]
    Event(String, NostrEvent),

    /// Publish event ["EVENT", event]
    #[serde(rename = "EVENT")]
    Publish(NostrEvent),

    /// Request message ["REQ", subscription_id, ...filters]
    #[serde(rename = "REQ")]
    Request(String, Vec<Filter>),

    /// Close subscription ["CLOSE", subscription_id]
    #[serde(rename = "CLOSE")]
    Close(String),

    /// End of stored events ["EOSE", subscription_id]
    #[serde(rename = "EOSE")]
    EndOfStoredEvents(String),

    /// Notice message ["NOTICE", message]
    #[serde(rename = "NOTICE")]
    Notice(String),

    /// OK message ["OK", event_id, success, message]
    #[serde(rename = "OK")]
    Ok(String, bool, String),
}

/// Nostr subscription filter (NIP-01)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Filter {
    /// Event IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<Vec<String>>,

    /// Author public keys
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,

    /// Event kinds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kinds: Option<Vec<i32>>,

    /// Referenced event IDs (e tags)
    #[serde(skip_serializing_if = "Option::is_none", rename = "#e")]
    pub e_tags: Option<Vec<String>>,

    /// Referenced pubkeys (p tags)
    #[serde(skip_serializing_if = "Option::is_none", rename = "#p")]
    pub p_tags: Option<Vec<String>>,

    /// Timestamp greater than or equal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<i64>,

    /// Timestamp less than
    #[serde(skip_serializing_if = "Option::is_none")]
    pub until: Option<i64>,

    /// Maximum number of events to return
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// Subscription state
#[derive(Debug, Clone)]
pub struct Subscription {
    pub id: String,
    pub filters: Vec<Filter>,
    pub created_at: u64,
    pub eose_received: bool,
}

/// Relay event for broadcasting to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelayEvent {
    /// Connected to relay
    Connected { url: String },

    /// Disconnected from relay
    Disconnected { url: String, reason: String },

    /// Received an event
    Event { subscription_id: String, event: NostrEvent },

    /// End of stored events
    EndOfStoredEvents { subscription_id: String },

    /// Notice from relay
    Notice { url: String, message: String },

    /// Event published successfully
    EventPublished { event_id: String },

    /// Event publication failed
    EventFailed { event_id: String, message: String },
}

impl Filter {
    /// Create a new filter
    pub fn new() -> Self {
        Self::default()
    }

    /// Filter by event IDs
    pub fn ids(mut self, ids: Vec<String>) -> Self {
        self.ids = Some(ids);
        self
    }

    /// Filter by authors
    pub fn authors(mut self, authors: Vec<String>) -> Self {
        self.authors = Some(authors);
        self
    }

    /// Filter by kinds
    pub fn kinds(mut self, kinds: Vec<i32>) -> Self {
        self.kinds = Some(kinds);
        self
    }

    /// Filter by p tags
    pub fn p_tags(mut self, p_tags: Vec<String>) -> Self {
        self.p_tags = Some(p_tags);
        self
    }

    /// Filter by timestamp (since)
    pub fn since(mut self, since: i64) -> Self {
        self.since = Some(since);
        self
    }

    /// Filter by timestamp (until)
    pub fn until(mut self, until: i64) -> Self {
        self.until = Some(until);
        self
    }

    /// Set limit
    pub fn limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}
