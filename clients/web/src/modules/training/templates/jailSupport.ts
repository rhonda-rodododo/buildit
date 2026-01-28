/**
 * Jail Support Training Template
 * Essential training for jail support volunteers
 */

import type { CourseTemplate, DocumentContent, QuizContent, QuizQuestion } from '../types';

const jailSupportOverviewContent: DocumentContent = {
  type: 'document',
  markdown: `# Jail Support Overview

Jail support is the practice of supporting people who are arrested during protests or direct actions.

## What is Jail Support?

Jail support volunteers:
- Wait outside jails during mass arrests
- Track who has been arrested
- Greet people when released
- Provide immediate necessities
- Connect people with legal resources
- Ensure no one is forgotten

## Why Jail Support Matters

- **Accountability**: Monitors police treatment
- **Safety**: Ensures people aren't disappeared
- **Morale**: Shows solidarity with those arrested
- **Practical**: Provides necessities upon release
- **Legal**: Connects people with lawyers

## Before the Action

### Preparation
- Know which jail(s) are likely
- Have bail fund contacts
- Prepare support materials
- Charge phones and equipment
- Plan transportation

### Communication Setup
- Dedicated phone line or chat
- Multiple contact methods
- Check-in protocols
- Emergency contacts

## The Jail Support Role

### At the Jail
- Arrive before expected release
- Set up visible presence
- Track who enters and exits
- Document everything
- Maintain safety protocols

### Information Gathering
- Names of arrested (if shared)
- Charge information
- Bail amounts
- Expected release times
- Medical needs

### Support Upon Release
- Water and food
- Phone to call contacts
- Transportation assistance
- Legal referrals
- Emotional support

## Key Principles

### Confidentiality
- Don't share names without consent
- Protect people's information
- Secure documentation

### Non-Judgmental
- Support everyone released
- No questions about actions
- Respect privacy

### Persistence
- Stay until everyone is out
- Don't assume someone found another way
- Follow up on missing people
`,
};

const legalBasicsContent: DocumentContent = {
  type: 'document',
  markdown: `# Legal Basics for Jail Support

Understanding the legal process to better support arrestees.

## The Arrest Process

### Initial Arrest
1. Person is detained
2. Miranda rights (if interrogated)
3. Transport to station/jail
4. Booking and processing

### Booking
- Personal information recorded
- Fingerprints and photos
- Property inventoried
- Charges filed

### Holding
- Held in jail pending release
- May be moved to different facility
- Bail determination

## Types of Release

### Citation Release
- Released with citation
- Must appear in court later
- Often for minor charges

### Own Recognizance (OR)
- Released without bail
- Promise to appear
- Based on ties to community

### Bail
- Money paid for release
- Returned if person appears in court
- Can use bail fund
- Bail bondsman takes percentage

### No Release
- Held until arraignment
- Serious charges
- Flight risk
- Repeat offenses

## What Arrestees Should Know

### During Arrest
- Stay calm
- Don't resist physically
- You can say: "I am going to remain silent. I want to speak to a lawyer."
- Don't consent to searches

### In Custody
- Right to remain silent
- Right to attorney
- Right to phone call (varies by jurisdiction)
- Don't discuss case with other arrestees

### Don't
- Don't sign anything without lawyer
- Don't talk about the case
- Don't give statements
- Don't consent to searches

## Jail Support Legal Role

### What You Can Do
- Provide legal observer notes
- Connect with lawyers
- Track arrests and releases
- Share know-your-rights info

### What You Can't Do
- Give legal advice
- Represent anyone
- Negotiate with police
- Access jailed individuals

## Working with Legal

### National Lawyers Guild (NLG)
- Provides legal observers
- Coordinates legal support
- Mass arrest protocols
- Local chapter contacts

### Bail Funds
- Know your local bail fund
- Understand their process
- Have contact info ready

### Legal Hotlines
- NLG Legal Hotline
- Local movement lawyers
- Immigration lawyers if needed
`,
};

const operationsContent: DocumentContent = {
  type: 'document',
  markdown: `# Jail Support Operations

Practical guide to running jail support.

## Setting Up

### Location
- Visible from jail exit
- Safe distance from police
- Legal to be there
- Weather protection if possible

### Equipment Checklist
- Folding table and chairs
- Canopy/umbrella (weather)
- Water and snacks
- First aid kit
- Phone chargers
- Clipboards and pens
- Printed materials
- Cash for emergencies

### Communication Setup
- Dedicated phone number
- Signal group for team
- Radio for larger operations
- Backup power

## Tracking Arrestees

### What to Track
- Name (if shared)
- Approximate arrest time
- Location of arrest
- Any visible injuries
- Charge (if known)
- Release status

### How to Track
- Spreadsheet or database
- Regular updates
- Multiple backups
- Secure storage

### Privacy Considerations
- Only collect necessary info
- Don't force names
- Secure all data
- Delete after no longer needed

## Shift Management

### Shift Structure
- 4-hour shifts recommended
- Overlap for handoff
- Clear roles per shift
- Backup for emergencies

### Roles
- **Coordinator**: Overall management
- **Tracker**: Maintains arrestee list
- **Greeter**: Welcomes released people
- **Runner**: Gets supplies, transport
- **Communications**: Manages phones/messages

### Handoff Protocol
- Full briefing to next shift
- Current status of all cases
- Pending issues
- Updated contact lists

## Release Support

### When Someone is Released
1. Greet them warmly
2. Ask what they need
3. Offer water/food
4. Ask if they need to call anyone
5. Offer transportation
6. Provide legal info
7. Ask about medical needs
8. Check if they want their info tracked

### What Not to Do
- Don't ask about charges
- Don't pressure for information
- Don't take photos without consent
- Don't share info with media

## Difficult Situations

### Missing Person
- Don't assume they're released
- Check all possible jails
- Contact family carefully
- Escalate to legal

### Medical Emergency
- Call 911 if urgent
- Document everything
- Contact medical support
- Follow up

### Police Interaction
- Know your rights
- Don't interfere with operations
- Document harassment
- Stay calm
`,
};

const jailSupportQuiz: QuizContent = {
  type: 'quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the primary purpose of jail support?',
      options: [
        'To negotiate with police',
        'To support and track people who are arrested',
        'To provide legal representation',
        'To pay bail for everyone',
      ],
      correctAnswer: 'To support and track people who are arrested',
      explanation: 'Jail support\'s main purpose is to track, support, and ensure no one is forgotten after being arrested.',
      points: 10,
      order: 1,
    },
    {
      id: 'q2',
      type: 'multi-select',
      question: 'What should jail support volunteers provide to released people? (Select all that apply)',
      options: [
        'Water and snacks',
        'Legal advice',
        'Phone to call contacts',
        'Transportation assistance',
      ],
      correctAnswer: ['Water and snacks', 'Phone to call contacts', 'Transportation assistance'],
      explanation: 'Jail support provides basic necessities and logistics, but NOT legal advice - that requires a lawyer.',
      points: 15,
      order: 2,
    },
    {
      id: 'q3',
      type: 'true-false',
      question: 'Jail support volunteers should always ask released people detailed questions about what they did.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'Never ask about what someone did. It\'s not relevant to supporting them and could compromise their legal case.',
      points: 10,
      order: 3,
    },
    {
      id: 'q4',
      type: 'multiple-choice',
      question: 'What should an arrestee say to police?',
      options: [
        'Everything they want to know to get released faster',
        '"I am going to remain silent. I want to speak to a lawyer."',
        'Deny everything',
        'Give a fake name',
      ],
      correctAnswer: '"I am going to remain silent. I want to speak to a lawyer."',
      explanation: 'Invoking the right to remain silent and requesting a lawyer is the safest approach.',
      points: 10,
      order: 4,
    },
    {
      id: 'q5',
      type: 'multiple-choice',
      question: 'If someone appears to be missing (not released when expected), what should you do?',
      options: [
        'Assume they found another way home',
        'Wait 24 hours before checking',
        'Check all possible jails and escalate to legal',
        'Call the police to ask',
      ],
      correctAnswer: 'Check all possible jails and escalate to legal',
      explanation: 'Never assume someone is fine. Actively track and escalate to legal support if someone is unaccounted for.',
      points: 10,
      order: 5,
    },
  ] as QuizQuestion[],
  passingScore: 70,
  allowRetakes: true,
  maxAttempts: 3,
  shuffleQuestions: true,
  shuffleOptions: true,
  showCorrectAfter: true,
};

const selfCareContent: DocumentContent = {
  type: 'document',
  markdown: `# Self-Care and Sustainability

Jail support can be emotionally demanding. Taking care of yourself is essential.

## Emotional Challenges

### Common Experiences
- Frustration with the system
- Worry for those inside
- Exhaustion from long waits
- Secondary trauma from stories
- Feeling helpless

### Signs of Burnout
- Constant exhaustion
- Cynicism or hopelessness
- Difficulty sleeping
- Avoiding jail support work
- Irritability

## During Shifts

### Physical Care
- Stay hydrated
- Eat regular meals
- Take breaks
- Dress appropriately for weather
- Move around periodically

### Emotional Care
- Check in with teammates
- Take breaks from difficult conversations
- Know your limits
- It's okay to step back

## After Shifts

### Decompression
- Don't go straight to sleep
- Do something calming
- Talk to someone if needed
- Avoid alcohol as coping

### Processing
- Debrief with team
- Name difficult moments
- Acknowledge successes
- Identify improvements

## Long-term Sustainability

### Boundaries
- Don't do every shift
- Have other activities
- Maintain relationships
- Know your limits

### Support Systems
- Movement friends
- Non-movement friends
- Therapy/counseling
- Community care

### Meaning and Purpose
- Remember why you do this
- Celebrate wins
- Connect with those you've helped
- See the bigger picture

## Supporting Each Other

### Check-ins
- Regular team check-ins
- Notice when someone's struggling
- Offer support without pressure

### Mutual Aid
- Cover shifts when needed
- Share resources
- Build community

### No Martyrdom
- Sustainable work > hero work
- The movement needs you healthy
- It's okay to take breaks
`,
};

export const jailSupportTemplate: CourseTemplate = {
  id: 'jail-support',
  title: 'Jail Support Training',
  description: 'Essential training for jail support volunteers. Covers operations, legal basics, tracking, and self-care.',
  category: 'legal',
  difficulty: 'beginner',
  estimatedHours: 2.5,
  imageUrl: '/images/training/jail-support.png',
  certificationEnabled: true,
  certificationExpiryDays: 180, // Renew every 6 months
  modules: [
    {
      title: 'Jail Support Overview',
      description: 'Understanding the role and importance of jail support',
      estimatedMinutes: 25,
      lessons: [
        {
          type: 'document',
          title: 'What is Jail Support?',
          description: 'The purpose, principles, and importance of jail support',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: jailSupportOverviewContent,
        },
        {
          type: 'video',
          title: 'Jail Support in Action',
          description: 'Real examples and testimonials from jail support volunteers',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Legal Basics',
      description: 'Understanding the legal process',
      estimatedMinutes: 30,
      lessons: [
        {
          type: 'document',
          title: 'Legal Basics for Jail Support',
          description: 'The arrest process, types of release, and working with legal',
          estimatedMinutes: 20,
          requiredForCertification: true,
          content: legalBasicsContent,
        },
        {
          type: 'interactive',
          title: 'Know Your Rights Scenario',
          description: 'Practice advising someone on their rights',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Operations',
      description: 'Running effective jail support',
      estimatedMinutes: 40,
      lessons: [
        {
          type: 'document',
          title: 'Jail Support Operations',
          description: 'Setting up, tracking, shift management, and release support',
          estimatedMinutes: 25,
          requiredForCertification: true,
          content: operationsContent,
        },
        {
          type: 'quiz',
          title: 'Jail Support Quiz',
          description: 'Test your understanding of jail support operations',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: jailSupportQuiz,
        },
      ],
    },
    {
      title: 'Self-Care and Sustainability',
      description: 'Taking care of yourself and your team',
      estimatedMinutes: 20,
      lessons: [
        {
          type: 'document',
          title: 'Self-Care and Sustainability',
          description: 'Emotional challenges, decompression, and long-term sustainability',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: selfCareContent,
        },
        {
          type: 'interactive',
          title: 'Self-Care Planning',
          description: 'Create your personal self-care plan',
          estimatedMinutes: 5,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Live Practice Session',
      description: 'Practice with experienced volunteers',
      estimatedMinutes: 60,
      lessons: [
        {
          type: 'live-session',
          title: 'Jail Support Role-Play',
          description: 'Practice jail support scenarios with experienced volunteers',
          estimatedMinutes: 60,
          requiredForCertification: true,
        },
      ],
    },
  ],
};
