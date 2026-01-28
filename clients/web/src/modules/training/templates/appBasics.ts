/**
 * App Basics Training Template
 * Introduction to using the BuildIt app
 */

import type { CourseTemplate, DocumentContent, QuizContent, QuizQuestion } from '../types';

const welcomeContent: DocumentContent = {
  type: 'document',
  markdown: `# Welcome to BuildIt

BuildIt is a privacy-first organizing platform designed for activist groups, co-ops, unions, and community organizers.

## What You'll Learn

In this course, you'll learn:

- How to create and secure your identity
- Understanding groups and how to join them
- Secure messaging basics
- Navigation and key features

## Privacy First

Everything in BuildIt is designed with privacy in mind:

- **End-to-end encryption** for all messages
- **No central servers** storing your data
- **Your keys, your data** - only you control access
- **BLE mesh networking** for offline resilience

Let's get started!
`,
};

const identityContent: DocumentContent = {
  type: 'document',
  markdown: `# Creating Your Identity

Your identity in BuildIt is based on cryptographic keys. Think of it like a digital passport that only you control.

## Key Concepts

### Public Key (npub)
- This is like your username
- You can share it with others
- Used to receive encrypted messages

### Private Key (nsec)
- This is like your password
- **NEVER share this with anyone**
- Used to decrypt messages and sign actions

## Creating Your Identity

1. Open BuildIt and tap "Create New Identity"
2. Choose a display name (can be a pseudonym)
3. Optionally add a profile picture
4. Your keys are automatically generated

## Backing Up Your Keys

**CRITICAL**: If you lose your private key, you lose access to all your messages and groups forever. There is no "forgot password" option.

### Backup Options

1. **Write it down** - Store on paper in a secure location
2. **Password manager** - Use a reputable password manager
3. **Hardware wallet** - For advanced security

## Security Tips

- Use a unique identity for sensitive organizing
- Don't link your real identity unless necessary
- Consider using Tor for additional privacy
`,
};

const identityQuiz: QuizContent = {
  type: 'quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is your "npub" in BuildIt?',
      options: [
        'Your private key',
        'Your public key (like a username)',
        'Your password',
        'Your email address',
      ],
      correctAnswer: 'Your public key (like a username)',
      explanation: 'Your npub (public key) is like a username that you can share with others.',
      points: 10,
      order: 1,
    },
    {
      id: 'q2',
      type: 'true-false',
      question: 'It\'s safe to share your private key (nsec) with trusted group members.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'NEVER share your private key with anyone. It gives complete access to your identity.',
      points: 10,
      order: 2,
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What happens if you lose your private key?',
      options: [
        'You can reset it via email',
        'BuildIt support can recover it',
        'You permanently lose access to your identity',
        'You can regenerate it from your public key',
      ],
      correctAnswer: 'You permanently lose access to your identity',
      explanation: 'There is no recovery option. Always backup your private key securely.',
      points: 10,
      order: 3,
    },
  ] as QuizQuestion[],
  passingScore: 70,
  allowRetakes: true,
  maxAttempts: 3,
  shuffleQuestions: true,
  shuffleOptions: true,
  showCorrectAfter: true,
};

const groupsContent: DocumentContent = {
  type: 'document',
  markdown: `# Understanding Groups

Groups are the core of organizing in BuildIt. They provide a secure space for collaboration.

## Types of Groups

### Open Groups
- Anyone can join with the invite link
- Good for broad coalitions and public organizing

### Closed Groups
- Require approval to join
- Better for sensitive organizing

### Secret Groups
- Don't appear in any listings
- Only discoverable via direct invite
- Maximum privacy for sensitive work

## Group Roles

### Member
- Can read and send messages
- Participate in discussions
- Access enabled modules

### Moderator
- All member permissions
- Can approve new members
- Can moderate content

### Admin
- All moderator permissions
- Can change group settings
- Can enable/disable modules
- Can manage roles

## Joining a Group

1. Receive an invite link from a group member
2. Open the link in BuildIt
3. Review the group information
4. Click "Join" (or "Request to Join" for closed groups)

## Creating a Group

1. Go to Groups → Create New
2. Choose your group type
3. Set up basic info (name, description, image)
4. Configure modules (events, mutual aid, etc.)
5. Invite members
`,
};

const messagingContent: DocumentContent = {
  type: 'document',
  markdown: `# Secure Messaging

All messages in BuildIt are end-to-end encrypted. Only you and the recipient can read them.

## How Encryption Works

1. **Your message** is encrypted with the recipient's public key
2. **Wrapped in a "gift wrap"** that hides even the metadata
3. **Transmitted** via relays or BLE mesh
4. **Only the recipient** can decrypt with their private key

## Direct Messages (DMs)

- One-on-one private conversations
- Fully end-to-end encrypted
- Metadata protected via NIP-17

## Group Messages

- Messages within a group
- Encrypted for all group members
- Only current members can read

## Message Features

- **Text formatting** - Bold, italic, links
- **Reactions** - React with emoji
- **Replies** - Quote and reply to messages
- **File sharing** - Share encrypted files

## Best Practices

1. **Verify identities** out-of-band when possible
2. **Don't screenshot** sensitive messages
3. **Use disappearing messages** for sensitive content
4. **Remember**: Old messages remain encrypted but still exist
`,
};

const messagingQuiz: QuizContent = {
  type: 'quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Who can read your encrypted messages in BuildIt?',
      options: [
        'BuildIt developers',
        'Relay operators',
        'Only you and the intended recipient(s)',
        'Anyone with your public key',
      ],
      correctAnswer: 'Only you and the intended recipient(s)',
      explanation: 'End-to-end encryption means only the intended recipients with the correct private keys can decrypt messages.',
      points: 10,
      order: 1,
    },
    {
      id: 'q2',
      type: 'true-false',
      question: 'Group messages are encrypted for all current group members.',
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'Group messages are encrypted so all current members can read them.',
      points: 10,
      order: 2,
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What does "gift wrapping" (NIP-17) protect?',
      options: [
        'Message content only',
        'Metadata like sender and recipient',
        'Your device from malware',
        'Messages from being deleted',
      ],
      correctAnswer: 'Metadata like sender and recipient',
      explanation: 'Gift wrapping (NIP-17) provides metadata protection, hiding who is talking to whom.',
      points: 10,
      order: 3,
    },
  ] as QuizQuestion[],
  passingScore: 70,
  allowRetakes: true,
  maxAttempts: 3,
  shuffleQuestions: true,
  shuffleOptions: true,
  showCorrectAfter: true,
};

const navigationContent: DocumentContent = {
  type: 'document',
  markdown: `# Navigation & Features

Let's explore the BuildIt interface and discover key features.

## Main Navigation

### Home
- Your activity feed
- Recent messages and updates
- Quick actions

### Groups
- List of your groups
- Group discovery (for open groups)
- Create new groups

### Messages
- Direct message conversations
- Message search

### Settings
- Profile management
- Security settings
- Module preferences

## Key Features

### Events Module
- Create and manage events
- RSVP tracking
- Calendar integration

### Mutual Aid Module
- Request and offer help
- Rideshare coordination
- Resource sharing

### Documents Module
- Collaborative document editing
- Encrypted file storage

### Training Module
- Take courses like this one!
- Track certifications
- Live training sessions

## Keyboard Shortcuts (Desktop)

- \`Ctrl/Cmd + K\` - Quick search
- \`Ctrl/Cmd + N\` - New message
- \`Ctrl/Cmd + G\` - Go to group
- \`Esc\` - Close dialogs

## Mobile Tips

- Swipe right to access navigation
- Long press for quick actions
- Pull down to refresh
`,
};

export const appBasicsTemplate: CourseTemplate = {
  id: 'app-basics',
  title: 'BuildIt Basics',
  description: 'Learn how to use the BuildIt app effectively. Covers identity creation, groups, messaging, and navigation.',
  category: 'app-basics',
  difficulty: 'beginner',
  estimatedHours: 1,
  imageUrl: '/images/training/app-basics.png',
  certificationEnabled: true,
  certificationExpiryDays: undefined, // No expiry
  modules: [
    {
      title: 'Getting Started',
      description: 'Welcome to BuildIt and creating your identity',
      estimatedMinutes: 20,
      lessons: [
        {
          type: 'document',
          title: 'Welcome to BuildIt',
          description: 'Introduction to the platform and what you\'ll learn',
          estimatedMinutes: 5,
          requiredForCertification: false,
          content: welcomeContent,
        },
        {
          type: 'document',
          title: 'Creating Your Identity',
          description: 'Understanding keys and setting up your secure identity',
          estimatedMinutes: 10,
          requiredForCertification: true,
          content: identityContent,
        },
        {
          type: 'quiz',
          title: 'Identity Basics Quiz',
          description: 'Test your understanding of identity and key management',
          estimatedMinutes: 5,
          requiredForCertification: true,
          content: identityQuiz,
        },
      ],
    },
    {
      title: 'Groups & Collaboration',
      description: 'Understanding and working with groups',
      estimatedMinutes: 15,
      lessons: [
        {
          type: 'document',
          title: 'Understanding Groups',
          description: 'Learn about group types, roles, and how to join or create groups',
          estimatedMinutes: 10,
          requiredForCertification: true,
          content: groupsContent,
        },
        {
          type: 'interactive',
          title: 'Create Your First Group',
          description: 'Hands-on exercise to create a test group',
          estimatedMinutes: 5,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Secure Messaging',
      description: 'Sending encrypted messages',
      estimatedMinutes: 20,
      lessons: [
        {
          type: 'document',
          title: 'Secure Messaging Basics',
          description: 'How encryption protects your messages',
          estimatedMinutes: 10,
          requiredForCertification: true,
          content: messagingContent,
        },
        {
          type: 'quiz',
          title: 'Messaging Quiz',
          description: 'Test your understanding of secure messaging',
          estimatedMinutes: 5,
          requiredForCertification: true,
          content: messagingQuiz,
        },
        {
          type: 'interactive',
          title: 'Send Your First Encrypted Message',
          description: 'Practice sending a secure message',
          estimatedMinutes: 5,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Navigation & Features',
      description: 'Exploring the app interface',
      estimatedMinutes: 10,
      lessons: [
        {
          type: 'document',
          title: 'App Navigation',
          description: 'Navigating the interface and discovering features',
          estimatedMinutes: 10,
          requiredForCertification: false,
          content: navigationContent,
        },
      ],
    },
  ],
};
