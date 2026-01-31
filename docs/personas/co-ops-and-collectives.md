# BuildIt Personas: Co-ops and Collectives

**Date**: 2026-01-31
**Framework**: Training for Change's Spectrum of Support methodology
**Purpose**: Design features for worker-owners, member-participants, casual members, and the broader community around cooperative enterprises

---

## Context

Worker cooperatives and consumer co-ops are democratically owned businesses where members share governance, profits, and decision-making. They range from small worker-owned cafes and bike shops to large consumer co-ops with thousands of member-owners. Their organizing needs center on consensus decision-making, financial transparency, member equity tracking, and sustaining democratic participation when people are busy running a business. BuildIt serves as the governance and coordination layer that makes cooperative democracy practical rather than exhausting.

---

## Persona 1: Tomoko, The Core Organizer (Active Support)

### Profile
- **Name**: Tomoko Sato, 41, worker-owner and board member at a 12-person worker-owned cooperative bakery
- **Role**: Manages governance processes, facilitates meetings, tracks member equity and profit-sharing
- **Tech Level**: High (runs the bakery's books, comfortable with complex tools)
- **Time Investment**: 15-20 hours/week on governance and coordination beyond her baking shifts
- **Spectrum Position**: **Active Support** -- drives the cooperative's democratic processes

### Goals and Motivations
- Ensure every worker-owner has a meaningful voice in business decisions
- Keep financial records transparent and accessible to all members without exposing them externally
- Run efficient meetings that respect everyone's time (they are all also working full shifts)
- Onboard new worker-owners smoothly through the 1-year candidacy process
- Build the cooperative model's reputation so other businesses consider converting

### Pain Points
- Meeting fatigue: monthly all-hands, weekly operations meetings, quarterly financials -- people stop showing up
- Consensus decision-making stalls on contentious issues (new product lines, wage structure, expansion)
- Financial transparency tools (QuickBooks, Google Sheets) are either too complex or not secure enough
- New member onboarding is a 47-page PDF nobody reads
- No good way to run asynchronous votes -- everything requires a meeting

### BuildIt Journey

**Week 1: Cooperative Setup**
1. Creates "Sunrise Bakery Co-op" group with cooperative governance template
2. Enables modules: Governance (proposals, voting, bylaws), Wiki (onboarding, policies, recipes), CRM (member tracking), Messaging, Documents
3. Sets up member profiles with fields: Equity Balance, Join Date, Candidacy Status, Committee Assignments, Voting Rights
4. Imports bylaws and operating agreement into wiki as living documents
5. Creates standing committees as subgroups: Finance, Operations, Hiring, Community Relations

**Week 2-8: Governance in Practice**
1. Posts first async proposal: "Should we add a gluten-free line? Budget impact: $3,200 startup cost"
2. Members discuss in threaded comments over 5 days -- no meeting required
3. Runs a formal consensus vote: 9 approve, 2 stand aside, 1 blocks with stated concern
4. Block triggers a "concern resolution" workflow: blocker posts their concern, discussion continues for 72 hours
5. Revised proposal passes with all 12 members consenting

**Month 3: Financial Governance**
1. Posts quarterly financials to the Finance committee subgroup (encrypted, member-eyes-only)
2. Members review revenue, expenses, and proposed profit distribution
3. Governance vote on profit allocation: 60% retained earnings, 25% member dividends, 15% community fund
4. Each member sees their individual equity statement updated automatically
5. Annual meeting agenda built collaboratively in a shared document

### Feature Needs

**Critical:**
- Governance module with formal consensus process (approve, stand aside, block with stated concern)
- Async proposal and voting system with configurable discussion periods
- Member equity tracking integrated with governance (voting rights tied to membership status)
- Encrypted financial documents visible only to current members
- Wiki for bylaws, policies, and procedures as living documents

**Important:**
- Committee subgroups with delegated decision-making authority
- Meeting agenda builder with collaborative editing
- Candidacy pipeline (track prospective members through the joining process)
- Audit trail for all governance decisions (who voted, when, what the outcome was)

**Nice-to-Have:**
- Financial dashboard (revenue trends, equity balances, profit distribution history)
- Roberts Rules or consensus process templates
- Integration with accounting software for automated financial reporting
- Public transparency page showing co-op's community impact

---

## Persona 2: Marco, The Committed Participant (Active Support)

### Profile
- **Name**: Marco Reyes, 29, worker-owner and baker, 2 years into membership
- **Role**: Active in meetings and votes, serves on the Hiring committee
- **Tech Level**: Moderate (uses his phone for most things, not a spreadsheet person)
- **Time Investment**: 3-5 hours/week on governance beyond his baking shifts
- **Spectrum Position**: **Active Support** -- participates consistently but does not lead governance

### Goals and Motivations
- Have a real say in how the business is run (this is why he left a corporate bakery job)
- Understand the financials well enough to vote responsibly
- Help hire new worker-owners who share the cooperative values
- Not spend his entire life in meetings -- he became a baker to bake

### Pain Points
- Financial reports are dense and hard to parse without an accounting background
- Missed one meeting and lost context on a proposal that affected his schedule
- Consensus process feels slow when he has a strong opinion and wants to move forward
- Committee work is rewarding but can feel like unpaid overtime

### BuildIt Journey

**Typical Week:**
1. Gets push notification: "New proposal: Adjust summer hours. Discussion open for 5 days"
2. Reads the proposal on his phone during a break, leaves a comment with his concern about childcare scheduling
3. Sees 3 other members echo his concern -- Tomoko revises the proposal
4. Votes "approve" on the revised version from his phone
5. Checks the Hiring committee channel: 2 new applicants to review before Thursday's meeting

**Monthly Rhythm:**
1. Attends the all-hands meeting, which has a pre-built agenda he can review in advance
2. Reviews the financial summary (simplified version with key metrics highlighted)
3. Participates in the profit distribution vote
4. Updates his committee notes in the wiki after the Hiring meeting

### Feature Needs

**Critical:**
- Mobile-friendly proposal review and voting (do governance from his phone)
- Push notifications for new proposals, upcoming votes, and meeting reminders
- Simplified financial summaries (key metrics, not raw spreadsheets)
- Threaded discussion on proposals (follow a conversation without attending a meeting)

**Important:**
- Meeting agenda preview (know what is being discussed before showing up)
- Catch-up view (what happened while I was away -- decisions made, proposals posted)
- Committee task tracking (who is reviewing which applicant)

---

## Persona 3: Nadia, The Sympathizer (Passive Support)

### Profile
- **Name**: Nadia Petrova, 34, regular customer and consumer member of a food co-op
- **Role**: Pays annual membership dues, shops weekly, does not attend meetings or vote
- **Tech Level**: Moderate
- **Time Investment**: Less than 1 hour/month on co-op participation (beyond shopping)
- **Spectrum Position**: **Passive Support** -- believes in co-ops, does not participate in governance

### Goals and Motivations
- Access high-quality local and organic food at member prices
- Support the cooperative model in principle -- prefers co-ops over corporate chains
- Would engage more if she understood what the co-op actually needed from her
- Does not want to attend a 3-hour board meeting to have a voice

### Pain Points
- Gets the quarterly newsletter but skims it -- too long, too much jargon
- Received a ballot for the board election but did not vote because she did not know the candidates
- Feels like governance is for "the serious people" and her input would not matter
- Heard rumors about a controversial expansion plan but could not find clear information

### BuildIt Journey

**Current State:**
1. Shops at the co-op every Saturday, swipes her member card for the discount
2. Sees a poster in the store: "Your co-op, your voice. Scan to participate"
3. Scans the QR code, lands on a public page showing the co-op's current priorities and open votes
4. Reads a 2-minute summary: "Should we open a second location? Here's what it means for prices and member equity"

**Activation Path:**
1. Votes in the expansion proposal from her phone -- her first governance participation in 4 years of membership
2. Gets a notification: "Your vote counted! Results: 67% approve. Next step: site selection committee forming"
3. Sees a "micro-volunteer" opportunity: "Taste-test 3 new local products and give feedback (15 minutes)"
4. Completes the taste test at the store, feels her opinion matters
5. Six months later, nominates herself for the board after attending a casual "meet the board" social event

### Feature Needs

**Critical:**
- Simplified voting interface (vote on proposals without attending meetings)
- Plain-language proposal summaries (what is this about, what does it mean for me)
- QR code access to governance from physical co-op locations

**Important:**
- Micro-participation opportunities (surveys, taste tests, feedback forms)
- Candidate profiles for board elections (who are these people, what do they stand for)
- Impact visibility (how member dues and purchases support the community)

---

## Persona 4: Greg, The Uninvolved (Neutral)

### Profile
- **Name**: Greg Morrison, 50, lives near a worker-owned cafe, has never been to a cooperative
- **Role**: No role -- does not know the difference between a co-op and a regular business
- **Tech Level**: Low-Moderate
- **Time Investment**: 0 hours
- **Spectrum Position**: **Neutral** -- unaware of the cooperative model

### Goals and Motivations
- Wants good coffee at a fair price -- does not think about business structure
- Would be interested in the cooperative model if someone explained it in concrete terms
- Might consider joining a consumer co-op if the benefits were clear and tangible
- Skeptical of anything that sounds ideological or political

### Pain Points
- Assumes co-ops are hippie grocery stores or commune experiments
- Does not understand how worker ownership works or why it matters to him as a customer
- Would never download an app for a business he patronizes casually
- Needs to see a direct personal benefit before investing any attention

### BuildIt Journey

**Discovery:**
1. Walks into Sunrise Bakery, notices the "worker-owned" sign, thinks "huh, interesting"
2. Barista mentions: "We all own this place together -- that's why we actually care about the bread"
3. Picks up a card at the register: "Want to know what worker ownership means? Visit our story page"
4. Reads a 1-minute page: how profits are shared, how decisions are made, why the bread is better

**Potential Engagement:**
1. Sees the co-op is hosting a community bread-baking class (public event, no membership required)
2. Attends, meets the worker-owners, hears their stories
3. Starts shopping there intentionally instead of at the chain down the street
4. Considers joining the consumer membership for the 10% discount

### Feature Needs

**Critical:**
- Public story page explaining the cooperative model in plain, non-ideological language
- Public events visible without an account (classes, open houses, community meals)
- Clear value proposition for potential members (what do I get, what does it cost)

---

## Cross-Cutting Themes

### Privacy vs. Visibility
Cooperatives have a unique transparency dynamic. Internally, radical transparency is a core value -- every member should be able to see the books, understand the decisions, and access the same information. Externally, financial details and internal disagreements should remain private. BuildIt must support both: encrypted financial documents and governance discussions for members only, alongside a compelling public face that attracts new members and customers. The key boundary is membership status -- verified members see everything, the public sees the story and the invitation.

### Engagement Ladder
Cooperative engagement follows a formal structure more than most organizing contexts. There are legally defined membership classes, candidacy periods, and voting rights. But within that structure, the challenge is the same: getting people to participate meaningfully rather than just holding a membership card.

| Level | Entry Point | First Action | Deepening |
|-------|-------------|--------------|-----------|
| Neutral | Visit the business | Read the "worker-owned" sign | Attend a public event |
| Passive Support | Buy a membership | Shop regularly | Vote in one proposal |
| Active Support | Attend a meeting | Serve on a committee | Mentor a candidate member |
| Core Organizer | Run for the board | Facilitate consensus | Shape long-term strategy |

The critical transition is Passive to Active: moving members from "I pay dues and shop here" to "I participate in governance." BuildIt addresses this by making governance accessible from a phone, breaking proposals into plain language, and offering micro-participation opportunities that build the habit of engagement.

### Unique Security Considerations
- **Financial privacy**: Cooperative financials (revenue, expenses, individual equity balances, wages) must be encrypted and accessible only to current members in good standing. A disgruntled former member or competitor should not be able to access this data
- **Governance integrity**: Votes must be verifiable and tamper-resistant. Members need confidence that results reflect actual votes. Audit trails are essential for legal compliance and internal trust
- **Internal disputes**: Cooperatives can have intense internal conflicts about direction, spending, and values. Governance discussions should be encrypted to prevent airing dirty laundry publicly, while still being transparent to all members
- **Competitor intelligence**: In competitive markets, operational details (supplier relationships, pricing strategies, expansion plans) shared in internal discussions could be valuable to competitors
- **Overall threat level**: Low-Medium. Cooperatives rarely face state surveillance, but financial data exposure, governance manipulation, and competitive espionage are real concerns. Standard encryption and membership-gated access suffice for most scenarios
