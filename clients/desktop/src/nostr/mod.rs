//! Nostr relay client module for BuildIt Network Desktop
//!
//! Provides WebSocket-based relay connections with:
//! - Connection management
//! - Event publishing
//! - Subscription filtering
//! - Automatic reconnection
//! - Certificate pinning for MITM protection

pub mod cert_pinning;
pub mod relay;
pub mod types;

pub use cert_pinning::{
    CertPinConfig, CertPinError, CertPinStore, CertVerifyResult, PinnedCertVerifier,
    RelayPinConfig,
};
pub use relay::{NostrRelay, RelayError, RelayStatus};
pub use types::{Filter, NostrMessage, RelayEvent, Subscription};
