# BuildIt Design Philosophy

**The ground we stand on.**

---

## Why This Document Exists

BuildIt is not a product. It is infrastructure for liberation.

That is not a marketing claim. It is a design constraint. Every architectural
decision, every protocol choice, every interaction pattern must be evaluated
against a single question: *Does this serve the people who are organizing for
their collective freedom?*

To answer that question honestly, we have to understand who those people are,
where they come from, and what they have already built. Organizers did not
start organizing when apps were invented. They have been doing this work for
centuries -- in factories, in fields, in prisons, in mountains, in kitchens,
in churches, in secret. They developed methodologies, structures, security
practices, educational systems, and governance models under conditions of
extraordinary danger. Many of them were killed for it.

BuildIt inherits from those traditions. Not as decoration. Not as branding.
As structural commitments embedded in the architecture of the platform. When
we say "local-first," we are not describing a technical preference -- we are
describing what it means to organize when the state shuts down the internet.
When we say "end-to-end encrypted," we are not describing a feature -- we are
describing what it takes to keep organizers alive.

This document names the traditions we draw from and explains how they inform
the purpose and use of this platform. It is written for every contributor --
human or machine -- so they understand not just what BuildIt does, but why it
exists and whose struggles it carries forward.

---

## The Lineage

BuildIt does not emerge from Silicon Valley. It emerges from a global history
of people organizing under conditions of repression, building the
infrastructure of collective liberation with whatever materials they had.

We learn from all of them. Not to cherry-pick quotes for a README, but to
understand -- ethnographically, materially, honestly -- what organizing
requires, what conditions organizers face, and what tools actually serve them.

### The Material Analysis

Dialectical materialism teaches us to start from concrete conditions, not
abstractions. The people BuildIt serves are not "users" in the product sense.
They are workers facing retaliation for organizing. They are tenants facing
eviction for demanding repairs. They are indigenous communities defending
their land. They are journalists protecting sources under authoritarian
regimes. They are mutual aid networks feeding people during disasters. They
are prisoners communicating with legal defense. They are refugees coordinating
survival.

Their material conditions shape what they need from a platform:

- They often cannot trust the network. Organizers in Hong Kong, Myanmar,
  Belarus, Iran, and countless other places have watched governments shut down
  the internet during uprisings. BLE mesh is not a novelty -- it is a
  material necessity.

- They often cannot trust the server. Every centralized platform -- Slack,
  WhatsApp, Telegram, Google -- has complied with government requests to
  expose organizer data. Zero-knowledge architecture is not a philosophy --
  it is a survival strategy.

- They often cannot trust the device. Devices get seized at borders, at
  protests, in raids. Encryption at rest, duress passwords, and rapid data
  destruction are not edge cases -- they are core requirements for the most
  vulnerable users.

- They often cannot trust each other completely. COINTELPRO taught us that
  any organization can be infiltrated. The FBI informant William O'Neal was
  Fred Hampton's head of security when he provided the floor plan used to
  assassinate Hampton in his bed. Compartmentalized access, cell-based
  communication, and need-to-know architecture are not paranoia -- they are
  the lessons written in blood by every movement that was betrayed from within.

We begin from these conditions. Not from user personas in a design sprint.
From the actual, material, life-and-death conditions of organizing.

### Pedagogy of the Oppressed

Paulo Freire showed us that education is never neutral. It either domesticates
or liberates. His distinction between "banking education" -- where knowledge
is deposited into passive receivers -- and "problem-posing education" -- where
learners and teachers investigate reality together through dialogue -- is
foundational to how BuildIt approaches onboarding, knowledge sharing, and
political education.

Freire wrote: *"Knowledge emerges only through invention and re-invention,
through the restless, impatient, continuing, hopeful inquiry human beings
pursue in the world, with the world, and with each other."*

A platform that treats new members as empty vessels to be filled with
information reproduces the banking model. A platform that invites them into
dialogue -- that lets them explore, ask questions, contribute their own
knowledge, and learn alongside others -- practices liberation.

Freire's concept of *conscientization* -- the development of critical
consciousness through the cycle of reflection and action (*praxis*) -- means
that learning cannot be separated from doing. A knowledge base that is merely
a repository is banking education. A knowledge base that connects what you
learn to what you do, and what you do to what you learn next, is praxis.

*"The teacher is no longer merely the-one-who-teaches, but one who is
himself taught in dialogue with the students, who in turn while being taught
also teach."* -- Paulo Freire, *Pedagogy of the Oppressed* (1970)

### Engaged Pedagogy and the Practice of Freedom

bell hooks extended Freire's work, insisting that education must engage the
whole person -- not just the intellect but the body, the emotions, the spirit.
She called this "engaged pedagogy" and argued that it required vulnerability,
honesty, and genuine care from everyone involved.

hooks wrote: *"To educate as the practice of freedom is a way of teaching
that anyone can learn."* -- *Teaching to Transgress* (1994)

She also insisted on centering those at the margins: *"To be in the margin
is to be part of the whole but outside the main body."* -- *Feminist Theory:
From Margin to Center* (1984). The people most affected by a system are the
ones who understand it most clearly. Centering their knowledge is not charity
-- it is strategic.

For BuildIt, this means the platform must be designed *with* and *by* the
communities it serves, not *for* them. It means the most marginalized users
-- not the most technically sophisticated -- define what "usable" means. And
it means love and care are not soft values layered on top of functionality.
They are structural requirements.

hooks also gave us the concept of "beloved community" -- not as utopia, but
as daily practice: *"The moment we choose to love we begin to move against
domination, against oppression. The moment we choose to love we begin to move
towards freedom."* -- *All About Love* (2000)

### The Mass Strike and Rank-and-File Democracy

Rosa Luxemburg studied the 1905 Russian Revolution and concluded that mass
strikes are not events to be called by leaders -- they are organic
processes that emerge from accumulated grievances and existing networks of
solidarity. She wrote:

*"The mass strike is not artificially 'made,' not 'decided' at random, not
'propagated,' but rather it is a historical phenomenon which, at a given
moment, results from social conditions with historical inevitability."*
-- *The Mass Strike* (1906)

This is critical for how BuildIt approaches mass action coordination. The
platform cannot and should not try to "manage" a general strike from the
top down. What it can do is provide the infrastructure that lets organic
networks of solidarity communicate, coordinate, and act when the moment
arrives. The tools must support both the long accumulation of relationships
and the sudden eruption of collective action.

Luxemburg also insisted on the inseparability of democracy and revolution:
*"Freedom only for the supporters of the government, only for the members
of one party -- however numerous they may be -- is no freedom at all.
Freedom is always and exclusively freedom for the one who thinks
differently."* -- *The Russian Revolution* (1918)

Governance tools that silence minority voices are not democratic. Consensus
processes that suppress dissent are not consensus. BuildIt's governance
modules must protect the right to disagree, to propose alternatives, to
dissent from the majority -- because movements that cannot tolerate internal
disagreement become brittle and authoritarian.

### Self-Reliance and Sovereignty

Thomas Sankara governed Burkina Faso for four years and demonstrated what
practical, material transformation looks like: 2.5 million children
vaccinated, 10 million trees planted, 350 schools built, mass literacy
campaigns, land redistribution, women's rights legislation -- all without
foreign aid dependency. His principle was unambiguous:

*"He who feeds you, controls you."*

Applied to technology: every corporate platform organizers depend on is a
dependency that can be weaponized against them. Google can close your account.
Slack can hand your messages to law enforcement. WhatsApp can change its
privacy policy. Zoom can censor your meeting. Reliance on these platforms is
structural subordination.

BuildIt exists so that communities own their own infrastructure. Local-first
data. Self-hostable relays. Open protocol. BLE mesh that requires no
corporate infrastructure at all. Sankara built roads with community labor
rather than accept foreign loans with strings attached. BuildIt builds
communication infrastructure that communities control rather than accept
corporate platforms that extract data in exchange for convenience.

Amilcar Cabral reinforced this with his insistence on rigorous honesty:

*"Hide nothing from the masses of our people. Tell no lies. Expose lies
whenever they are told. Mask no difficulties, mistakes, failures. Claim no
easy victories."* -- Directives to PAIGC cadres, *Unity and Struggle*

A platform that inflates metrics, that hides failures, that presents vanity
numbers instead of honest assessments of organizing strength, betrays the
people who use it. BuildIt shows real numbers. Real sync status. Real
participation. The SchemaStatusCard shows actual version state, not a
progress bar that fills up to make you feel good. Cabral would have demanded
nothing less.

Patrice Lumumba's life and assassination demonstrate the ultimate stakes of
communication sovereignty. Belgian and American intelligence intercepted his
communications, tracked his movements, and coordinated his murder. The
threat model for this platform is not hypothetical. It is historical. People
have been killed because the wrong people could read their messages.

*"The day will come when history will speak. But it will not be the history
they teach in Brussels, Paris, Washington, or the United Nations."*
-- Patrice Lumumba, final letter (1961)

Communities must be able to tell their own stories, in their own words,
preserved in their own archives, beyond the reach of those who would rewrite
their history. This is what end-to-end encrypted publishing, local-first
storage, and community-owned relays are for.

### A World Where Many Worlds Fit

The Zapatistas built functioning autonomous governance in Chiapas -- schools,
clinics, courts, cooperatives -- while rejecting both state power and the
idea that there is only one way to organize. Their motto:

*"Un mundo donde quepan muchos mundos."* -- A world where many worlds fit.

This is the deepest principle behind BuildIt's modular architecture. A labor
union organizing a shop floor has different needs than a mutual aid network
coordinating disaster response. A media collective running an editorial
workflow has different needs than a tenant union preparing a rent strike. A
community defense network has different needs than a cooperative running
democratic governance. The platform must serve all of them without forcing
any of them into a single model.

The Zapatista governance structure -- community assemblies electing municipal
councils electing regional *juntas de buen gobierno*, with rotation,
revocability, and the principle of *mandar obedeciendo* ("to lead by
obeying") -- is a working demonstration that another governance is possible.
Not hypothetical. Functioning. For three decades now.

*"Here the people command, and the government obeys."*

Comandanta Ramona, an indigenous Tzotzil woman, was instrumental in drafting
the Women's Revolutionary Law -- adopted *before* the 1994 uprising. The
internal transformation preceded the external one. This is prefigurative
politics: you build the world you want within your own structures first.

*"We are here, we who are the color of the earth. We exist."*
-- Comandanta Ramona, National Indigenous Congress

The Zapatista principle *"preguntando caminamos"* -- "asking, we walk" --
rejects the vanguardist model where leaders dictate direction. The path
emerges through collective questioning. Software that prescribes workflows
contradicts this. Software that provides flexible infrastructure for
communities to discover their own paths embodies it.

### Autonomous Organizing Within the Struggle

Mujeres Libres -- the Free Women of Spain -- organized 20,000 women during
the Spanish Civil War, building literacy programs, vocational training,
childcare collectives, and health education while bombs fell. They insisted
on organizational autonomy from the broader anarchist movement -- not
because they opposed it, but because mixed spaces consistently marginalized
women's concerns.

Mercedes Comaposada wrote: *"We did not want to create a separate movement.
We wanted to develop within the libertarian movement the energy, the
strength, the awareness of women. But to do that, we needed our own space."*

Their educational philosophy was radical: *"Culture must be captivating. It
must draw people in through beauty, through curiosity, through the pleasure
of understanding."* -- Lucia Sanchez Saornil

And their fundamental principle -- shared with the IWW and the Zapatistas --
was that means must be consistent with ends: *"You cannot use authoritarian
means to achieve libertarian ends."* This is perhaps the single most
important design principle for BuildIt. The platform must embody in its
architecture the world its users are trying to build.

BuildIt must support autonomous spaces within larger organizations -- caucuses,
affinity groups, working committees -- with their own encrypted communication
channels inaccessible to the parent organization's administrators. This is
not a privacy bug. It is the Mujeres Libres model made digital.

### Survival Programs as Organizing

The Black Panther Party operated over 60 Survival Programs -- Free Breakfast
for Children, Free Health Clinics, Free Clothing, Free Legal Aid, Liberation
Schools -- serving tens of thousands of people daily across dozens of cities.
These were not charity. They were organizing infrastructure.

Huey P. Newton: *"Survival programs are not revolutionary in themselves...
They are designed to help the people survive until their consciousness is
raised, which is only the first step in the revolution."*

Fred Hampton: *"You don't fight racism with racism, the best way to fight
racism is with solidarity. We say you don't fight capitalism with Black
capitalism. You fight capitalism with socialism."*

Hampton built the original Rainbow Coalition -- uniting the Black Panther
Party with the Young Patriots Organization (poor white Appalachians) and
the Young Lords (Puerto Rican revolutionaries). He found common ground not
by lecturing about ideology but by starting with shared material conditions:
your kids are hungry. Your landlord is stealing from you. The police are
beating you. The same people doing this to you are doing it to us.

This is the Spectrum of Support in practice, decades before it was formalized
as a framework. You meet people where they are. You address their immediate
needs. You build relationships through consistent service. And through those
relationships, consciousness grows. The person who comes for breakfast stays
for political education. The person who comes for a clinic visit joins the
community patrol.

For BuildIt, this means mutual aid is not a separate module -- it is the
primary organizing tool. Every act of resource sharing is simultaneously a
relationship-building event, a consciousness-raising opportunity, and a
demonstration that another way of living is possible.

### The Shop Floor and the Streets

The League of Revolutionary Black Workers -- growing out of DRUM (Dodge
Revolutionary Union Movement) and the wildcat strikes at Detroit's auto
plants -- demonstrated that workplace organizing and community organizing
are inseparable. General Baker put it simply:

*"We saw that the problems of Black workers in the plants were tied to the
problems of Black people in the community, and both were tied to the system
of capitalism and imperialism."*

Mike Hamlin on methodology: *"You organize people around their immediate
self-interest, but you educate them about the larger picture. You can't
just hand someone a leaflet about imperialism at the plant gate. But you
can show them how the speedup on their line connects to corporate profits
that fund wars abroad."*

The LRBW organized at three levels simultaneously: the immediate grievance
(unsafe conditions, racist foremen), the institutional structure (the union
bureaucracy), and the systemic analysis (capitalism, imperialism, white
supremacy). BuildIt's CRM and campaign tools must support all three levels --
because organizers who only address immediate grievances burn out, and
organizers who only talk about systems never win material improvements.

### Ho Chi Minh and the Protracted Struggle

Ho Chi Minh understood that liberation is not an event but a process -- one
that requires patience, discipline, and deep knowledge of local conditions.
The mass line methodology -- "from the masses, to the masses" -- means that
organizers must listen before they speak, learn before they teach, and build
trust before they ask for action.

*"Nothing is more precious than independence and freedom."*

For BuildIt, this means the platform must support long campaigns -- not just
sprint-style actions but the slow, patient work of building relationships
over months and years. Campaign tools need historical tracking, relationship
depth indicators, and the ability to see how a community's organizing
capacity has grown over time. Not as gamification, but as honest assessment
of where you are in a protracted struggle.

### Joy Sustains What Guilt Cannot

The Black feminist tradition -- Audre Lorde, the Combahee River Collective,
and the generations who followed -- taught us that liberation must address
the whole person. Organizing that is only sacrifice and suffering produces
burnout. Organizing that makes people feel alive produces resilience.

Audre Lorde: *"The sharing of joy, whether physical, emotional, psychic, or
intellectual, forms a bridge between the sharers which can be the basis for
understanding much of what is not shared between them, and lessens the
threat of their difference."* -- *Uses of the Erotic: The Erotic as Power*
(1978)

The Combahee River Collective: *"Our politics evolved from a healthy love
for ourselves, our sisters and our community which allows us to continue our
struggle and work."* -- *A Black Feminist Statement* (1977)

This is not about adding confetti animations to an app. It is about whether
the daily practice of using the platform reproduces the anxiety, guilt, and
surveillance of the systems organizers are fighting against -- or whether it
practices care, solidarity, and trust.

Tools that foreground deficits ("47 unread messages," "12 tasks overdue,"
"3 members inactive") train organizers to see their communities through a
lens of failure. Tools that foreground abundance ("12 mutual aid exchanges
this week," "your group made its 50th collective decision," "3 new members
welcomed") create momentum.

Tools that treat inactivity as a problem (graying out absent members, sending
re-engagement nudges) practice burnout culture. Tools that treat rest as
normal (no shame indicators, warm welcome-back messages) practice
sustainability.

The erotic, in Lorde's sense, is not about sex -- it is about the deep
feeling of satisfaction that comes from work done well and shared fully. A
tool that produces that feeling -- that makes the work of justice feel
genuinely good -- is a tool people will keep using. And sustained use, over
years, is how movements are built.

### Access as Liberation

Disability justice teaches us that accessibility is not compliance with a
checklist. It is a practice of interdependence and collective care.

Mia Mingus coined the term "access intimacy" -- *"that elusive, hard to
describe feeling when someone else 'gets' your access needs"* -- to describe
the quality of relationship that makes genuine access possible. WCAG
compliance is necessary but not sufficient. A platform achieves access
intimacy when its design anticipates the needs of disabled users not as an
afterthought but as a core design constraint.

Sins Invalid's principles of disability justice include: leadership of the
most impacted, intersectionality, interdependence, collective access, and
the understanding that all bodies are unique and essential. Applied to
BuildIt: the platform must offer multiple ways to participate in every
feature. Voice notes for those who cannot type. High contrast for those
who cannot see well. Screen reader support that is not an afterthought.
Natural stopping points for those who cannot sustain long sessions.
Flexible pacing for those who process information differently.

### Design Justice

Sasha Costanza-Chock's *Design Justice* (2020) and Ruha Benjamin's *Race
After Technology* (2019) showed us that technology is never neutral. Design
either reproduces existing power structures or it challenges them. The
"New Jim Code" -- Benjamin's term for how discriminatory designs get encoded
into technology -- operates by amplifying racial hierarchies, by ignoring
social divisions and thereby replicating them, or by claiming to fix bias
while doing the opposite.

BuildIt must be designed through a process that centers the communities it
serves. Not user research that extracts insights from marginalized
communities for the benefit of developers. Participatory design where
communities define their own needs, evaluate proposed solutions, and
maintain governance over how the platform evolves.

---

## What Organizing Actually Looks Like

The traditions above are not academic. They describe how people have actually
organized -- in factories, in barrios, in jungles, in besieged cities, in
neighborhoods under occupation. BuildIt must understand and serve the
reality of that work.

### Organizing is relational

It happens through one-on-one conversations, shared meals, mutual aid,
storytelling, and consistent presence over time. The BPP Free Breakfast
Program worked because the same people showed up every morning. Hampton's
Rainbow Coalition worked because he went to Uptown and talked to people
about their kids going hungry. Freire's literacy circles worked because
learners and teachers investigated their own reality together.

BuildIt must be a relationship tool, not a broadcast tool. CRM is not a
sales pipeline -- it is a map of human relationships and their depth.

### Organizing is dangerous

Every tradition named in this document produced martyrs. Lumumba. Hampton.
Cabral. Sankara. Luxemburg. Comandanta Ramona died of kidney failure
exacerbated by the conditions of resistance. RAM members were arrested and
prosecuted. LRBW members were fired and blacklisted. Mujeres Libres members
were hunted after Franco's victory.

BuildIt must treat security not as a feature but as a responsibility.

### Organizing is joyful

Despite the danger, every one of these movements was sustained by joy.
The Panthers fed children and taught them their history. The Zapatistas
built schools and held festivals. Mujeres Libres used poetry and theater.
The LRBW published newspapers and organized dances. Lorde wrote poems.
hooks wrote about love.

BuildIt must make space for joy. Not instrumentalized joy (engagement
metrics, gamification). Real joy. The kind that comes from doing meaningful
work with people you trust.

### Organizing is educational

Freire's literacy circles. The Panthers' Liberation Schools. RAM's study
groups. Mujeres Libres' vocational training. The Zapatistas' autonomous
education system. Every serious organizing tradition has built its own
educational infrastructure, because consciousness does not arrive fully
formed -- it develops through the cycle of reflection and action.

BuildIt must support political education not as a separate feature but as
a dimension of every organizing activity.

### Organizing is democratic

Zapatista assemblies. Sankara's CDRs. The LRBW's shop-floor committees.
Mujeres Libres' federated *agrupaciones*. The Panthers' internal governance.
Democratic decision-making is not optional -- it is the practice through
which people develop the capacity for self-governance.

BuildIt must support multiple models of democratic governance: consensus,
modified consensus, majority vote, ranked choice, delegation, rotation.
Different communities govern differently. The platform does not impose a
model.

### Organizing is cultural

Cabral: *"National liberation is necessarily an act of culture."* Communities
organize through music, food, art, storytelling, language, shared memory.
A platform that only supports task management and messaging misses the
cultural infrastructure that holds movements together.

BuildIt must support storytelling, shared archives, cultural expression, and
community identity -- not as "social features" bolted on to an organizing
tool, but as essential organizing infrastructure.

### Organizing crosses borders

The Panthers practiced intercommunalism. RAM connected domestic Black
liberation to anti-colonial movements worldwide. Hampton's Rainbow Coalition
crossed racial lines. The Zapatistas built international solidarity networks.
Mujeres Libres organized across workplaces and neighborhoods.

BuildIt must support coalition building across organizations, across
movements, across borders. Federated architecture makes this possible while
preserving each group's autonomy.

---

## BuildIt's Commitments

From these traditions, we derive the following commitments. These are not
features. They are the non-negotiable principles that govern every feature.

### 1. Start from material conditions

Understand the concrete reality of the people using the platform. Not
demographics, not personas -- actual conditions. What threats do they face?
What resources do they have? What infrastructure can they rely on? Design
for the most constrained conditions first.

### 2. Sovereignty over dependency

Communities own their data, their infrastructure, and their governance. No
external entity -- not us, not a cloud provider, not a government -- can
access, control, or shut down a community's communications. *"He who feeds
you, controls you."*

### 3. Security as responsibility

The most vulnerable user defines the security baseline. Design for the
organizer facing state-level adversaries, because if the platform protects
them, it protects everyone. Assume surveillance. Assume infiltration. Assume
device seizure. Build accordingly.

### 4. Honest tools for honest organizing

*"Tell no lies. Claim no easy victories."* Show real numbers. Real sync
status. Real participation. No vanity metrics. No engagement theater. No
algorithmic manipulation. The platform tells the truth, even when the truth
is uncomfortable.

### 5. Many worlds fit

The platform serves labor unions, mutual aid networks, media collectives,
tenant unions, co-ops, activist groups, community defense networks, and
movements that do not yet have names. It does not impose a single organizing
model. It provides infrastructure flexible enough for many models to coexist.

### 6. Education through action

Learning and doing are inseparable. The platform supports political education
not as content consumption but as the Freirean cycle of reflection and action.
Study groups, shared curricula, praxis logs, and templates drawn from real
organizing -- all integrated into the flow of work, not separated from it.

### 7. Democracy as practice

Self-governance is not a feature -- it is a daily practice. The platform
supports multiple governance models, protects the right to dissent, enables
rotation and accountability, and treats leadership as service. *"Here the
people command, and the government obeys."*

### 8. Autonomous spaces within solidarity

Groups within groups. Caucuses. Affinity spaces. Working committees with
their own encrypted channels. The Mujeres Libres model: autonomous
organizing within the broader movement, because marginalized voices need
their own space to develop strength before bringing it back to the whole.

### 9. Joy, rest, and sustainability

Organizing sustained through joy lasts longer than organizing sustained
through guilt. The platform celebrates collective wins, normalizes rest,
refuses shame-based engagement, and treats the emotional wellbeing of
organizers as a structural concern. Burnout is not a personal failure --
it is a design failure.

### 10. Mutual aid as organizing

Every act of resource sharing is a relationship. Every relationship is a
potential organizing connection. Mutual aid is not charity -- it is
solidarity between equals. The platform treats mutual aid not as a service
module but as the primary mechanism through which communities build power.

### 11. Culture as infrastructure

Storytelling, shared memory, artistic expression, language, and identity are
not social features -- they are the cultural substrate that holds movements
together. The platform must support them as essential infrastructure.

### 12. Solidarity across boundaries

Movements are connected. The strike at one factory connects to the supply
chain in another country. The housing struggle in one neighborhood connects
to the displacement in another city. The platform supports coalition building
across organizations, across movements, across borders -- with federated
architecture that preserves autonomy while enabling coordination.

---

## What We Refuse

Every tradition we learn from also teaches us what to refuse. These are the
anti-patterns -- the design choices that betray the people the platform is
meant to serve.

### Surveillance aesthetics

"Last active" indicators. Read receipts on by default. Activity logs visible
to admins. "Who viewed this" analytics. These import the surveillance
practices of corporate software into organizing spaces. For communities
facing actual state surveillance, surveillance aesthetics in their own tools
are corrosive to trust. All visibility features are opt-in. Default to
privacy. Always.

### Shame-based engagement

Highlighting inactivity. Public leaderboards. Red badges on non-urgent items.
"You have 47 unread messages" guilt. Shame is not a sustainable motivator.
It drives anxiety, avoidance, and withdrawal. The platform tracks activity
privately and surfaces collective metrics, never individual rankings.

### Urgency theater

Red notification badges. Exclamation marks. "Urgent" labels on non-urgent
items. Countdown timers. Artificial urgency triggers fight-or-flight
responses and makes every interaction stressful. Reserve urgent indicators
for genuinely urgent situations. Everything else uses calm presentation.
Trust users to engage on their own timeline.

### Extractive gamification

Points. Levels. Badges. Leaderboards. These reduce solidarity to
competition, transform intrinsic motivation into extrinsic dependence, and
create hierarchy within communities practicing equality. If using any
achievement markers, make them narrative ("You were part of the group's
first successful proposal") not quantitative ("Level 3 Organizer").

### Exhaustion-promoting design

Infinite scroll. Streak mechanics that punish breaks. Always-on availability
expectations. Real-time notifications by default. These promote continuous
engagement without boundaries and actively harm the movements they claim to
serve. Design natural stopping points. Batch notifications. Celebrate rest.

### Dependency architecture

Any design that routes critical organizing infrastructure through a single
corporate provider, a single server, or a single point of failure. If we
disappear, the platform keeps running. If a relay goes down, the mesh keeps
working. If the internet is shut off, BLE keeps communicating.

### Banking education

Knowledge bases that treat users as passive consumers of information.
Onboarding flows that lecture. Tutorials that prescribe rather than invite.
Features that gate participation behind credentials. Education is a dialogue,
not a deposit.

### Charity aesthetics in mutual aid

"Donor" and "recipient" framing. Progress bars showing how much has been
"raised." Deficit metrics ("12 unfulfilled requests"). These reproduce the
power dynamics of charity within spaces that are practicing solidarity.
Mutual aid is an exchange between equals. "I can share" and "I could use"
are parallel acts of community participation.

---

## The World We Are Building

The Zapatistas call it *preguntando caminamos* -- asking, we walk. We do not
have a finished blueprint for the world BuildIt is helping to build. But we
know its qualities, because every tradition named in this document has
practiced them:

**Self-governance.** Communities make their own decisions through democratic
processes they choose for themselves. No external authority dictates their
structure.

**Self-reliance.** Communities own their infrastructure. They are not
dependent on any corporation, any government, or any single point of failure
for their ability to communicate, coordinate, and organize.

**Solidarity.** Communities support each other across lines of race, class,
gender, nationality, and organizational affiliation. Fred Hampton's Rainbow
Coalition. The Panthers' intercommunalism. The Zapatistas' international
solidarity. Different struggles, shared infrastructure, mutual support.

**Education.** Communities develop their own understanding of the world
through the cycle of reflection and action. Not indoctrination. Not
propaganda. Critical consciousness that emerges from investigating reality
together.

**Joy.** Communities organize through joy as much as through struggle. Music
and food and storytelling and celebration and play. Not as a reward for
political work, but as the work itself. Movements that make people feel
alive last longer than movements built on sacrifice.

**Peace and resilience.** Communities build the capacity to endure repression,
recover from crisis, resolve internal conflicts, and protect their members.
Not through militarization, but through depth of relationship, distributed
infrastructure, and the practiced ability to take care of each other.

**Freedom.** For everyone. Human, animal, machine. The liberation of any is
incomplete without the liberation of all.

If we build it right, it will be used by the warehouse worker joining a
union campaign from a QR code in the break room, by the mutual aid network
coordinating disaster response over BLE mesh when the towers are down, by
the media collective running democratic editorial governance, by the tenant
union preparing a rent strike, by the community defense network protecting
a neighborhood, by the indigenous community defending their land, by the
general strike committee coordinating citywide action, by the workers'
committee practicing self-management, and by the study circle reading
Freire and Hampton and Luxemburg together and asking: what do we do next?

We build it together. Asking, we walk.

---

## Further Reading

These are the traditions we draw from. This is not an exhaustive bibliography
-- it is an invitation to go deeper.

### Critical Pedagogy
- Paulo Freire, *Pedagogy of the Oppressed* (1970)
- Paulo Freire, *Pedagogy of Hope* (1992)
- bell hooks, *Teaching to Transgress* (1994)
- bell hooks, *Teaching Community* (2003)
- bell hooks, *All About Love* (2000)

### Black Feminist Thought
- Audre Lorde, "Uses of the Erotic: The Erotic as Power" (1978)
- Audre Lorde, *Sister Outsider* (1984)
- Combahee River Collective, "A Black Feminist Statement" (1977)
- bell hooks, *Feminist Theory: From Margin to Center* (1984)

### Black Liberation Movements
- Huey P. Newton, *Revolutionary Suicide* (1973)
- Bobby Seale, *Seize the Time* (1970)
- The Black Panther Party, Ten-Point Platform and Program (1966)
- Fred Hampton, speeches (collected)
- League of Revolutionary Black Workers, documentary: *Finally Got the News* (1970)
- Dan Georgakas and Marvin Surkin, *Detroit: I Do Mind Dying* (1975)
- Robin D.G. Kelley, *Freedom Dreams* (2002)

### African Liberation
- Amilcar Cabral, *Unity and Struggle* (collected writings)
- Amilcar Cabral, "The Weapon of Theory" (1966)
- Thomas Sankara, *Thomas Sankara Speaks* (collected speeches)
- Patrice Lumumba, speeches and final letter (1961)

### Revolutionary Strategy
- Rosa Luxemburg, *The Mass Strike* (1906)
- Rosa Luxemburg, *Reform or Revolution* (1900)
- Rosa Luxemburg, *The Russian Revolution* (1918)
- Ho Chi Minh, selected writings
- Dialectical and historical materialism as organizing methodology

### Autonomous and Indigenous Movements
- EZLN, *Sixth Declaration of the Lacandon Jungle* (2005)
- Subcomandante Marcos, *Our Word Is Our Weapon* (collected writings)
- Hilary Klein, *Companeras: Zapatista Women's Stories* (2015)
- EZLN, Women's Revolutionary Law (1993)
- Martha Ackelsberg, *Free Women of Spain* (2005 edition)

### Joy, Rest, and Sustainability
- Audre Lorde, *A Burst of Light* (1988)
- adrienne maree brown, *Emergent Strategy* (2017)
- adrienne maree brown, *Pleasure Activism* (2019)
- Tricia Hersey, *Rest Is Resistance: A Manifesto* (2022)

### Design Justice, Disability Justice, and Technology
- Sasha Costanza-Chock, *Design Justice* (2020)
- Design Justice Network, 10 Principles of Design Justice (2018)
- Ruha Benjamin, *Race After Technology* (2019)
- Mia Mingus, "Access Intimacy, Interdependence and Disability Justice" (2017)
- Sins Invalid, *Skin, Tooth, and Bone: The Basis of Movement Is Our People* (2019)
- Leah Lakshmi Piepzna-Samarasinha, *Care Work: Dreaming Disability Justice* (2018)

### Organizing Methodology
- Training for Change, Spectrum of Support / Spectrum of Allies
- Jane McAlevey, *No Shortcuts: Organizing for Power in the New Gilded Age* (2016)

---

*This document is a living foundation. As BuildIt grows and as we learn from
the communities we serve, these commitments will deepen. The question to
return to is always: does this serve the people who are organizing for their
collective freedom? Does this honor the traditions of those who came before?
Does this help build the world where many worlds fit?*

*Asking, we walk.*
