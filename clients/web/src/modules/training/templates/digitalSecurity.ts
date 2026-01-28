/**
 * Digital Security Training Template
 * Advanced digital security practices
 */

import type { CourseTemplate, DocumentContent, QuizContent, QuizQuestion } from '../types';

const encryptionContent: DocumentContent = {
  type: 'document',
  markdown: `# Understanding Encryption

Encryption is the foundation of digital security. Let's understand how it works.

## What is Encryption?

Encryption transforms readable data (plaintext) into unreadable data (ciphertext) using a key. Only those with the correct key can decrypt it.

## Types of Encryption

### Symmetric Encryption
- Same key encrypts and decrypts
- Fast and efficient
- Challenge: How to share the key securely?
- Example: AES (Advanced Encryption Standard)

### Asymmetric (Public Key) Encryption
- Two keys: public and private
- Public key encrypts, private key decrypts
- No need to share secret keys
- Example: RSA, Elliptic Curve (secp256k1)

### End-to-End Encryption (E2EE)
- Messages encrypted on your device
- Decrypted only on recipient's device
- Service provider cannot read content
- BuildIt uses E2EE for all messages

## Encryption in BuildIt

### NIP-44 (Content Encryption)
- ChaCha20-Poly1305 algorithm
- Encrypts message content
- Shared secret derived from keys

### NIP-17 (Gift Wrapping)
- Wraps encrypted message in another layer
- Hides metadata (who's talking to whom)
- Additional privacy protection

## Encryption Limitations

- Encryption protects content, not always metadata
- Doesn't protect if device is compromised
- Doesn't prevent recipient from sharing
- Key management is critical

## Key Concepts

### Perfect Forward Secrecy
- Even if keys are compromised later, past messages remain secure
- Achieved through ephemeral key exchange

### Deniability
- Cannot prove a specific person sent a message
- Important for plausible deniability

### Key Verification
- How do you know a public key belongs to who you think?
- Out-of-band verification is important
`,
};

const vpnTorContent: DocumentContent = {
  type: 'document',
  markdown: `# VPNs and Tor

Understanding anonymity tools and when to use them.

## VPNs (Virtual Private Networks)

### What VPNs Do
- Encrypt traffic between you and VPN server
- Hide your IP from websites
- Bypass geographic restrictions

### What VPNs Don't Do
- Make you anonymous (VPN knows your IP)
- Protect against malware
- Guarantee privacy (VPN sees your traffic)

### Choosing a VPN
- **No-log policy** verified by audits
- **Jurisdiction** outside surveillance alliances
- **Open source** clients preferred
- **Recommended**: Mullvad, ProtonVPN, IVPN

### When to Use VPN
- Public WiFi
- Hiding traffic from ISP
- Accessing region-locked content
- Basic privacy layer

## Tor (The Onion Router)

### How Tor Works
1. Traffic encrypted in multiple layers
2. Passes through 3 random relays
3. Each relay only knows previous and next hop
4. No single point knows both source and destination

### Tor vs VPN
| Aspect | VPN | Tor |
|--------|-----|-----|
| Speed | Fast | Slow |
| Trust | Trust provider | Distributed trust |
| Anonymity | Low | High |
| Metadata | Provider sees | Nobody sees full picture |

### Tor Browser
- Pre-configured for anonymity
- Blocks fingerprinting
- Don't resize window
- Don't install extensions
- Don't log into personal accounts

### When to Use Tor
- High-risk research
- Anonymous communication
- Whistleblowing
- Accessing .onion sites

### Tor Limitations
- Slow for large transfers
- Exit nodes can see unencrypted traffic
- Some sites block Tor
- Not for real-time communication

## Combining VPN + Tor

### VPN → Tor
- VPN doesn't see Tor usage
- ISP sees VPN, not Tor
- Exit node sees VPN IP (if VPN leaks)

### Tor → VPN
- Generally not recommended
- Defeats Tor's anonymity properties
- Complex configuration

## Tails OS

### What is Tails?
- Live operating system
- Runs from USB
- All traffic through Tor
- Leaves no trace

### When to Use Tails
- Maximum anonymity needs
- Using untrusted computers
- Sensitive research
- At-risk journalism
`,
};

const metadataContent: DocumentContent = {
  type: 'document',
  markdown: `# Metadata and Surveillance

Understanding what data is collected beyond content.

## What is Metadata?

Metadata is "data about data" - information that describes the context of communications:

- **Who** communicated
- **When** the communication occurred
- **How long** it lasted
- **Where** devices were located
- **What** type of communication

## Why Metadata Matters

> "We kill people based on metadata." - Former NSA Director Michael Hayden

Metadata reveals:
- Social networks and associations
- Patterns of life
- Location history
- Relationship dynamics
- Activity schedules

## Types of Metadata

### Communication Metadata
- Sender and recipient
- Timestamps
- Message size
- Frequency of contact

### Device Metadata
- Device identifiers (IMEI, MAC)
- Operating system
- Installed apps
- Battery level

### Location Metadata
- GPS coordinates
- Cell tower connections
- WiFi networks
- Bluetooth beacons

### Network Metadata
- IP addresses
- DNS queries
- Connection timing
- Traffic patterns

## Metadata Collection

### By Platforms
- Social media interactions
- App usage analytics
- Account associations
- Behavioral patterns

### By Networks
- ISPs log connection metadata
- Cell carriers track location
- WiFi can identify presence

### By Governments
- Mass surveillance programs
- Data requests to companies
- Traffic analysis
- Metadata retention laws

## Protecting Against Metadata

### Minimize Collection
- Use privacy-respecting services
- Disable unnecessary features
- Review app permissions

### Anonymize Metadata
- Tor hides network metadata
- BuildIt's NIP-17 wraps sender/recipient
- Burner devices hide identity

### Obscure Patterns
- Vary routines
- Use multiple channels
- Counter-surveillance

### Technical Measures
- Airplane mode when not needed
- Faraday bags
- MAC address randomization
- VPN/Tor
`,
};

const digitalSecurityQuiz: QuizContent = {
  type: 'quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main difference between symmetric and asymmetric encryption?',
      options: [
        'Symmetric is stronger than asymmetric',
        'Symmetric uses one key, asymmetric uses a key pair',
        'Asymmetric is faster than symmetric',
        'Symmetric works offline, asymmetric requires internet',
      ],
      correctAnswer: 'Symmetric uses one key, asymmetric uses a key pair',
      explanation: 'Symmetric encryption uses the same key for encryption and decryption, while asymmetric uses a public/private key pair.',
      points: 10,
      order: 1,
    },
    {
      id: 'q2',
      type: 'true-false',
      question: 'A VPN makes you completely anonymous online.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'VPNs hide your IP from websites but the VPN provider knows your real IP. For stronger anonymity, use Tor.',
      points: 10,
      order: 2,
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What does NIP-17 (gift wrapping) protect in BuildIt?',
      options: [
        'Message content only',
        'Metadata - who is communicating with whom',
        'Your password',
        'Your IP address',
      ],
      correctAnswer: 'Metadata - who is communicating with whom',
      explanation: 'NIP-17 wraps messages to hide the sender and recipient, protecting communication metadata.',
      points: 10,
      order: 3,
    },
    {
      id: 'q4',
      type: 'multi-select',
      question: 'Which of the following are types of metadata? (Select all that apply)',
      options: [
        'Message content',
        'Timestamps',
        'Location data',
        'Contact lists',
      ],
      correctAnswer: ['Timestamps', 'Location data', 'Contact lists'],
      explanation: 'Metadata is information about communications, not the content itself. Timestamps, location, and contact lists are all metadata.',
      points: 15,
      order: 4,
    },
    {
      id: 'q5',
      type: 'multiple-choice',
      question: 'When should you use Tor instead of a VPN?',
      options: [
        'For streaming video',
        'When you need high-speed downloads',
        'When you need strong anonymity',
        'For all internet use',
      ],
      correctAnswer: 'When you need strong anonymity',
      explanation: 'Tor provides stronger anonymity than VPN but is slower. Use it when anonymity is critical.',
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

const deviceSecurityContent: DocumentContent = {
  type: 'document',
  markdown: `# Advanced Device Security

Protecting your devices from sophisticated threats.

## Phone Security

### Lock Screen
- Use 6+ digit PIN (not 4)
- Avoid biometrics at high-risk events (can be compelled)
- Set auto-lock to minimum time

### Encryption
- Enable full-disk encryption
- iOS: Enabled by default with passcode
- Android: Enable in Settings → Security

### App Permissions
- Review all permissions
- Revoke unnecessary access
- Check regularly for new apps

### High-Risk Situations
- Use a burner phone
- Remove SIM when not needed
- Disable biometrics
- Know how to quick-wipe

## Computer Security

### Disk Encryption
- macOS: FileVault
- Windows: BitLocker (Pro) or VeraCrypt
- Linux: LUKS

### Secure Boot
- Enable UEFI Secure Boot
- Set BIOS password
- Disable boot from USB when not needed

### Malware Protection
- Keep OS updated
- Use reputable antivirus
- Don't disable security features
- Be cautious with downloads

### Browser Security
- Use Firefox with privacy settings
- Install uBlock Origin
- Disable third-party cookies
- Consider Brave or Tor Browser

## Physical Security

### Device Theft
- Enable Find My / remote wipe
- Use strong passwords
- Encrypt everything
- Regular backups (encrypted)

### Border Crossings
- Know your rights (varies by country)
- Consider travel devices
- Backup and wipe before crossing
- Restore after crossing

### Physical Access Attacks
- Don't leave devices unattended
- Use tamper-evident cases
- Boot from known-good media

## Secure Communications Setup

### Signal (Recommended for Phone)
- Verify Safety Numbers
- Enable disappearing messages
- Set PIN for account recovery
- Disable cloud backups

### Email
- Use ProtonMail or Tutanota
- Enable PGP where possible
- Don't use work email for organizing

### Cloud Storage
- Use end-to-end encrypted services
- Or encrypt files before upload
- Consider self-hosted options
`,
};

export const digitalSecurityTemplate: CourseTemplate = {
  id: 'digital-security',
  title: 'Digital Security',
  description: 'Advanced digital security practices including encryption, anonymity tools, metadata protection, and device security.',
  category: 'digital-security',
  difficulty: 'intermediate',
  estimatedHours: 3,
  imageUrl: '/images/training/digital-security.png',
  certificationEnabled: true,
  certificationExpiryDays: 365,
  modules: [
    {
      title: 'Understanding Encryption',
      description: 'How encryption protects your data',
      estimatedMinutes: 30,
      lessons: [
        {
          type: 'document',
          title: 'Encryption Fundamentals',
          description: 'Learn how encryption works and protects your communications',
          estimatedMinutes: 20,
          requiredForCertification: true,
          content: encryptionContent,
        },
        {
          type: 'interactive',
          title: 'Key Verification Practice',
          description: 'Practice verifying keys with a partner',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'VPNs and Tor',
      description: 'Anonymity and privacy tools',
      estimatedMinutes: 35,
      lessons: [
        {
          type: 'document',
          title: 'VPNs and Tor',
          description: 'Understanding anonymity tools and when to use them',
          estimatedMinutes: 25,
          requiredForCertification: true,
          content: vpnTorContent,
        },
        {
          type: 'video',
          title: 'Setting Up Tor Browser',
          description: 'How to install and use Tor Browser safely',
          estimatedMinutes: 10,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Metadata Protection',
      description: 'Understanding and protecting against metadata surveillance',
      estimatedMinutes: 25,
      lessons: [
        {
          type: 'document',
          title: 'Metadata and Surveillance',
          description: 'What metadata reveals and how to protect it',
          estimatedMinutes: 20,
          requiredForCertification: true,
          content: metadataContent,
        },
        {
          type: 'interactive',
          title: 'Metadata Audit',
          description: 'Audit your own metadata exposure',
          estimatedMinutes: 5,
          requiredForCertification: false,
        },
      ],
    },
    {
      title: 'Device Security',
      description: 'Securing your phones and computers',
      estimatedMinutes: 40,
      lessons: [
        {
          type: 'document',
          title: 'Advanced Device Security',
          description: 'Comprehensive device protection strategies',
          estimatedMinutes: 25,
          requiredForCertification: true,
          content: deviceSecurityContent,
        },
        {
          type: 'quiz',
          title: 'Digital Security Quiz',
          description: 'Test your understanding of digital security concepts',
          estimatedMinutes: 15,
          requiredForCertification: true,
          content: digitalSecurityQuiz,
        },
      ],
    },
  ],
};
