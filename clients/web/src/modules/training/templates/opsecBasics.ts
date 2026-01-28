/**
 * Operational Security Basics Training Template
 * Essential security practices for organizers
 */

import type { CourseTemplate, DocumentContent, QuizContent, QuizQuestion } from '../types';

const threatModelingContent: DocumentContent = {
  type: 'document',
  markdown: `# Understanding Your Adversaries

Effective security starts with understanding who might target you and what they're capable of.

## Threat Modeling Basics

A threat model answers these questions:

1. **What am I protecting?** (assets)
2. **Who might want to access it?** (adversaries)
3. **How might they try to get it?** (attacks)
4. **What are the consequences?** (impact)
5. **What can I do about it?** (mitigations)

## Common Adversaries

### Doxxers / Online Harassers
- **Capability**: OSINT, social engineering
- **Goal**: Expose personal information
- **Protection**: Compartmentalization, pseudonyms

### Counter-Protesters / Opposition
- **Capability**: Photography, social media monitoring
- **Goal**: Identify participants, disrupt activities
- **Protection**: Masks, no identifiers, counter-surveillance

### Corporate Security / Private Investigators
- **Capability**: Surveillance, legal discovery, informants
- **Goal**: Gather intelligence on organizing activities
- **Protection**: Operational security, need-to-know

### Law Enforcement
- **Capability**: Subpoenas, warrants, informants, surveillance tech
- **Goal**: Intelligence gathering, prosecution
- **Protection**: Encryption, legal strategy, security culture

### State-Level Actors
- **Capability**: Advanced persistent threats, mass surveillance
- **Goal**: Long-term monitoring, disruption
- **Protection**: Air gaps, specialized tools, compartmentalization

## Key Principle: Proportional Response

Your security measures should match your actual threat level:

- **Low risk**: Basic digital hygiene
- **Medium risk**: Encrypted communications, pseudonyms
- **High risk**: Compartmentalization, specialized tools
- **Critical risk**: Professional security consultation

Overcomplicating security can be counterproductive. Focus on what matters for YOUR situation.
`,
};

const digitalHygieneContent: DocumentContent = {
  type: 'document',
  markdown: `# Digital Security Hygiene

Basic practices that everyone should follow.

## Password Security

### Strong Passwords
- Use a passphrase: "correct horse battery staple"
- Minimum 16 characters
- Unique for every account

### Password Managers
- **Recommended**: Bitwarden, 1Password, KeePassXC
- One strong master password
- Auto-generate all other passwords

### Two-Factor Authentication (2FA)
- **Best**: Hardware keys (YubiKey)
- **Good**: Authenticator apps (Aegis, Google Authenticator)
- **Avoid**: SMS-based 2FA (can be intercepted)

## Device Security

### Phone Security
- Enable full-disk encryption
- Use a strong PIN (not 4 digits)
- Enable biometric PLUS PIN
- Keep software updated
- Review app permissions

### Computer Security
- Full-disk encryption (FileVault, BitLocker, LUKS)
- Regular updates
- Firewall enabled
- Antivirus/anti-malware

### Lost/Stolen Devices
- Enable remote wipe capability
- Know how to wipe quickly
- Don't store sensitive data locally

## Network Security

### Public WiFi
- Assume all traffic is monitored
- Use VPN when possible
- Avoid sensitive activities
- Verify network names (evil twin attacks)

### Home Network
- Change default router password
- Enable WPA3 (or WPA2)
- Consider a VPN router
- Segment IoT devices

## Social Media

### Privacy Settings
- Review all privacy settings
- Limit who can see posts
- Disable location tagging
- Audit connected apps

### Information Exposure
- Consider what photos reveal
- Metadata in images
- Check-ins and locations
- Friend/connection lists
`,
};

const compartmentalizationContent: DocumentContent = {
  type: 'document',
  markdown: `# Compartmentalization

Separating your identities and activities to limit exposure.

## Why Compartmentalize?

If one area is compromised:
- Other areas remain protected
- Damage is contained
- Recovery is easier

## Identity Compartmentalization

### Personal vs. Activist Identity
- Separate email addresses
- Different social media accounts
- Distinct communication channels
- Separate devices if high-risk

### Pseudonyms
- Use for sensitive organizing
- Consistent within context, separate across
- Consider backstory for cover
- Don't link to real identity

### Contact Lists
- Don't store real names with activist names
- Use secure contact management
- Separate personal from organizing contacts

## Communication Compartmentalization

### Channel Separation
- Different tools for different purposes
- Don't mix personal and organizing chats
- Separate group from individual comms

### Information Silos
- Need-to-know basis
- Don't overshare between groups
- Limit access to sensitive info

## Physical Compartmentalization

### Meeting Locations
- Rotate locations
- Avoid patterns
- Counter-surveillance

### Documents
- Secure storage
- Destroy when no longer needed
- Never leave unattended

## Device Compartmentalization

### Separate Devices
- Dedicated organizing phone
- Different computers for different uses
- Consider burner devices for high-risk

### Virtual Machines
- Isolate activities within one computer
- Tails for sensitive work
- Qubes OS for advanced users
`,
};

const opsecQuiz: QuizContent = {
  type: 'quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the first step in threat modeling?',
      options: [
        'Installing security software',
        'Identifying your adversaries',
        'Understanding what you\'re protecting (assets)',
        'Changing your passwords',
      ],
      correctAnswer: 'Understanding what you\'re protecting (assets)',
      explanation: 'Threat modeling starts with identifying your assets - what are you trying to protect?',
      points: 10,
      order: 1,
    },
    {
      id: 'q2',
      type: 'multi-select',
      question: 'Which are recommended forms of 2FA? (Select all that apply)',
      options: [
        'Hardware keys (YubiKey)',
        'SMS codes',
        'Authenticator apps',
        'Email codes',
      ],
      correctAnswer: ['Hardware keys (YubiKey)', 'Authenticator apps'],
      explanation: 'Hardware keys and authenticator apps are more secure than SMS or email, which can be intercepted.',
      points: 15,
      order: 2,
    },
    {
      id: 'q3',
      type: 'true-false',
      question: 'Using the same strong password for all accounts is secure if the password is complex enough.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'Even strong passwords should be unique per account. If one service is breached, all accounts are compromised.',
      points: 10,
      order: 3,
    },
    {
      id: 'q4',
      type: 'multiple-choice',
      question: 'What is compartmentalization in security?',
      options: [
        'Using the strongest possible encryption',
        'Separating identities and activities to limit exposure',
        'Keeping your devices organized',
        'Deleting old messages',
      ],
      correctAnswer: 'Separating identities and activities to limit exposure',
      explanation: 'Compartmentalization means separating different aspects of your life so a breach in one area doesn\'t compromise others.',
      points: 10,
      order: 4,
    },
    {
      id: 'q5',
      type: 'multiple-choice',
      question: 'What\'s the key principle for security measures?',
      options: [
        'Always use maximum security',
        'Security should match your actual threat level',
        'More complex is always better',
        'Only worry about online threats',
      ],
      correctAnswer: 'Security should match your actual threat level',
      explanation: 'Proportional response - your security measures should match your actual risks. Overcomplicating can be counterproductive.',
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

const securityCultureContent: DocumentContent = {
  type: 'document',
  markdown: `# Security Culture

Security culture is the collective practices and norms that keep everyone safer.

## Core Principles

### Need-to-Know
- Only share information necessary for the task
- Don't ask about activities you're not involved in
- Respect others' compartmentalization

### Don't Snitch
- Don't discuss others' involvement without consent
- Never confirm or deny participation
- Protect identities, even casually

### No Bragging
- Don't boast about actions
- Avoid discussing details publicly
- Social media is not your friend

### Verify Before Trust
- Confirm identities out-of-band
- Be wary of newcomers asking many questions
- Trust is earned over time

## Communication Norms

### In Person
- Be aware of surroundings
- Don't discuss sensitive matters in public
- Watch for recording devices

### Digital
- Assume messages may be seen
- Don't put anything in writing you wouldn't want read in court
- Use ephemeral messaging when appropriate

### Meeting Security
- Counter-surveillance arrival/departure
- No phones in sensitive meetings
- Need-to-know attendance lists

## Red Flags

### Potential Informants
- Asking lots of questions about other people
- Pushing for illegal activity
- Taking photos without clear purpose
- New person with unusual access/money

### Surveillance Indicators
- Same people appearing repeatedly
- Unusual vehicles near locations
- Clicking on phone lines
- Strange account activity

## Building Good Culture

### Education
- Train new members
- Regular security refreshers
- Share without exposing

### Accountability
- Call out bad practices gently
- Model good behavior
- Create space for questions

### Balance
- Security enables organizing, doesn't replace it
- Don't let paranoia paralyze
- Reasonable precautions, not perfect security
`,
};

export const opsecBasicsTemplate: CourseTemplate = {
  id: 'opsec-basics',
  title: 'Operational Security Basics',
  description: 'Essential security practices for organizers. Learn threat modeling, digital hygiene, compartmentalization, and security culture.',
  category: 'opsec',
  difficulty: 'beginner',
  estimatedHours: 2,
  imageUrl: '/images/training/opsec-basics.png',
  certificationEnabled: true,
  certificationExpiryDays: 365, // Renew annually
  modules: [
    {
      title: 'Threat Modeling',
      description: 'Understanding your adversaries and risks',
      estimatedMinutes: 25,
      lessons: [
        {
          type: 'document',
          title: 'Understanding Your Adversaries',
          description: 'Learn to identify threats and assess your risk level',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: threatModelingContent,
        },
        {
          type: 'interactive',
          title: 'Build Your Threat Model',
          description: 'Interactive exercise to create your personal threat model',
          estimatedMinutes: 10,
          requiredForCertification: true,
        },
      ],
    },
    {
      title: 'Digital Hygiene',
      description: 'Basic security practices everyone should follow',
      estimatedMinutes: 30,
      lessons: [
        {
          type: 'document',
          title: 'Digital Security Hygiene',
          description: 'Passwords, devices, networks, and social media security',
          estimatedMinutes: 20,
          requiredForCertification: true,
          content: digitalHygieneContent,
        },
        {
          type: 'video',
          title: 'Setting Up a Password Manager',
          description: 'Step-by-step guide to setting up and using a password manager',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Compartmentalization',
      description: 'Separating identities and activities',
      estimatedMinutes: 25,
      lessons: [
        {
          type: 'document',
          title: 'Compartmentalization Strategies',
          description: 'How to separate and protect different aspects of your life',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: compartmentalizationContent,
        },
        {
          type: 'interactive',
          title: 'Compartmentalization Audit',
          description: 'Assess your current compartmentalization and identify improvements',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Security Culture',
      description: 'Collective practices for group security',
      estimatedMinutes: 30,
      lessons: [
        {
          type: 'document',
          title: 'Building Security Culture',
          description: 'Norms and practices that keep everyone safer',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: securityCultureContent,
        },
        {
          type: 'quiz',
          title: 'Operational Security Quiz',
          description: 'Test your understanding of opsec principles',
          estimatedMinutes: 10,
          requiredForCertification: true,
          content: opsecQuiz,
        },
        {
          type: 'interactive',
          title: 'Security Scenario Practice',
          description: 'Practice responding to security scenarios',
          estimatedMinutes: 5,
          requiredForCertification: false,
        },
      ],
    },
  ],
};
