# BuildIt Personas: Mutual Aid Networks

**Date**: 2026-01-31
**Framework**: Training for Change's Spectrum of Support methodology
**Purpose**: Design features for mutual aid coordinators, volunteers, donors, and community members across the full engagement spectrum

---

## Context

Mutual aid networks are decentralized systems of community care where neighbors share resources directly -- food, supplies, childcare, transportation, housing support -- without institutional gatekeeping. These networks often operate through community fridges, food pantries, supply depots, and rapid-response disaster relief. They face unique challenges: coordinating dozens of volunteers with unpredictable schedules, matching resources to needs in real time, and navigating city regulations that may target their operations. BuildIt serves as the coordination backbone that replaces scattered group chats, spreadsheets, and word-of-mouth logistics.

---

## Persona 1: Rosa, The Core Organizer (Active Support)

### Profile
- **Name**: Rosa Gutierrez, 38, mutual aid coordinator
- **Role**: Founded and runs a neighborhood fridge/pantry network spanning 6 locations across two zip codes
- **Tech Level**: Moderate-High (comfortable with spreadsheets, group chats, social media)
- **Time Investment**: 20-30 hours/week on coordination, pickups, and community outreach
- **Spectrum Position**: **Active Support** -- drives the network's operations and strategy

### Goals and Motivations
- Keep all 6 fridge/pantry locations consistently stocked with fresh, culturally relevant food
- Coordinate 40+ volunteers across shifting schedules without burning anyone out
- Match incoming donations (food drives, cash, supplies) to actual community needs
- Respond rapidly when crises hit (evictions, fires, storms, ICE raids)
- Build long-term community resilience, not just emergency response
- Maintain independence from nonprofits and government agencies that impose conditions on aid

### Pain Points
- Volunteer coordination happens across 4 separate Signal groups, 2 WhatsApp threads, and a Google Sheet
- No central view of who needs what and who can provide it -- resource matching is manual and slow
- City health department has started citing community fridges; needs to document compliance without exposing volunteers
- Donor fatigue: people give once and disappear because there is no feedback loop showing impact
- Disaster response is chaotic -- when a building fire displaced 12 families last month, it took 6 hours to coordinate supplies

### BuildIt Journey

**Week 1: Network Setup**
1. Creates "Northside Mutual Aid" group with mutual aid template
2. Enables modules: CRM (contact/resource tracking), Events (volunteer shifts), Wiki (guides), Messaging, Mutual Aid
3. Imports volunteer list (45 people) into CRM with fields: Availability, Vehicle Access, Languages Spoken, Skills, Neighborhood
4. Creates resource inventory in wiki: current stock levels at each fridge location, donation drop-off protocols
5. Sets up volunteer shift calendar with recurring weekly slots

**Week 2-6: Steady State Operations**
1. Uses CRM daily to match incoming requests ("family of 4 needs diapers and formula") to available volunteers
2. Posts resource needs to group feed; volunteers claim tasks with one tap
3. Tracks fridge stock levels through quick mobile check-in forms after each restock
4. Sends encrypted DMs to coordinate sensitive requests (undocumented families, people fleeing domestic violence)
5. Runs governance votes on network decisions: new fridge locations, spending priorities, partnership proposals

**Month 3: Crisis Response**
1. Severe storm knocks out power in two neighborhoods -- activates disaster response protocol
2. Posts urgent needs to feed: water, batteries, charging stations, shelter for displaced residents
3. Uses CRM to filter volunteers by neighborhood and vehicle access for rapid deployment
4. Coordinates with allied networks via BLE mesh when cell service is spotty
5. Documents response for community accountability and future planning in wiki

### Feature Needs

**Critical:**
- CRM with resource matching (needs vs. available supplies and volunteers)
- Volunteer shift management with recurring schedules and quick swap/claim
- Encrypted messaging for sensitive coordination (undocumented community members, DV situations)
- Mobile-first inventory tracking (scan, update stock, flag shortages)
- Rapid-response mode (push alert to all volunteers, priority task assignment)

**Important:**
- Resource request forms (community members submit needs without joining the group)
- Impact tracking (meals served, families helped, volunteer hours) for donor retention
- Multi-location dashboard (see all 6 sites at a glance)
- Governance module for collective decision-making on network direction

**Nice-to-Have:**
- Public-facing resource map (show fridge locations, hours, current stock)
- Integration with donation platforms (track cash donations alongside physical goods)
- Automated volunteer reminders and thank-you messages

---

## Persona 2: DeShawn, The Committed Volunteer (Active Support)

### Profile
- **Name**: DeShawn Williams, 26, restaurant line cook and regular volunteer
- **Role**: Restocks 2 fridge locations twice a week, picks up donations from grocery stores
- **Tech Level**: Moderate (uses phone for everything, comfortable with apps)
- **Time Investment**: 6-8 hours/week volunteering
- **Spectrum Position**: **Active Support** -- reliable, consistent, but not leading

### Goals and Motivations
- Give back to the neighborhood that raised him
- Fit volunteering around an unpredictable work schedule
- Stay connected to the community without attending lengthy meetings
- See that his effort actually makes a difference
- Eventually learn enough to help coordinate, not just execute

### Pain Points
- Gets lost in group chat noise -- misses important updates buried in 200 messages
- Schedule changes at his restaurant mean he sometimes cannot make his shift, and finding a replacement is awkward
- Does not know what is most needed at each location until he physically shows up
- Feels underappreciated -- nobody tracks how many hours he puts in or acknowledges the work

### BuildIt Journey

**Week 1: Onboarding**
1. Rosa shares a QR code at a community dinner
2. DeShawn creates an account in under 3 minutes, joins the group
3. Sees the volunteer calendar, claims two weekly restock shifts at locations near his apartment
4. Reads the wiki guide: "Fridge Restock Protocol" (what to check, how to log stock levels)

**Ongoing: Weekly Routine**
1. Gets a push notification the morning of his shift: "Restock at MLK Fridge today. Priority needs: produce, milk, eggs"
2. Picks up donations from Trader Joe's (scheduled pickup Rosa arranged)
3. Restocks fridge, takes a photo, fills out 30-second mobile form: items added, items expired and removed, general condition
4. Posts photo to group feed: "MLK fridge fully stocked!" -- gets reactions and comments from other volunteers

**When Schedule Conflicts:**
1. Taps "Can't make it" on his shift, which alerts other volunteers
2. Another volunteer claims the open shift within an hour
3. No guilt, no awkward texts -- the system handles it

### Feature Needs

**Critical:**
- Mobile-optimized shift calendar with one-tap claim and swap
- Push notifications for shift reminders and priority needs
- Quick check-in forms (30 seconds to log a restock)
- Activity feed to see what is happening across the network

**Important:**
- Volunteer hour tracking and acknowledgment
- Shift swap marketplace (post open shifts for others to claim)
- Read receipts on important announcements

---

## Persona 3: Linda, The Sympathizer (Passive Support)

### Profile
- **Name**: Linda Park, 52, accountant, occasional donor
- **Role**: Donates money and canned goods a few times a year, shares social media posts
- **Tech Level**: Low-Moderate (uses Facebook, email, basic phone apps)
- **Time Investment**: Less than 1 hour/month
- **Spectrum Position**: **Passive Support** -- believes in the mission but does not volunteer

### Goals and Motivations
- Feels good about supporting her neighbors but cannot commit regular time
- Wants to know her donations actually reach people who need them
- Prefers to give money rather than time -- her schedule is packed with work and family
- Would do more if she knew exactly what was needed and it was easy

### Pain Points
- Donated canned goods once but never heard what happened to them
- Does not want to join a group chat or attend meetings
- Overwhelmed by the idea of volunteering -- feels like an all-or-nothing commitment
- Not sure what the network actually needs beyond "food"

### BuildIt Journey

**First Contact:**
1. Sees Rosa's post on Nextdoor: "Northside Mutual Aid needs winter supplies"
2. Clicks link to public needs page -- no login required
3. Sees specific, concrete needs: "12 blankets, 20 hand warmers, $150 for propane" with progress bars
4. Donates $40 via linked payment, gets a thank-you notification

**Ongoing:**
1. Subscribes to monthly impact email: "This month we served 340 families across 6 locations"
2. Sees a holiday donation drive event -- drops off coats at a listed location (no RSVP needed)
3. Shares the network's public page with coworkers during a company giving campaign
4. Six months later, volunteers for a one-time Saturday food sort (low commitment, specific time)

### Feature Needs

**Critical:**
- Public needs page with specific, concrete requests and progress tracking
- No-login donation flow (give money or goods without creating an account)
- Impact updates (show donors what their contributions accomplished)

**Important:**
- One-time volunteer opportunities (not recurring commitments)
- Easy external sharing (post needs to social media, email to friends)
- Tax receipt generation for cash donations

---

## Persona 4: James, The Uninvolved (Neutral)

### Profile
- **Name**: James Okafor, 44, UPS driver, lives three blocks from a community fridge
- **Role**: No role -- does not know the mutual aid network exists
- **Tech Level**: Moderate
- **Time Investment**: 0 hours
- **Spectrum Position**: **Neutral** -- uninformed

### Goals and Motivations
- Focused on providing for his family -- works long hours, coaches his son's basketball team
- Would use a community fridge if he knew about it (his family has tight months)
- Would probably help stock it occasionally if asked by someone he trusts
- Cares about his neighborhood but does not know how to get involved

### Pain Points
- Has driven past the community fridge dozens of times without knowing what it is
- Assumes mutual aid is "for homeless people" -- does not see himself as the audience
- Would never seek out an organizing app on his own
- Distrusts anything that feels like charity -- does not want to be pitied

### BuildIt Journey

**Discovery:**
1. His neighbor DeShawn mentions the fridge: "It's for everyone. I grab stuff there too when I'm between checks"
2. James walks by, sees the fridge is clean, well-stocked, has a sign: "Take what you need, leave what you can"
3. Takes some produce home, mentions it to his wife
4. A few weeks later, brings extra from his garden and leaves it in the fridge

**Potential Activation:**
1. Sees a flyer at the fridge: "Want to help keep this stocked? Scan here"
2. Visits the public page, sees it is his neighbors running it -- not a charity
3. Downloads the app after a storm when the network mobilizes rapid relief for his block
4. Becomes a passive supporter, then occasionally volunteers when he has a free Saturday

### Feature Needs

**Critical:**
- Physical-world visibility (signage, QR codes at fridge locations)
- Public page that frames mutual aid as community reciprocity, not charity
- Frictionless first engagement (take food, leave food, no app required)

---

## Cross-Cutting Themes

### Privacy vs. Visibility
Mutual aid networks live in a productive tension between visibility and discretion. They need public-facing presence to attract donors, volunteers, and community members who need resources. But they also handle deeply sensitive information: undocumented families requesting help, people fleeing abuse, neighbors whose immigration status could be weaponized. BuildIt must support both a welcoming public face and ironclad privacy for sensitive coordination. Smart defaults matter here -- a resource request form should be encrypted by default, while a "fridge restocked!" photo should default to public.

### Engagement Ladder
The mutual aid engagement ladder is unusually porous. People flow between giving and receiving, volunteering and needing help, within the same month. James takes produce from the fridge in January and stocks it from his garden in July. Linda donates money in December and requests help with moving in March. BuildIt should not create rigid roles (donor vs. recipient vs. volunteer) but instead support fluid participation where everyone is both a contributor and a beneficiary.

| Level | Entry Point | First Action | Deepening |
|-------|-------------|--------------|-----------|
| Neutral | Walk past a fridge | Take or leave food | Read the sign, visit public page |
| Passive Support | See a social post | Donate money or goods | Subscribe to impact updates |
| Active Support | Claim a volunteer shift | Restock a fridge | Join coordination chat, bring a friend |
| Core Organizer | Propose a new location | Recruit 5 volunteers | Manage inventory, lead disaster response |

### Unique Security Considerations
- **City enforcement**: Health departments and zoning boards may cite or shut down community fridges. Documentation of food safety compliance should be maintained in the wiki but not publicly accessible to officials conducting enforcement sweeps
- **ICE and immigration enforcement**: Some community members requesting aid may be undocumented. Resource requests involving these individuals must be end-to-end encrypted with no metadata trails
- **Domestic violence**: Requests for shelter, supplies, or transportation for people fleeing abuse require the highest privacy settings and should be visible only to designated trusted coordinators
- **Donor privacy**: Some donors (especially those giving large amounts) may not want their generosity publicly linked to their identity
- **Overall threat level**: Low-Medium. Most mutual aid work is not surveilled, but specific situations (immigration, DV, city enforcement actions) can escalate quickly. BLE mesh capability is valuable during disaster response when cell infrastructure fails
