/**
 * Wiki Module Seed Data
 * Provides example/template data for the wiki module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBWikiPage } from './schema';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

import { logger } from '@/lib/logger';
/**
 * Seed data for wiki module
 */
export const wikiSeeds: ModuleSeed[] = [
  {
    name: 'comprehensive-wiki-pages',
    description: 'Comprehensive wiki starter pages with organizing resources',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();

      const examplePages: DBWikiPage[] = [
        // GETTING STARTED
        {
          id: `wiki-welcome-${groupId}`,
          groupId,
          title: 'Welcome to Our Wiki',
          content: `# Welcome to Our Wiki 📚

This is your group's collaborative knowledge base. Use this space to document strategies, share skills, and build institutional memory.

## What's This For?

Our wiki serves multiple purposes:
- **Knowledge Sharing**: Document best practices and lessons learned
- **Onboarding**: Help new members get up to speed
- **Resource Library**: Centralize important information
- **Strategic Documentation**: Record decisions and rationales

## How to Use

- **Browse by Category**: Navigate pages using categories in the sidebar
- **Search**: Use the search bar to find specific information
- **Edit Pages**: Click "Edit" to update any page (all changes are tracked)
- **Create Pages**: Click "New Page" to add content
- **Link Pages**: Use [[Page Title]] to link between pages

## Getting Started

Check out these key pages:
- [[Code of Conduct]] - Our community guidelines
- [[Security Culture Guide]] - Protecting ourselves and each other
- [[Organizing Toolkit]] - Essential organizing resources
- [[Meeting Protocols]] - How we run effective meetings

Remember: Everything here is version controlled. Don't worry about breaking things - we can always revert changes!

✊ Power to the people!`,
          category: 'Getting Started',
          tags: ['welcome', 'documentation', 'guide'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },

        // COMMUNITY GUIDELINES
        {
          id: `wiki-coc-${groupId}`,
          groupId,
          title: 'Code of Conduct',
          content: `# Code of Conduct

Our community is dedicated to providing a harassment-free, empowering experience for everyone.

## Our Principles

**Liberation & Solidarity**
- We center the voices of those most impacted
- We practice mutual aid and collective care
- We recognize that our liberation is bound together

**Respect & Safety**
- We create brave spaces for vulnerability and growth
- We challenge oppressive behavior and systems
- We hold each other accountable with compassion
- We respect boundaries and consent

**Inclusion & Access**
- We welcome all genders, sexualities, races, abilities, and backgrounds
- We make our spaces as accessible as possible
- We use inclusive language and practices
- We recognize and challenge our privileges

## Unacceptable Behavior

We do not tolerate:
- Harassment, discrimination, or oppressive behavior
- Violations of consent or boundaries
- Racist, sexist, homophobic, transphobic, or ableist language/actions
- Doxxing, threats, or intimidation
- Collaboration with police or oppressive institutions
- Disruption of group spaces or actions

## Accountability Process

If harm occurs:
1. **Immediate safety**: Prioritize safety of affected parties
2. **Conflict resolution committee**: Trained members facilitate process
3. **Restorative justice**: Focus on repair and transformation, not punishment
4. **Community input**: Collective decision-making when appropriate
5. **Removal as last resort**: Only when safety cannot be ensured

## Reporting

Report concerns to:
- Any moderator or admin
- The conflict resolution committee
- Anonymous form: [link to form]

All reports handled with care and confidentiality.`,
          category: 'Community',
          tags: ['code-of-conduct', 'community', 'guidelines', 'accountability'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },

        // SECURITY
        {
          id: `wiki-security-${groupId}`,
          groupId,
          title: 'Security Culture Guide',
          content: `# Security Culture Guide 🔒

Security culture protects our movements from surveillance, infiltration, and repression.

## Core Principles

**Need-to-Know Basis**
- Only share sensitive information with those who need it
- Don't gossip about actions, participants, or strategies
- Respect operational security (OpSec)

**Digital Security**
- Use encrypted apps: Signal, Element, this platform
- Avoid SMS/regular calls for sensitive topics
- Use Tor when needed
- Practice good password hygiene
- Regular security audits

**Physical Security**
- Be aware of surveillance (cameras, license plates)
- Careful who you bring to meetings/actions
- Secure meeting spaces
- Know your rights when dealing with police

## What NOT to Do

❌ Don't:
- Post about actions before they happen
- Tag people in photos without permission
- Share plans on unsecured platforms
- Bring phones to high-risk actions (or put in airplane mode + faraday bag)
- Talk about sensitive matters in public
- Keep unnecessary records/photos of actions

## What TO Do

✅ Do:
- Verify people's identities carefully
- Use secure communication tools
- Have a security buddy system
- Practice counter-surveillance
- Document police violence (legally & safely)
- Know emergency contacts & legal support numbers

## For Actions

**Before**
- Action planning in secure spaces
- Role assignments on need-to-know
- Legal support & jail support ready
- Medical support identified
- Know your rights training

**During**
- Minimize phone use
- Don't film fellow activists' faces
- Buddy system for safety
- Know jail support number

**After**
- Debrief in secure space
- Document police behavior (not our tactics)
- Support those facing charges
- Learn and adapt

## Remember

Security culture isn't paranoia - it's community care. We protect each other.`,
          category: 'Security',
          tags: ['security', 'opsec', 'digital-security', 'action-planning'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },

        // ORGANIZING RESOURCES
        {
          id: `wiki-toolkit-${groupId}`,
          groupId,
          title: 'Organizing Toolkit',
          content: `# Organizing Toolkit 🛠️

Essential resources for effective organizing.

## Power Mapping

Understand who has power and how to build counter-power.

**Questions to Ask:**
- Who makes decisions?
- Who is impacted?
- Who are potential allies?
- Where are leverage points?
- What are their interests?

**Tools:**
- Stakeholder maps
- Power analysis matrices
- Network diagrams

## Campaign Planning

**Elements of a Strong Campaign:**
1. **Clear goal** - Specific, winnable, build power
2. **Target** - Who can give you what you want?
3. **Strategy** - Theory of how to win
4. **Tactics** - Specific actions to execute strategy
5. **Timeline** - Milestones and deadlines

**Campaign Arc:**
- Research & analysis
- Build base & leadership
- Escalating tactics
- Negotiation or direct action
- Victory or next phase

## Coalition Building

**Best Practices:**
- Share power, not just tasks
- Follow leadership of most impacted
- Clear decision-making processes
- Regular communication
- Celebrate wins together

## Direct Action

**Types:**
- Protests & marches
- Sit-ins & occupations
- Blockades
- Strikes
- Boycotts
- Civil disobedience

**Planning Checklist:**
- Legal support arranged
- Medical support ready
- De-escalation team trained
- Media strategy prepared
- Jail support on standby
- Know your rights training completed

## Digital Organizing

**Platforms:**
- This app for secure coordination
- Social media for outreach
- Email lists for broad updates
- Video calls for remote meetings

**Tips:**
- Meet people where they are
- Hybrid online/offline organizing
- Accessible to all skill levels
- Security-conscious always

## Resources

**Books:**
- Rules for Radicals - Saul Alinsky
- Organize! - Jane McAlevey
- How We Win - George Lakey

**Training:**
- [Link to training resources]

**Legal Support:**
- National Lawyers Guild
- Local legal collective

Remember: We keep us safe! 🤝`,
          category: 'Resources',
          tags: ['organizing', 'toolkit', 'strategy', 'tactics', 'training'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },

        // MEETING PROTOCOLS
        {
          id: `wiki-meetings-${groupId}`,
          groupId,
          title: 'Meeting Protocols',
          content: `# Meeting Protocols

How we run effective, inclusive meetings.

## Meeting Roles

**Facilitator**
- Guide discussion
- Keep to agenda & time
- Ensure everyone can participate
- Stay neutral on content

**Note-Taker**
- Document key points & decisions
- Capture action items
- Share notes after meeting

**Timekeeper**
- Track agenda timing
- Give time warnings
- Help group stay on schedule

**Vibes Watcher**
- Monitor group energy
- Suggest breaks
- Note when voices are missing

## Meeting Structure

**Opening (5 min)**
- Welcome & land acknowledgment
- Review agenda
- Assign roles
- Community agreements reminder

**Main Content (varies)**
- Follow agenda
- Discussion & decision-making
- Action item assignment

**Closing (10 min)**
- Review decisions & action items
- Appreciations/shout-outs
- Next meeting logistics

## Participation Guidelines

**Stack**
- Raise hand to get on stack
- Facilitator calls on people in order
- Prioritize those who haven't spoken

**Step Up, Step Back**
- If you talk a lot: step back
- If you're quiet: step up
- Make space for all voices

**Progressive Stack**
- Prioritize marginalized voices
- Those most impacted speak first

**Direct Response**
- Quick clarification or response
- Don't use to dominate

## Decision-Making

See [[Governance]] module for voting methods.

**Consensus Process:**
1. Proposal presented
2. Clarifying questions
3. Discussion & concerns
4. Amendments
5. Consensus test
6. Resolution

**Blocking:**
- Only block if fundamental disagreement
- Explain reasoning
- Suggest alternatives
- Group works to address concerns

## Accessibility

- Quiet space for those who need it
- Clear speaking (pace, volume)
- Minimize cross-talk
- Visual & verbal announcements
- Childcare provided when possible
- Scent-free space
- ASL interpreter (arrange in advance)

## Virtual Meetings

- Mute when not speaking
- Use raise hand feature
- Chat for questions/comments
- Record if agreed upon (security considerations)

## Remember

Good meetings build power and relationships! 💪`,
          category: 'Governance',
          tags: ['meetings', 'facilitation', 'decision-making', 'protocols'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },

        // LEGAL RESOURCES
        {
          id: `wiki-legal-${groupId}`,
          groupId,
          title: 'Know Your Rights',
          content: `# Know Your Rights

Legal information for activists (consult a lawyer for legal advice).

## Your Basic Rights (U.S.)

**1st Amendment**
- Right to protest
- Freedom of speech
- Freedom of assembly

**4th Amendment**
- Protection from unreasonable search
- Need warrant or probable cause

**5th Amendment**
- Right to remain silent
- Right against self-incrimination

**6th Amendment**
- Right to an attorney
- Right to speedy, public trial

## When Stopped by Police

**Say:**
- "I am going to remain silent."
- "I want to speak to a lawyer."
- "I do not consent to a search."

**Don't:**
- Answer questions
- Consent to searches
- Resist physically
- Run away

**Do:**
- Stay calm
- Keep hands visible
- Ask "Am I free to go?"
- Record if safe (know local laws)

## If Arrested

1. **Remain silent** - Anything you say can be used against you
2. **Ask for a lawyer** - Clearly and repeatedly
3. **Don't sign anything** - Without lawyer review
4. **Don't make deals** - Without lawyer present
5. **Document everything** - Write down details when safe

## Jail Support

**Before Action:**
- Know jail support number
- Write number on body (in marker)
- Know your rights

**If Someone's Arrested:**
- Call jail support immediately
- Document badge numbers, time, location
- Do NOT call their phone
- Notify legal collective

**Jail Support Duties:**
- Track who's arrested
- Coordinate legal support
- Arrange bail if needed
- Welcome people when released
- Provide support & care

## Legal Support Contacts

**National:**
- National Lawyers Guild: [number]
- ACLU: [number]

**Local:**
- [Local legal collective]
- [Emergency legal hotline]

**Resources:**
- EFF surveillance self-defense
- NLG know your rights guides

## Important Notes

⚠️ **This is not legal advice** - Consult a lawyer for your specific situation
⚠️ **Laws vary** - Know your local laws
⚠️ **Rights apply differently** - Undocumented folks, minors have different considerations

## Remember

You have the right to remain silent and you should use it! 🤐`,
          category: 'Legal',
          tags: ['legal', 'rights', 'police', 'arrest', 'jail-support'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
          isPublic: false,
          indexability: DEFAULT_INDEXABILITY,
        },
      ];

      await db.wikiPages?.bulkAdd(examplePages);
      logger.info(`Seeded ${examplePages.length} comprehensive wiki pages for group ${groupId}`);
    },
  },
];
