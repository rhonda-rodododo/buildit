# Content Moderation Policy

**Last Updated: January 2026**

## How Moderation Works in an E2EE System

BuildIt uses end-to-end encryption (E2EE) for private communications. This
fundamentally limits server-side content moderation capabilities.

## What Can Be Moderated

### Relay-Level (Server-Side)

- **Public key blocklists**: Known spam or abuse accounts can be blocked at the
  relay level, preventing their public events from being distributed
- **Public events**: Non-encrypted posts visible to the relay can be reviewed
- **Rate limiting**: Automated abuse prevention via rate limits

### Group-Level (Client-Side)

- **Admin powers**: Group administrators can remove members from their groups
- **Message deletion**: Admins can delete messages within their groups
- **Invite controls**: Groups can restrict who can join
- **Permission management**: Role-based access controls per group

### Individual-Level

- **Block users**: Any user can block other users
- **Mute users**: Mute notifications from specific users
- **Report**: Users can report public content to relay operators

## What Cannot Be Moderated

- **Encrypted DM content**: We cannot read or moderate encrypted direct messages
- **Encrypted group content**: Group message content is not visible to servers
- **BLE mesh content**: Peer-to-peer content does not pass through our servers

## Transparency

We aim to publish periodic transparency reports documenting:

- Number of public key blocks
- Requests received from authorities
- Our technical limitations in responding to such requests

## Reporting

To report abuse on public relay content: abuse@buildit.network
