# Training Module: Default Content

## Overview

The Training module includes pre-built course templates covering essential topics for organizers. These templates provide ready-to-use training content that organizations can customize for their needs.

## Default Course Templates

### 1. BuildIt Basics

**Category:** `app-basics`
**Difficulty:** Beginner
**Estimated Time:** 1 hour

Teaches new users how to effectively use the BuildIt platform.

**Modules:**
1. **Getting Started**
   - Welcome to BuildIt (video)
   - Creating Your Identity (document)
   - Identity Basics Quiz

2. **Groups & Messaging**
   - Joining and Creating Groups (video)
   - Secure Messaging (video)
   - Messaging Quiz

3. **Core Features**
   - Events & RSVPs (document)
   - Using the CRM (video)
   - File Sharing (document)
   - Features Quiz

### 2. Operational Security Basics

**Category:** `opsec`
**Difficulty:** Beginner
**Estimated Time:** 2 hours

Essential security practices for organizers and activists.

**Modules:**
1. **Threat Modeling**
   - Understanding Your Adversaries (document)
   - Build Your Threat Model (interactive)
   - Threat Assessment Quiz

2. **Physical Security**
   - Event Security Basics (video)
   - Tail Awareness (document)
   - Physical Security Quiz

3. **Communication Security**
   - Secure Communication Practices (document)
   - When to Use What Channel (interactive)
   - Communication Security Quiz

4. **Operational Planning**
   - Need-to-Know Principles (document)
   - Compartmentalization (video)
   - Operations Quiz

### 3. Digital Security

**Category:** `digital-security`
**Difficulty:** Intermediate
**Estimated Time:** 3 hours

Comprehensive digital security training for high-risk individuals.

**Modules:**
1. **Device Security**
   - Securing Your Phone (video)
   - Computer Security Basics (document)
   - Encryption Best Practices (document)
   - Device Security Quiz

2. **Online Privacy**
   - Browser Privacy (video)
   - VPN and Tor Usage (document)
   - Social Media Hygiene (document)
   - Privacy Quiz

3. **Account Security**
   - Password Management (video)
   - Two-Factor Authentication (document)
   - Phishing Recognition (interactive)
   - Account Security Quiz

4. **Data Protection**
   - Secure File Storage (document)
   - Backup Strategies (document)
   - Data Destruction (video)
   - Data Protection Quiz

### 4. Jail Support Training

**Category:** `legal`
**Difficulty:** Intermediate
**Estimated Time:** 4 hours

Training for jail support volunteers and legal observers.

**Modules:**
1. **Legal Framework**
   - Know Your Rights (video)
   - Common Charges at Protests (document)
   - Bail System Overview (document)
   - Legal Framework Quiz

2. **Jail Support Basics**
   - What is Jail Support? (video)
   - Arrestee Intake Process (document)
   - Working with NLG (document)
   - Jail Support Quiz

3. **Practical Skills**
   - Information Gathering (document)
   - Family Communication (video)
   - Coordinating Releases (document)
   - Skills Assessment

4. **Hotline Operations**
   - Staffing the Hotline (video)
   - Call Handling Protocol (document)
   - De-escalation Techniques (video)
   - Live Session: Role Play Practice
   - Final Assessment

## Template Structure

```typescript
interface CourseTemplate {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  imageUrl?: string;
  modules: ModuleTemplate[];
  certificationEnabled: boolean;
  certificationExpiryDays?: number;
}

interface ModuleTemplate {
  title: string;
  description?: string;
  lessons: LessonTemplate[];
}

interface LessonTemplate {
  type: LessonType;
  title: string;
  description?: string;
  content: Partial<LessonContent>;
  estimatedMinutes: number;
  requiredForCertification?: boolean;
  passingScore?: number;
}
```

## Template Usage

### Creating Course from Template

```typescript
const manager = getTrainingManager();

// Create course from template
const course = await manager.createCourseFromTemplate(
  templates.appBasics,
  groupId
);
```

### Customization

Organizations can:
- Modify existing lessons
- Add organization-specific modules
- Adjust quiz questions
- Replace videos with custom content
- Change passing scores
- Add/remove certification requirements

## Content Guidelines

### Video Content

- Keep videos under 10 minutes
- Include captions/transcripts
- Use clear, accessible language
- Avoid dated references

### Document Content

- Use markdown for formatting
- Include practical examples
- Provide external resource links
- Keep paragraphs short

### Quiz Questions

- Mix question types
- Provide immediate feedback
- Explain correct answers
- Test practical application, not memorization

## Localization

Templates support multiple languages:
- English (en) - Primary
- Spanish (es)
- French (fr)
- Arabic (ar)

Translation keys are organized by template:
```typescript
training: {
  templates: {
    appBasics: {
      title: 'BuildIt Basics',
      modules: {
        gettingStarted: {
          title: 'Getting Started',
          // ...
        }
      }
    }
  }
}
```

## Contributing Content

Organizations can contribute templates:

1. Create course structure following guidelines
2. Submit for review
3. Content team reviews for:
   - Accuracy
   - Accessibility
   - Security implications
   - Legal considerations
4. Approved templates added to default library

## Seed Data

Templates are installed via the `seeds.ts` file:

```typescript
export const trainingSeeds: SeedData = {
  seed: async (db, groupId) => {
    const manager = getTrainingManager();

    // Create default courses
    for (const template of defaultTemplates) {
      await manager.createCourseFromTemplate(template, groupId);
    }
  }
};
```

## Future Templates (Planned)

- Street Medic Training
- De-escalation Techniques
- Media Training
- Legal Observer Training
- Community Self-Defense
- Mutual Aid Coordination
- Digital Organizing
- Coalition Building
