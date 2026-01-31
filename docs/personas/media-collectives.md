# BuildIt Personas: Media Collectives

**Date**: 2026-01-31
**Framework**: Training for Change's Spectrum of Support methodology
**Purpose**: Design features for editors, contributors, readers, and community members around independent and community media outlets

---

## Context

Independent media collectives -- community newspapers, investigative outlets, podcast networks, documentary crews, zine distros -- produce journalism and storytelling outside corporate media ownership. They serve communities that mainstream media ignores, covers poorly, or actively misrepresents. Their organizing needs center on editorial workflow, source protection, content syndication across allied outlets, and maintaining editorial independence under financial and political pressure. BuildIt serves as the secure coordination layer for editorial teams that cannot afford to have their source communications compromised or their unpublished investigations leaked.

---

## Persona 1: Amara, The Core Organizer (Active Support)

### Profile
- **Name**: Amara Osei, 33, editor-in-chief of a community investigative outlet covering police accountability and housing
- **Role**: Manages a team of 8 contributors (3 paid part-time, 5 volunteer), assigns stories, edits copy, coordinates publication schedule, maintains source relationships
- **Tech Level**: High (uses encrypted tools daily, understands metadata risks, has worked with sensitive documents)
- **Time Investment**: 35+ hours/week (this is her primary job, supplemented by grants and reader donations)
- **Spectrum Position**: **Active Support** -- drives the outlet's editorial direction and operations

### Goals and Motivations
- Publish investigative stories that hold powerful institutions accountable
- Protect sources at all costs -- some face retaliation, job loss, or criminal prosecution for talking
- Build a sustainable funding model that does not compromise editorial independence
- Syndicate stories to allied outlets to maximize impact
- Train the next generation of community journalists

### Pain Points
- Source communication is fragmented: some sources only use Signal, others insist on in-person meetings, one uses a burner email
- Editorial workflow is a mess of Google Docs, email threads, and Slack channels -- none of which are secure enough for sensitive stories
- A story about police overtime fraud required coordinating with 3 sources, a FOIA lawyer, a data analyst, and 2 fact-checkers across 5 different platforms
- A leaked draft of an investigation reached the subject before publication -- could not determine the source of the leak
- Syndication is manual: emailing PDFs to partner outlets, negotiating reprint permissions one by one
- Reader engagement beyond the website is minimal -- no community around the journalism

### BuildIt Journey

**Week 1: Outlet Setup**
1. Creates "Southside Chronicle" group with media collective template
2. Enables modules: Documents (editorial workflow), Wiki (style guide, source protocols, FOIA templates), CRM (source and contact management), Messaging, Governance
3. Creates subgroups by function: Editorial Board (governance), Investigation Teams (per-story), Contributors (general), and a Source Communications channel with maximum encryption
4. Sets up CRM with fields: Contact Type (source/contributor/funder/ally), Beat, Trust Level, Communication Preference, Last Contact
5. Imports style guide and editorial policies into wiki

**Week 2-8: Editorial Operations**
1. Assigns a housing investigation: creates an encrypted Investigation subgroup with only the reporter, editor, and fact-checker
2. Reporter communicates with sources through BuildIt's encrypted messaging -- no phone numbers exchanged, no metadata trail
3. Documents module tracks the story through stages: pitch, reporting, draft, edit, fact-check, legal review, publication
4. Fact-checker leaves inline comments on the draft; editor resolves them and approves
5. Legal review happens in a separate encrypted thread with the FOIA lawyer

**Month 3: Publication and Syndication**
1. Story approved for publication. Amara creates a syndication package: article text, photos, editor's note
2. Shares the package with 4 allied outlets via an encrypted syndication channel
3. Each outlet can republish with attribution -- tracked in the CRM
4. Reader discussion happens in a public comment thread (moderated, no account required to read)
5. Post-publication: sources are debriefed, CRM updated, investigation subgroup archived with encrypted records

### Feature Needs

**Critical:**
- Encrypted source communication with no metadata trail (NIP-17 gift wrapping essential)
- Editorial workflow in documents module (pitch, draft, edit, fact-check, legal review, publish)
- Per-story investigation subgroups with strict access control
- CRM for source management with trust levels and communication preferences
- Audit trail for document access (know who viewed what, when -- detect leaks)

**Important:**
- Syndication workflow (share publication-ready packages with allied outlets)
- Multi-identity support (reporters may need separate identities for different beats or sensitive stories)
- Secure document storage (FOIA responses, leaked documents, interview recordings)
- Editorial governance (editorial board votes on story priorities, budget allocation, ethics disputes)

**Nice-to-Have:**
- Public reader engagement (comments, discussion, community submissions)
- Fundraising integration (reader donations, grant tracking)
- Publication scheduling (queue stories, set embargo dates)
- Analytics on readership and syndication reach

---

## Persona 2: Kwame, The Committed Contributor (Active Support)

### Profile
- **Name**: Kwame Jackson, 27, freelance reporter covering police and criminal justice for the outlet
- **Role**: Reports 2-3 stories per month, maintains his own source network, attends editorial meetings
- **Tech Level**: High (uses encrypted communications, understands OPSEC basics from covering protests)
- **Time Investment**: 15-20 hours/week for the outlet (also freelances elsewhere)
- **Spectrum Position**: **Active Support** -- produces content consistently, invested in the outlet's mission

### Goals and Motivations
- Do meaningful journalism that creates accountability, not just content
- Protect his sources -- a police whistleblower and a city budget analyst who both face termination if identified
- Build his reputation as a journalist while maintaining personal safety
- Get paid fairly for his work (the outlet pays modestly but on time)

### Pain Points
- Juggles source communications across too many platforms -- needs a single secure channel per source
- Has received threats after publishing a story on police overtime; needs to separate his journalism identity from his personal identity
- Editorial feedback loop is slow -- submits a draft and waits days for comments scattered across email and chat
- No secure way to share raw documents (FOIA responses, court records) with the editor and fact-checker simultaneously

### BuildIt Journey

**Story Workflow:**
1. Pitches a story in the Editorial channel: "Tip from a source: city is diverting housing funds to police training facility"
2. Amara approves, creates an Investigation subgroup: Kwame (reporter), Amara (editor), Fatima (fact-checker)
3. Kwame communicates with his source exclusively through BuildIt encrypted DMs using a journalism-specific identity
4. Uploads FOIA documents to the investigation subgroup's secure document store
5. Writes draft in the documents module, tags Amara for edit and Fatima for fact-check
6. Receives inline comments, revises, and marks the story as ready for legal review
7. After publication, archives the investigation subgroup -- encrypted records preserved, active channels closed

**Identity Management:**
1. Maintains two BuildIt identities: "Kwame Jackson, Southside Chronicle" (public byline) and a pseudonymous identity for source communications
2. Sources communicate with the pseudonymous identity -- even if his public identity is compromised, source relationships are protected
3. Attends protests using a third identity for real-time reporting, separate from both

### Feature Needs

**Critical:**
- Multi-identity support with strong separation between identities
- Per-source encrypted channels (one secure thread per source relationship)
- Document collaboration within investigation subgroups (upload, comment, version)
- Editorial workflow integration (pitch, draft, edit, fact-check stages with notifications)

**Important:**
- Secure document storage with access logging
- Mobile-first reporting (file from the field, upload photos, post updates)
- Byline management (control what name appears on published work)

---

## Persona 3: Priya, The Sympathizer (Passive Support)

### Profile
- **Name**: Priya Sharma, 42, software engineer, loyal reader and monthly donor
- **Role**: Reads every issue, donates $15/month, shares articles on social media, does not contribute content
- **Tech Level**: High
- **Time Investment**: 2-3 hours/month reading and sharing
- **Spectrum Position**: **Passive Support** -- values the journalism, supports it financially, does not produce it

### Goals and Motivations
- Stay informed about local issues that mainstream media does not cover
- Support independent journalism financially because she believes it matters for democracy
- Share important stories with her network to amplify their impact
- Would contribute a guest piece or op-ed if asked, but would not volunteer unprompted

### Pain Points
- Donates monthly but has no idea how her money is used -- is the outlet sustainable?
- Wants to discuss articles with other readers but the website has no community features
- Has expertise (data analysis) that could help investigations but does not know how to offer it
- Shares articles on social media but gets no feedback on whether it made a difference

### BuildIt Journey

**Current Engagement:**
1. Reads the weekly newsletter, clicks through to articles
2. Shares a police accountability story on LinkedIn with her commentary
3. Donates monthly through the website

**Deepening:**
1. Sees a call in the newsletter: "Join the Southside Chronicle community on BuildIt"
2. Joins the public reader group -- sees discussion threads on recent stories, upcoming topics, and community submissions
3. Comments on an article about city budget data: "I can help analyze this dataset if you need it"
4. Amara reaches out via DM: "We'd love your help. Here's an encrypted channel with the investigation team"
5. Priya contributes data analysis for one story, gets acknowledged in the byline
6. Becomes a recurring contributor for data-heavy investigations

### Feature Needs

**Critical:**
- Reader community space (discuss articles, suggest stories, connect with journalists)
- Transparent impact reporting (how donations are used, what stories they funded)
- Easy sharing tools (formatted excerpts for social media with proper attribution)

**Important:**
- Skill-based contribution matching (readers can offer expertise: legal, data, translation)
- Guest contributor onboarding (low-friction path from reader to contributor)
- Donor recognition (optional, privacy-respecting acknowledgment)

---

## Persona 4: Victor, The Uninvolved (Neutral)

### Profile
- **Name**: Victor Dominguez, 55, small business owner, gets news from local TV and Facebook
- **Role**: Does not know independent community media exists in his city
- **Tech Level**: Low-Moderate
- **Time Investment**: 0 hours
- **Spectrum Position**: **Neutral** -- consumes mainstream media, unaware of alternatives

### Goals and Motivations
- Wants to know what is happening in his neighborhood, especially anything affecting his business
- Frustrated with local TV news coverage (sensationalized crime stories, no context)
- Would read community journalism if he stumbled across it and it felt credible
- Distrusts anything that looks like "activist media" -- wants facts, not ideology

### Pain Points
- Does not know where to find local investigative journalism
- Assumes "independent media" means blogs with opinions, not real reporting
- Will not seek out new information sources -- they need to come to him
- Needs journalism presented in a straightforward, professional format to take it seriously

### BuildIt Journey

**Discovery:**
1. A Southside Chronicle story about a rezoning plan that would affect his block gets shared on Facebook by a friend
2. Reads the article, finds it well-researched and directly relevant to his business
3. Clicks through to the outlet's public page, sees other stories about his neighborhood
4. Bookmarks the site, starts reading occasionally

**Potential Engagement:**
1. Signs up for the free weekly newsletter after reading a third article
2. Mentions the outlet to other business owners on his block
3. Six months later, donates $25 when the outlet does an annual fundraiser
4. Becomes a passive supporter who reads consistently and donates occasionally

### Feature Needs

**Critical:**
- Professional public presence (clean design, clear reporting, no jargon)
- Social media shareability (articles that look credible when shared on Facebook)
- Newsletter subscription (no account required)
- Local relevance (stories organized by neighborhood and topic)

---

## Cross-Cutting Themes

### Privacy vs. Visibility
Media collectives face a paradox: their product is public (published journalism), but their process must be private (source communications, unpublished investigations, editorial deliberations). This is not a spectrum -- it is a hard binary. Published work needs maximum visibility and shareability. Everything behind the publication boundary needs maximum encryption. BuildIt must enforce this boundary clearly: public reader community on one side, encrypted editorial operations on the other, with no accidental leakage between them. The documents module needs a clear "publication gate" -- content is encrypted and access-controlled until explicitly published, at which point it becomes shareable.

### Engagement Ladder
Media collective engagement follows a content consumption path that can deepen into participation and eventually production.

| Level | Entry Point | First Action | Deepening |
|-------|-------------|--------------|-----------|
| Neutral | See a shared article | Read it | Subscribe to newsletter |
| Passive Support | Read regularly | Donate or share | Join reader community |
| Active Support | Offer expertise | Contribute to one story | Become a regular contributor |
| Core Organizer | Join editorial board | Shape editorial direction | Manage investigations and syndication |

The critical transition is Reader to Contributor. Most readers assume journalism is done by professionals and their role is consumption. BuildIt's community features can surface opportunities for readers to contribute their expertise (legal knowledge, data skills, translation, neighborhood knowledge) without requiring them to become full-time journalists.

### Unique Security Considerations
- **Source protection**: This is the paramount security concern. Sources who speak to journalists about corruption, abuse, or illegal activity face retaliation ranging from job loss to criminal prosecution to physical violence. Source communications must use NIP-17 gift wrapping with no metadata trail. Multi-identity support is essential so that a compromised journalist identity does not expose source relationships
- **Unpublished material**: Draft investigations, leaked documents, FOIA responses, and interview recordings are high-value targets. A subject of investigation who obtains an unpublished draft can prepare counter-narratives, destroy evidence, or intimidate sources. Document access logging and strict subgroup access control are critical
- **Government pressure**: Journalists covering law enforcement, immigration, or national security may face subpoenas for source identities, unpublished material, or communication records. BuildIt's architecture must ensure that even if a device is seized, encrypted content cannot be decrypted without the user's keys. No server-side access to plaintext
- **Physical safety**: Journalists covering protests, police violence, or organized crime may face physical threats. Real-time encrypted communication during fieldwork and separation of journalism identity from personal identity are safety essentials
- **Editorial independence**: Funders, advertisers, or political allies may pressure editorial decisions. Governance module with transparent decision-making protects against hidden influence. Audit trails prove editorial independence
- **Content integrity**: Published work must be resistant to tampering and false attribution. Cryptographic signing of published content ensures readers can verify authenticity
- **Overall threat level**: Medium-High. Community media outlets covering police, housing, immigration, or corruption face real adversaries with resources and motivation to compromise their operations. Full encryption stack, multi-identity support, and source compartmentalization are essential. In contexts involving national security or organized crime coverage, threat level reaches Very High
