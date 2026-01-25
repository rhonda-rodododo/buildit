//! Nostr relay client module for BuildIt Network Desktop
//!
//! Provides WebSocket-based relay connections with:
//! - Connection management
//! - Event publishing
//! - Subscription filtering
//! - Automatic reconnection

pub mod relay;
pub mod types;

pub use relay::{NostrRelay, RelayError, RelayStatus};
pub use types::{Filter, NostrMessage, RelayEvent, Subscription};
