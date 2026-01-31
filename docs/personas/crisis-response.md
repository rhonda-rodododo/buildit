# BuildIt Personas: Crisis Response

**Date**: 2026-01-31
**Framework**: Training for Change's Spectrum of Support methodology
**Purpose**: Design features for civil defense coordinators, trained field volunteers, support network participants, and bystanders in high-risk crisis and human rights documentation scenarios

---

## Context

Crisis response organizing operates under the most extreme conditions BuildIt must support: state-level surveillance, active physical danger, arrest and detention risk, and the need for real-time coordination when infrastructure is degraded or hostile. This encompasses legal observer teams at protests, street medic collectives, human rights documentation networks, civil defense coordinators in conflict zones, and rapid-response networks for ICE raids or state violence. The organizing model prioritizes compartmentalization, operational security, and the ability to function when cell networks are monitored, jammed, or destroyed. BuildIt's BLE mesh capability, burner identity support, and NIP-17 metadata protection are not nice-to-haves in this context -- they are life-safety features.

---

## Persona 1: Sana, The Core Organizer (Active Support)

### Profile
- **Name**: Sana Al-Rashid, 31, civil defense coordinator and human rights documenter
- **Role**: Runs a legal observer and documentation network that deploys to protests, ICE enforcement operations, and police violence incidents. Coordinates 30 trained volunteers across a metro area
- **Tech Level**: Very High (encrypted communications, OPSEC training, digital forensics awareness, has been subpoenaed for digital records)
- **Time Investment**: 25-40 hours/week (varies with crisis intensity)
- **Spectrum Position**: **Active Support** -- designs and executes crisis response operations

### Goals and Motivations
- Ensure every police interaction at a protest is documented with admissible evidence
- Protect her volunteers from arrest, injury, and long-term legal consequences
- Build a documentation archive that can support civil rights litigation
- Maintain operational capacity even when cell networks are jammed or monitored
- Train new legal observers and medics to sustain the network beyond her personal involvement
- Compartmentalize operations so that if one person is compromised, the entire network is not exposed

### Pain Points
- Communications during actions are the highest-risk moment: real-time coordination on monitored networks
- A legal observer was arrested last year and their phone was seized -- contacts, messages, and photos were accessed by police
- No reliable way to coordinate when cell towers are overloaded at large protests or intentionally degraded
- Documentation (photos, video, witness statements) is scattered across personal phones with no secure central archive
- Volunteer burnout is severe -- crisis work is traumatic and the pipeline for new trained volunteers is thin
- The legal support hotline is a phone tree that breaks down when multiple people are arrested simultaneously

### BuildIt Journey

**Week 1: Network Architecture**
1. Creates "Metro Legal Observer Network" group with crisis response template
2. Designs a cell structure: separate subgroups for Legal Observers, Street Medics, Communications, Jail Support, and Documentation Archive
3. Each cell can see only its own channel plus a shared operational feed -- no cross-cell visibility of membership
4. Enables modules: Messaging (encrypted, BLE mesh capable), Events (deployment scheduling), CRM (volunteer skills and availability), Wiki (protocols and training materials), Documents (evidence archive)
5. All volunteers create burner identities for operational use -- real identities known only to Sana and one backup coordinator

**Operational Deployment: Protest Response**
1. Intelligence indicates a large protest this Saturday. Sana activates deployment protocol
2. Posts to operational feed (encrypted): "Deployment Saturday. Legal observers report to staging at 0800. Medics on standby"
3. Assigns roles via CRM: 8 legal observers, 4 medics, 2 communications operators, 3 jail support volunteers
4. Each role gets specific briefing materials via encrypted wiki: legal observer checklist, medic triage protocol, communications relay procedure
5. Communications operators set up BLE mesh relay points around the protest perimeter

**During the Action:**
1. Legal observers document police actions via encrypted photo/video upload to the documentation archive
2. Communications operators relay information between cells via BLE mesh -- no cell network dependency
3. When an arrest occurs: legal observer logs the arrest (time, location, officer badge number, charges stated) in the real-time arrest tracker
4. Jail support cell receives the arrest notification instantly, contacts the NLG hotline and the arrested person's emergency contact
5. Sana monitors the operational feed from a secure location, coordinates resource reallocation as the situation evolves

**Post-Action:**
1. All operational channels are reviewed and archived with encryption
2. Documentation archive is organized for potential litigation use
3. Volunteers debrief in encrypted channel: what worked, what failed, who needs support
4. Burner identities used during the action are rotated -- new keys generated for next deployment
5. Volunteer wellness check-ins scheduled for the following week

### Feature Needs

**Critical:**
- BLE mesh communication (function without cell network)
- Burner/rotating identity support (new keys per deployment, no persistent identity trail)
- Cell structure with strict compartmentalization (cross-cell visibility controlled by coordinator only)
- Real-time arrest tracker (encrypted, accessible to jail support cell)
- Encrypted evidence archive (photos, video, witness statements with chain-of-custody metadata)
- NIP-17 full metadata protection on all operational communications
- Remote device wipe capability (if a phone is seized, wipe BuildIt data remotely)
- Panic button (one-tap alert that triggers arrest protocol: notify jail support, lock device, begin evidence preservation)

**Important:**
- Offline-first operation (full functionality without internet connectivity)
- Timed message destruction (operational messages auto-delete after configurable period)
- Role-based deployment templates (pre-configured briefings for each role type)
- Volunteer skills and certification tracking in CRM (CPR certified, legal observer trained, comms operator qualified)
- Training module integration (link wiki protocols to in-person training completion)

**Nice-to-Have:**
- Secure voice channels over BLE mesh for real-time tactical communication
- GPS-free location sharing (relative positioning via BLE signal strength)
- Integration with NLG (National Lawyers Guild) hotline systems
- Automated incident report generation from arrest tracker data

---

## Persona 2: Chris, The Committed Volunteer (Active Support)

### Profile
- **Name**: Chris Morales, 25, trained street medic and legal observer
- **Role**: Deploys to 2-3 actions per month, provides first aid, documents police interactions, trains new volunteers
- **Tech Level**: High (comfortable with encrypted tools, carries a protest phone separate from personal phone)
- **Time Investment**: 8-15 hours/week (deployments plus training and preparation)
- **Spectrum Position**: **Active Support** -- trained, reliable, takes significant personal risk

### Goals and Motivations
- Protect people exercising their rights from state violence
- Use his EMT training to provide care when official medical services are absent or hostile
- Build the movement's capacity to sustain itself under pressure
- Document abuses that can support accountability and litigation
- Manage his own risk: he has been arrested once and cannot afford another charge

### Pain Points
- Carries two phones (personal and protest) which is cumbersome and suspicious
- During chaotic situations, it is hard to communicate with the coordination team -- cell networks overloaded, too loud to hear phone calls
- After his arrest, police held his protest phone for 3 months -- lost documentation from several actions
- Training new volunteers is time-intensive and there is no central repository of training materials in a format people actually use
- Emotional toll: has treated rubber bullet injuries, tear gas exposure, and broken bones. No structured support system

### BuildIt Journey

**Pre-Deployment:**
1. Gets encrypted notification 48 hours before deployment: action briefing, role assignment (street medic, northwest quadrant), staging location
2. Reviews the medic protocol in the wiki on his phone: triage priorities, supply checklist, evacuation routes
3. Checks his burner identity is current -- rotates keys if it has been more than 30 days
4. Downloads offline maps and protocol documents to his device (offline-first preparation)

**During Deployment:**
1. Arrives at staging, checks in via BLE mesh -- no cell network needed
2. Receives real-time updates on the operational feed: "March route changed. Police blocking 5th Ave. Redirect to Oak St"
3. Treats a protester with a pepper spray injury, logs the medical contact in the encrypted incident tracker
4. Photographs a police officer using excessive force, uploads to the documentation archive with timestamp and geotag
5. Hears over BLE mesh: "Arrest at 3rd and Main. Legal observer documenting. Medic not needed at this time"

**Post-Deployment:**
1. Debriefs in encrypted channel, files his incident report
2. Rotates his burner identity for the next deployment
3. Attends a monthly training session to maintain skills and train two new medic volunteers
4. Participates in a wellness check-in facilitated by the network's peer support volunteer

### Feature Needs

**Critical:**
- BLE mesh for field communication (voice and text without cell dependence)
- Burner identity rotation (seamless key rotation between deployments)
- Encrypted incident logging (medical contacts, use-of-force documentation)
- Offline-first operation (all protocols and communication available without internet)
- Quick evidence capture (one-tap photo/video with encrypted upload and metadata)

**Important:**
- Device lockdown mode (one-tap to lock BuildIt, require biometric + passphrase to reopen)
- Training material access from mobile (wiki protocols optimized for field reference)
- Incident report templates (structured forms for medical contacts, arrests, use-of-force)
- Peer support and wellness features (check-in scheduling, resource directory)

---

## Persona 3: Mariam, The Sympathizer (Passive Support)

### Profile
- **Name**: Mariam Youssef, 48, homeowner, offers her house as a safe space and stores supplies
- **Role**: Does not attend actions but provides material support: safe house, supply storage, meals for volunteers, bail fund contributions
- **Tech Level**: Moderate (uses encrypted messaging when asked, but prefers simplicity)
- **Time Investment**: 3-5 hours/month (storing supplies, occasional hosting)
- **Spectrum Position**: **Passive Support** -- committed to the cause, provides critical infrastructure, avoids direct exposure

### Goals and Motivations
- Support the movement without putting herself at direct risk of arrest or injury
- Provide a safe space where volunteers can decompress, store gear, and regroup after actions
- Contribute financially to bail funds and supply purchases
- Stay informed enough to know when her help is needed, without being in the operational loop

### Pain Points
- Gets anxious when she knows an action is happening and does not hear back for hours
- Does not want to be in group chats with operational details -- the less she knows, the safer everyone is
- Needs clear, simple communication: "We need your house Saturday night" or "Can you store 4 boxes of supplies?"
- Worried about her home being identified as part of the network if communications are compromised

### BuildIt Journey

**Ongoing Support:**
1. Sana contacts her via encrypted DM (not through any group channel): "Can you host 6 volunteers for debrief Saturday evening?"
2. Mariam responds yes, gets a follow-up with arrival time and any dietary restrictions
3. After the debrief, she does not know operational details -- she provided a space, food, and comfort
4. Contributes $100 to the bail fund via an encrypted payment link, no public record of the transaction

**During Crises:**
1. Gets a pre-arranged signal via encrypted DM: "Package arriving" (meaning someone needs emergency shelter)
2. Prepares a room, asks no questions about who is coming or why
3. The person stays one night, leaves in the morning -- Mariam never learns their real name
4. Sana follows up: "Thank you. Everyone is safe"

**Compartmentalization:**
1. Mariam is not in any group channel -- she communicates only via 1-on-1 encrypted DM with Sana
2. Her identity is not listed in any membership roster or CRM that field volunteers can access
3. If a field volunteer's device is compromised, Mariam's involvement cannot be discovered
4. Her contribution is invisible to the network except to Sana and one backup coordinator

### Feature Needs

**Critical:**
- Strict 1-on-1 encrypted communication (no group membership exposure)
- Complete compartmentalization (her identity visible only to the coordinator)
- Simple, clear messaging (no jargon, no operational details, just what she needs to do)
- No metadata trail connecting her to the network's group infrastructure

**Important:**
- Pre-arranged signal system (coded messages for different types of requests)
- Encrypted financial contributions (bail fund donations with no public trail)
- Peace-of-mind updates after actions ("Everyone is safe, thank you")

---

## Persona 4: David, The Uninvolved (Neutral)

### Profile
- **Name**: David Chen, 37, lives near a frequent protest site, works from home
- **Role**: Bystander who sees protests from his apartment window
- **Tech Level**: Moderate
- **Time Investment**: 0 hours
- **Spectrum Position**: **Neutral** -- neither supportive nor opposed, but increasingly affected

### Goals and Motivations
- Wants to understand what is happening on his block when protests occur
- Annoyed by street closures and noise but also troubled by the police response he has witnessed
- Recorded a video of police using tear gas on his block last month -- does not know what to do with it
- Would provide his video as evidence if he knew it would be used responsibly and his identity protected

### Pain Points
- Local news coverage does not match what he sees from his window
- Does not know who the organizers are or how to contact them
- Nervous about getting involved in anything that might put him on a list
- Has valuable documentation (bystander video) but no secure way to share it

### BuildIt Journey

**Incident:**
1. Records police using tear gas against peaceful protesters from his balcony
2. Shares the video on Twitter, gets 50,000 views but also hostile replies and a DM from someone claiming to be a journalist
3. Sees a flyer posted in his building lobby after the protest: "Witnessed police misconduct? Submit evidence securely" with a QR code
4. Scans the code, reaches a secure evidence submission form -- no account required, no identity collected
5. Uploads his video with a timestamp and brief description of what he witnessed

**Potential Deepening:**
1. Receives a follow-up (if he opted in): "Your video was included in a civil rights complaint. Thank you"
2. Starts paying attention to the network's public posts about protest rights and police accountability
3. Next time there is a protest on his block, he positions himself to document if needed
4. Eventually joins the public supporters group to stay informed, though he never attends an action

### Feature Needs

**Critical:**
- Anonymous evidence submission (no account, no identity, secure upload)
- Clear explanation of how submitted evidence will be used and protected
- No ongoing commitment required (one-time contribution, not joining a network)

**Important:**
- Opt-in follow-up (learn what happened with your submission)
- Public information about rights (what can bystanders legally document)
- Trust signals (who runs this network, what is their track record)

---

## Cross-Cutting Themes

### Privacy vs. Visibility
Crisis response operates almost entirely in the encrypted layer. There is minimal public-facing content: perhaps a public "Know Your Rights" page and an anonymous evidence submission form. Everything else -- volunteer identities, deployment plans, arrest tracking, evidence archives, support network contacts -- must be encrypted with the strongest protections BuildIt offers. The public layer exists only to receive information from bystanders and to provide legal education. The operating principle is: if it is not explicitly intended for the public, it is encrypted by default with no exceptions.

### Engagement Ladder
Crisis response engagement follows a trust-and-training model rather than a casual engagement ladder. People cannot simply show up and participate -- untrained volunteers in crisis situations are a liability to themselves and others. The ladder is gated by training and trust.

| Level | Entry Point | First Action | Deepening |
|-------|-------------|--------------|-----------|
| Neutral (Bystander) | Witness an incident | Submit evidence anonymously | Follow public updates |
| Passive Support | Offer material support | Host a debrief, store supplies | Contribute to bail fund |
| Active Support | Complete training | Deploy to first action with a mentor | Take on specialized role (medic, legal observer, comms) |
| Core Organizer | Lead trainings | Coordinate deployments | Design network architecture, manage compartmentalization |

The critical transitions here are Training (passive to active) and Trust (being granted access to operational information). BuildIt must support formal training tracking in the CRM and progressive access control that expands as trust is established.

### Unique Security Considerations
- **State-level surveillance**: This is the primary threat. Law enforcement agencies actively monitor protest communications, use Stingray/IMSI catchers to intercept cell traffic, and obtain court orders for communication records. All operational communications must use NIP-17 with full metadata protection. BLE mesh eliminates cell network dependency entirely
- **Device seizure**: Phones are routinely seized during arrests. BuildIt must support rapid device lockdown (one-tap), remote wipe capability, and a design where seized devices reveal nothing about the network's structure, other members' identities, or archived evidence. Burner identities ensure that a seized device's BuildIt data cannot be linked to a real person
- **Infiltration**: Law enforcement routinely places undercover officers in protest organizations. The cell structure must ensure that infiltrating one cell does not expose others. Compartmentalization is not optional -- it is the fundamental architectural requirement
- **Physical danger**: Volunteers face rubber bullets, tear gas, batons, kettling, and vehicular attacks. Real-time communication must function under these conditions. BLE mesh with minimal UI interaction (one-tap alerts, voice relay) is a safety requirement
- **Legal proceedings**: Documentation collected by the network may be subpoenaed. Chain-of-custody metadata must be maintained for evidentiary value, but the identities of documenters must be protected. Separation of evidence metadata from documenter identity is essential
- **Informant risk**: Even trusted volunteers may be turned into informants under legal pressure. The system must be designed so that no single compromised individual can expose the full network. Key rotation after each deployment limits the window of exposure
- **Infrastructure degradation**: Cell networks may be overloaded, jammed, or shut down during major protests or civil unrest. BLE mesh is the primary communication layer, not a fallback. All critical functions must work fully offline
- **Psychological operations**: Adversaries may attempt to spread disinformation within the network (false arrest reports, fake emergency calls, panic-inducing messages). Message authentication and verified sender identities within the encrypted layer prevent impersonation
- **Overall threat level**: VERY HIGH. This is the most demanding security context BuildIt must support. Every feature must be evaluated against a threat model that includes state-level adversaries with legal authority, technical capability, and physical force. The full encryption stack, BLE mesh, burner identities, compartmentalization, remote wipe, and offline-first operation are all essential. Failure in any of these areas can result in imprisonment, injury, or death
