# BuildIt Personas: Activist Groups

**Date**: 2026-01-31
**Framework**: Training for Change's Spectrum of Support methodology
**Purpose**: Design features for campaign organizers, regular participants, casual supporters, and affected community members across housing, climate, and racial justice movements

---

## Context

Activist groups and social movement organizations run campaigns that combine public pressure, direct action, coalition building, and community power to win concrete changes -- stopping an eviction, blocking a pipeline, passing police accountability legislation. They operate in adversarial environments where the opposition has significant resources and the state may actively surveil, infiltrate, or repress organizing activity. Their needs span the full spectrum from public-facing coalition work to highly compartmentalized direct action planning. BuildIt must serve both the public mobilization layer and the encrypted tactical layer, with clear boundaries between them.

---

## Persona 1: Janelle, The Core Organizer (Active Support)

### Profile
- **Name**: Janelle Carter, 36, campaign director for a tenants' rights organization
- **Role**: Leads a housing justice campaign to pass rent stabilization and stop a wave of no-fault evictions in her city
- **Tech Level**: High (experienced with CRMs, digital organizing tools, encrypted communications)
- **Time Investment**: 40+ hours/week (this is her paid organizing job)
- **Spectrum Position**: **Active Support** -- drives campaign strategy and execution

### Goals and Motivations
- Build a coalition of 15+ organizations to pass rent stabilization legislation
- Coordinate direct actions (landlord office occupations, city council disruptions, tenant marches) with tight operational security
- Track relationships with 200+ tenants, 50 allied organizations, and 12 city council members
- Win the campaign within 18 months before the next round of mass evictions hits
- Develop new leaders from within the tenant base so the organization outlasts any single campaign

### Pain Points
- Coalition coordination is a nightmare -- 15 organizations each with their own communication platforms
- Power mapping is done on whiteboards and sticky notes that cannot be shared securely
- Direct action planning requires extreme compartmentalization, but current tools make this awkward
- Opposing landlord association has hired a PR firm and a private investigation company; organizers have been followed
- Burnout: managing a campaign, a coalition, and a CRM across 4 different tools is unsustainable
- Legal support coordination during actions is ad hoc -- no reliable real-time system for tracking arrests

### BuildIt Journey

**Week 1: Campaign Infrastructure**
1. Creates "Rent Justice Coalition" group with campaign organizing template
2. Enables modules: CRM (contacts, power mapping), Events (actions, meetings), Governance (coalition decisions), Wiki (research, legal resources), Messaging
3. Creates coalition subgroups for each partner organization with delegated admin roles
4. Sets up CRM with custom fields: Relationship Type (tenant/ally/target/opponent), Council District, Engagement Level, Last Contact, Key Issues
5. Imports power map: council members, landlord association board, allied nonprofits, media contacts

**Week 2-8: Campaign Escalation**
1. Tracks 1-on-1 conversations with tenants using CRM activity logs
2. Coordinates coalition meetings via governance module -- proposals require 2/3 coalition vote
3. Plans a public march: event created with public visibility, shared across coalition subgroups
4. Simultaneously plans a landlord office action in a separate direct-action-level encrypted subgroup (core team only)
5. Legal support team sets up a dedicated encrypted channel for real-time arrest tracking during actions

**Month 3: High-Stakes Escalation**
1. Creates "Action Team" subgroup with direct-action privacy level -- NIP-44 encryption, no metadata
2. Plans city council disruption: roles assigned (speakers, banner holders, legal observers, jail support)
3. Location revealed 2 hours before action via timed message release
4. During action: legal observers log arrests in real time via encrypted channel
5. After action: debrief in encrypted subgroup, public victory post shared to coalition feed
6. BLE mesh used inside city hall where cell signal is unreliable

### Feature Needs

**Critical:**
- CRM with power mapping (visual relationship map of targets, allies, opponents)
- Coalition management (multiple organizations in one campaign, delegated governance)
- Direct-action privacy level (encrypted subgroups with no metadata leakage)
- Real-time coordination during actions (encrypted messaging with arrest tracking)
- Legal support module (track arrests, lawyer contact info, bail fund status)
- Event management with multiple privacy levels (public rally vs. encrypted planning meeting)

**Important:**
- Timed message release (reveal action location 2 hours before)
- Role assignment for actions (legal observer, medic, comms, jail support)
- Coalition governance (proposals, votes, decision tracking across organizations)
- BLE mesh for in-building communication during actions
- Media contact management (press list, press release distribution)

**Nice-to-Have:**
- Power analysis visualization (spectrum of support mapped to targets and decision-makers)
- Legislative tracking (bill status, vote counts, hearing dates)
- Counter-narrative tracking (what is the opposition saying, how do we respond)
- Campaign timeline (milestones, escalation arc, win conditions)

---

## Persona 2: Miguel, The Committed Participant (Active Support)

### Profile
- **Name**: Miguel Santos, 23, college student and tenant organizer-in-training
- **Role**: Door-knocks twice a week, attends every action, recruiting other tenants to the campaign
- **Tech Level**: High (digital native, comfortable with encrypted tools)
- **Time Investment**: 10-15 hours/week alongside classes
- **Spectrum Position**: **Active Support** -- taking consistent action, developing as a leader

### Goals and Motivations
- Stop his own building from being sold to a developer who would evict everyone
- Build organizing skills for a career in social justice work
- Connect with other tenants who share his frustration and channel it into collective action
- Feel part of something larger than his individual housing precarity

### Pain Points
- Door-knocking is isolating -- goes out alone, no easy way to debrief or get support in real time
- Hard to track which units he has visited and what residents said across multiple buildings
- Wants to take on more responsibility but is not sure what the campaign needs most
- Sometimes feels out of the loop on strategic decisions made by the core team

### BuildIt Journey

**Weekly Routine:**
1. Gets assignment from CRM: "Visit units 4A-4F at 820 Elm St. Notes from last visit attached"
2. Door-knocks after class, logs each conversation on his phone: name, concerns, support level, follow-up needed
3. Posts a quick update to the organizing channel: "Talked to 6 tenants today. 4 want to come to the meeting!"
4. Attends weekly organizing meeting, reviews CRM data on his building's engagement levels
5. RSVPs to Saturday's march, signs up to carry the lead banner

**Growth Path:**
1. Janelle sees his consistent CRM updates and invites him to a leadership development training
2. Gets added to the campaign strategy subgroup (higher trust level)
3. Begins facilitating tenant meetings in his own building
4. Runs his first phone bank using CRM contact lists and call scripts from the wiki

### Feature Needs

**Critical:**
- Mobile CRM for door-knocking (view contact history, log conversations on the go)
- Quick conversation logging (30-second form: name, sentiment, follow-up action)
- Assignment system (know where to go and what the priorities are)
- Encrypted messaging for real-time support while canvassing

**Important:**
- Leadership development pathways (suggested trainings, increasing responsibility)
- Building-level engagement dashboards (how is my building doing)
- Script and talking point access from mobile (wiki integration)

---

## Persona 3: Patricia, The Sympathizer (Passive Support)

### Profile
- **Name**: Patricia Holden, 58, retired teacher and longtime renter
- **Role**: Signed the petition, attended one rally, shares posts on Facebook, but has not done more
- **Tech Level**: Low-Moderate (uses Facebook and text messages, cautious about new apps)
- **Time Investment**: 1-2 hours/month
- **Spectrum Position**: **Passive Support** -- agrees with the cause, has not committed to regular action

### Goals and Motivations
- Protect her own housing stability -- her landlord raised rent 30% last year
- Supports rent stabilization but feels too old and too tired to be an "activist"
- Wants to help in ways that do not require marching in the street or confronting her landlord
- Needs to see that the campaign is making progress before investing more of herself

### Pain Points
- Went to one rally and found it chaotic -- did not know anyone, did not know what was happening
- Signed a petition but never heard what happened with it
- Worried her landlord will find out she is involved and retaliate with a no-fault eviction
- Feels invisible: the campaign seems run by young people who do not represent her

### BuildIt Journey

**First Contact:**
1. Neighbor Miguel knocks on her door, listens to her concerns, enters her info in the CRM
2. She agrees to sign the petition and gives her phone number
3. Gets a text: "Thanks for signing, Patricia. Here's what happens next" with a link to the public campaign page
4. Reads the page, sees the petition has 2,000 signatures -- feels like part of something real

**Deepening:**
1. Gets a text before the city council hearing: "Your voice matters. Send a 1-minute voicemail to Councilmember Davis"
2. Records a voicemail from her couch -- her first political action beyond signing the petition
3. Gets a follow-up: "78 people called! Councilmember Davis agreed to meet with tenants"
4. Sees the win shared on the public feed, shares it on Facebook
5. Attends a tenant meeting at Miguel's invitation -- in a familiar building, with people her own age

**Privacy Concern:**
1. When she joins the BuildIt group, she uses her first name only
2. Her profile is visible only to group members, not publicly
3. Her landlord cannot discover her participation through any public-facing feature
4. She reads the privacy explainer in the wiki: "Your data is encrypted. Here's what that means"

### Feature Needs

**Critical:**
- Low-effort participation options (call scripts, voicemail prompts, petition sharing)
- Privacy protection for tenants who fear landlord retaliation
- Progress updates showing campaign momentum (signatures, council meetings, wins)
- Text-based outreach (does not need to download an app for initial engagement)

**Important:**
- Story collection (record her experience to share with decision-makers, with her consent)
- Welcoming onboarding for non-activists ("You don't need to march. Here's how you can help")
- Age and accessibility considerations in UI design

---

## Persona 4: Diane, The Uninvolved (Neutral)

### Profile
- **Name**: Diane Tran, 40, homeowner in the same neighborhood, works in healthcare
- **Role**: Not a renter, not affected by the eviction crisis directly
- **Tech Level**: Moderate
- **Time Investment**: 0 hours
- **Spectrum Position**: **Neutral** -- does not see the issue as relevant to her

### Goals and Motivations
- Focused on her own mortgage and her kids' school
- Vaguely aware that rents are rising but sees it as "the market"
- Would care if she understood how mass evictions affect her neighborhood (school enrollment, local businesses closing, increased homelessness)
- Could be a powerful ally because homeowners have political influence with city council

### Pain Points
- Does not receive any information about the housing crisis beyond occasional news articles
- Assumes tenant organizing is adversarial to homeowners (will it lower my property value?)
- Needs to be approached through her existing concerns (neighborhood stability, school quality) rather than tenant rights framing

### BuildIt Journey

**Discovery:**
1. Sees a flyer at her kid's school: "Our neighborhood is changing. Here's why families are leaving"
2. Scans QR code, reads a public story page: data on evictions, school enrollment drops, small business closures
3. Framing is "neighborhood stability" not "tenant rights" -- speaks to her concerns
4. Sees an upcoming neighborhood town hall on the housing crisis -- attends out of curiosity

**Potential Activation:**
1. At the town hall, hears Patricia's story and realizes evictions are displacing her kids' classmates
2. Signs a petition as a homeowner supporter (different framing than tenant petition)
3. Shares the campaign page with her homeowners' association
4. Writes a letter to city council as a concerned homeowner supporting rent stabilization

### Feature Needs

**Critical:**
- Public content framed for different audiences (tenants, homeowners, business owners)
- Neighborhood impact data (visual, shareable, compelling)
- Public events accessible without group membership
- Coalition framing that includes non-affected allies

---

## Cross-Cutting Themes

### Privacy vs. Visibility
Activist groups face the sharpest version of the privacy-visibility tension. Public campaigns need maximum visibility to build power: petition counts, rally photos, coalition endorsements, media coverage. But the people doing the organizing -- especially tenants who fear landlord retaliation, undocumented residents, or those planning direct actions -- need maximum privacy. BuildIt must maintain a hard boundary between the public mobilization layer (events, petitions, victory posts, coalition statements) and the encrypted organizing layer (CRM data, action plans, legal support coordination, internal strategy). The default for any content involving specific people should be encrypted. The default for campaign-level content should be organizer's choice with clear warnings.

### Engagement Ladder
Activist engagement follows a classic organizing model where the critical skill is the 1-on-1 conversation that moves someone from passive concern to active commitment. BuildIt's CRM is the backbone of this process -- tracking who has been contacted, what they said, what their concerns are, and what their next step should be.

| Level | Entry Point | First Action | Deepening |
|-------|-------------|--------------|-----------|
| Neutral | See a flyer or news story | Read public campaign page | Attend a town hall |
| Passive Support | Sign a petition | Make a phone call | Attend a rally |
| Active Support | Door-knock or phone bank | Attend a direct action | Facilitate a tenant meeting |
| Core Organizer | Lead a building committee | Coordinate coalition strategy | Plan and execute escalation |

### Unique Security Considerations
- **Landlord retaliation**: Tenants face real consequences (eviction, harassment, withheld repairs) if their landlord discovers their involvement. CRM data must be encrypted, and tenant participation must never be visible through public-facing features
- **Police surveillance**: Direct actions (occupations, disruptions, blockades) are often monitored by police. Action planning must use direct-action privacy level with no metadata. BLE mesh is critical for coordination when cell networks are monitored or jammed
- **Infiltration**: Well-resourced opposition (landlord associations, corporate interests, law enforcement) may attempt to place informants in organizing spaces. New member verification, compartmentalized subgroups, and anomaly detection are essential
- **Arrest and legal risk**: Participants in direct actions may be arrested. Real-time arrest tracking, lawyer contact distribution, and bail fund coordination must be available through encrypted channels that cannot be subpoenaed from a server
- **Doxxing and harassment**: Organizers and outspoken tenants may be targeted by online harassment campaigns. Multi-identity support allows separation of public organizing identity from personal life
- **Counter-protesters**: Public events may attract hostile individuals. Event security planning and real-time communication among marshals require encrypted, low-latency messaging
- **Overall threat level**: Medium-High. Housing justice campaigns directly threaten significant financial interests, and the response can include private investigators, police coordination with landlords, and organized counter-campaigns. State-level surveillance is possible in escalated scenarios. Full encryption stack and BLE mesh capability are essential features, not nice-to-haves
