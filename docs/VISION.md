# BuildIt Vision

**The spirit document for every contributor, agent, and platform.**

---

## What BuildIt Is

BuildIt is a privacy-first organizing platform. It gives communities the tools to coordinate, communicate, make decisions, and build power -- without surveillance.

It is a single encrypted application that replaces the patchwork of tools organizers currently depend on: Signal for messaging, Google Sheets for contact tracking, Mobilize for events, Google Docs for shared knowledge, Loomio for governance. Each of those tools does one thing. None of them encrypt everything. None of them work offline. None of them were built for people whose safety depends on their communications staying private.

BuildIt consolidates all of it under one roof: messaging, events, CRM, governance, wikis, documents, publishing, microblogging -- all end-to-end encrypted, all local-first, all designed to work when the internet goes down.

It ships as three native applications -- Desktop (Tauri), iOS (Swift), and Android (Kotlin) -- sharing a common protocol, common schemas, and a shared Rust cryptography layer. There is no central server. Data lives on devices and syncs through Nostr relays and BLE mesh. Nobody -- not us, not relay operators, not state actors -- can read what groups are saying.

---

## Who BuildIt Serves

BuildIt is not a single-purpose tool for a single movement. It serves the full landscape of community organizing:

### Labor Unions and Worker Organizing
Workplace campaigns, card drives, contract fights, strike coordination. Organizers need encrypted CRM to track one-on-one conversations with hundreds of coworkers, governance tools for strike authorization votes, and event coordination for picket lines -- all without management surveillance.

### Co-ops and Collectives
Worker co-ops, food co-ops, housing co-ops, media collectives. Democratic organizations need transparent governance (proposals, voting, consensus), shared documents, and internal communication channels that their members actually control.

### Mutual Aid Networks
Disaster response, community support, resource sharing. Mutual aid needs low-friction coordination: who needs what, who can provide it, where and when. It needs to work when infrastructure fails -- offline-first, mesh-capable.

### Activist Groups
Climate action, housing justice, racial justice, immigrant rights, disability rights. Campaigns need the full toolkit: messaging, events, CRM for supporter tracking, public pages to build momentum, and direct-action privacy for sensitive operations.

### Community Organizers
Neighborhood associations, tenant unions, civic engagement campaigns. Organizers working at the community level need to reach people across a wide spectrum of engagement -- from the deeply committed to the casually curious -- with tools that scale from a handful of block captains to thousands of residents.

### Media Collectives
Independent journalism, community radio, newsletter cooperatives. Media collectives need editorial workflows, democratic governance over coverage priorities, content syndication across regional networks, and the ability to protect sources with real encryption.

### Civil Defense and Crisis Response
Authoritarian resistance, whistleblowing, high-security coordination. Some users face state-level adversaries. BuildIt provides duress passwords, Tor integration, anonymous identities, BLE mesh for communication when networks are shut down, and coercion resistance features that no mainstream platform offers.

---

## Why BuildIt Exists

### The Tooling Gap

There is no tool that does what organizers need, the way they need it done.

**Signal** has strong encryption but zero organizing features. You cannot track contacts, run votes, coordinate events, or build a knowledge base. It is a messaging app, not an organizing platform.

**Google Workspace** (Sheets, Docs, Drive) has powerful collaboration tools but no encryption, no privacy, and full visibility to Google and anyone with a subpoena. Organizers routinely keep sensitive membership lists, support-level assessments, and strategy documents in Google Sheets -- data that could endanger people if exposed.

**Mobilize, Action Network, EveryAction** are built for electoral campaigns and large nonprofits. They are centralized, they harvest data, and they are not designed for the adversarial conditions that labor organizers, direct action groups, and communities under surveillance actually face.

**Loomio, Decidim** offer governance tools but lack integrated messaging, CRM, or encryption. They are one piece of the puzzle.

**Slack, Discord** are surveillance platforms marketed as collaboration tools. They log everything, sell data, and comply with law enforcement without question.

BuildIt exists because organizers deserve a single platform that combines the organizing power of a full-featured suite with the privacy guarantees of end-to-end encryption and local-first architecture. No compromises. No data harvesting. No central point of failure.

---

## Core Design Principles

### 1. Privacy-First

Every message, every vote, every contact record is end-to-end encrypted by default. BuildIt uses NIP-44 (ChaCha20-Poly1305) for content encryption and NIP-17 gift wrapping for metadata protection. Relay operators see ciphertext and ephemeral keys -- never the real sender, never the content, never the true timestamp.

Zero-knowledge is not a marketing term here. It is a structural property. We cannot read your data because we never have your keys.

### 2. Meet People Where They Are

Not everyone in a campaign is ready to march. The Spectrum of Support framework recognizes five levels of engagement -- from active allies to active opposition -- and BuildIt designs features for all of them. Public landing pages reach the uninformed. Low-barrier entry points activate the sympathetic. Powerful organizing tools serve the committed. OpSec features protect the exposed.

The goal is always movement: shift people one step closer to engagement, and give them the tools for whatever level they are at right now.

### 3. Mobile-First

Organizing happens on phones. On the factory floor, at the bus stop, in the break room. Every feature is designed for mobile first, then enhanced for desktop. Touch targets, offline capability, push notifications, QR code onboarding -- the phone is the primary device.

### 4. Offline-Capable

BuildIt is local-first. All data is stored on-device. BLE mesh networking is the primary transport; internet connectivity through Nostr relays is a fallback. When the network goes down -- whether from infrastructure failure or deliberate shutdown -- BuildIt keeps working. Devices sync directly, messages queue for delivery, and the application remains fully functional.

### 5. Accessible

WCAG 2.1 AA compliance. Full keyboard navigation. Screen reader support. High contrast modes. Internationalization from day one. Accessibility is not a phase-two feature. If an organizer cannot use the tool, the tool has failed.

### 6. Activist-Focused

The UI prioritizes speed of access to critical features. Crisis scenarios drive design decisions. Direct-action privacy levels reveal event locations only hours before. Duress passwords show decoy identities under coercion. Silent alerts notify trusted contacts when something goes wrong. These are not edge cases -- they are core requirements.

### 7. Modular

Groups enable only the features they need. A mutual aid network might use messaging, events, and a resource wiki. A union campaign might add CRM, governance, and documents. A media collective might enable publishing and newsletters. Modules are composable, and groups grow into complexity rather than being overwhelmed by it.

### 8. Decentralized

No single server. No single company. No single point of failure. Data flows through a network of Nostr relays and BLE mesh connections. Communities can run their own relays. The protocol is open. The schemas are public. If BuildIt the organization disappeared tomorrow, the software and the network would keep running.

---

## The Spectrum of Support

BuildIt is built on a framework from Training for Change called the Spectrum of Support. It maps every person in a campaign across five levels:

| Level | Description | What They Need from BuildIt |
|-------|-------------|----------------------------|
| **Active Support** | Agrees with us AND taking action | CRM, task management, campaign analytics, direct-action privacy |
| **Passive Support** | Agrees with us, but not acting yet | Activity feeds, low-risk first steps, anonymous engagement, social proof |
| **Neutral** | Uninformed, unsure, or disengaged | Public landing pages, FAQs, storytelling, polls, public events |
| **Passive Opposition** | Disagrees, but not acting against us | Transparency, public accountability, values contrast |
| **Active Opposition** | Disagrees AND acting against us | (Defensive) Privacy protections, infiltration countermeasures, OpSec |

**The organizing principle**: We build power by shifting groups one step toward us. We do not need to convert active opposition into active allies. We win by moving neutrals to passive support, passive supporters to active support, and active supporters into leadership.

BuildIt is the only platform that designs for the full spectrum -- from the person who has never heard of the campaign to the lead organizer running it.

Full persona definitions and user journeys are documented in `docs/personas/`.

---

## Product Philosophy

### "Meet people where they are on the spectrum, and give them a path to the next level."

This is the single sentence that governs every product decision.

**Different people need different features.** The core organizer running a union campaign needs encrypted CRM with custom fields, bulk operations, and campaign analytics. The sympathetic coworker who just heard about the union needs a simple activity feed, a two-minute explainer, and a one-tap way to show support anonymously. Both are critical users. Both deserve a considered experience.

**Privacy is contextual.** Public content builds momentum -- rally photos, victory announcements, membership milestones create social proof that moves neutrals toward support. Encrypted content protects organizers -- strategy discussions, contact lists, escalation plans stay invisible to adversaries. BuildIt gives groups granular control over what is public and what is encrypted, with smart defaults that match the sensitivity of each content type.

**Storytelling moves people up the spectrum.** Neutrals become supporters when they hear a coworker's story. Passive supporters become active when they see the campaign winning. Active supporters become leaders when they understand the strategy. BuildIt provides tools for creating and distributing these narratives -- testimonials, timelines, victory posts, progress dashboards -- because information without narrative does not move people.

**Low-barrier entry, high-ceiling capability.** Joining a group should take under three minutes: scan a QR code, create an account, see the activity feed. But the same platform should support a lead organizer managing hundreds of contacts across a multi-month campaign with governance votes, coalition coordination, and real-time analytics. The architecture scales from simplicity to sophistication without forcing either on anyone.

**The path to the next level is always visible.** BuildIt surfaces appropriate next steps: "You joined two weeks ago. Ready to take your first action?" or "You have attended three events. Want to join the organizing committee?" Engagement ladders are not gamification -- they are the digital expression of the one-on-one organizing conversation that has always been the foundation of movement building.

---

## Technical North Stars

These are the non-negotiable technical commitments that every implementation decision must honor:

1. **End-to-end encryption is not optional.** Private content is encrypted before it leaves the device. Always. On every platform.

2. **Local-first is not eventual.** The application must function fully without internet connectivity. Sync is additive, not required.

3. **The protocol is the source of truth.** All type definitions flow from `protocol/schemas/`. All clients implement the same protocol. Cross-client interoperability is a hard requirement, not a goal.

4. **No single point of failure.** Architecture decisions that introduce central dependencies are rejected. The system must survive the loss of any single relay, any single server, any single organization.

5. **Security for the most vulnerable user.** Design decisions are evaluated against the threat model of an organizer facing state-level adversaries. If a feature compromises that user's safety, it does not ship.

---

## What Success Looks Like

BuildIt succeeds when:

- A warehouse worker can join a union campaign in under three minutes from a QR code on a break room flyer, and their employer never knows they joined.
- A tenant union can run a building-wide vote on a rent strike with anonymous encrypted ballots and publish the results publicly to build pressure on the landlord.
- A mutual aid network can coordinate disaster response across a city using BLE mesh when cell towers are down.
- A media collective can operate a full editorial workflow with democratic governance, publish stories to a regional syndication network, and protect their sources with real encryption.
- A community organizer in an authoritarian context can coordinate safely, knowing that even if their device is seized, the duress password protects their real identity and silently alerts their network.
- All of these people are using the same platform, on the same protocol, with the same privacy guarantees.

---

## Related Documents

| Document | Location |
|----------|----------|
| Security Architecture | `docs/SECURITY.md` |
| Threat Model | `docs/THREAT_MODEL.md` |
| Protocol Overview | `docs/protocol-spec/01-overview.md` |
| Encryption Strategy | `docs/architecture/encryption-strategy.md` |
| Spectrum of Support Personas | `docs/personas/labor-organizing.md` |
| Media Collective Vision | `docs/visions/media-collective.md` |
| Active Roadmap | `clients/web/NEXT_ROADMAP.md` |
| Privacy Documentation | `docs/PRIVACY.md` |

---

*This document is the foundation. Every feature, every protocol decision, every line of code should be traceable back to the commitments made here. When in doubt, return to this document and ask: does this serve the people BuildIt was built for?*
