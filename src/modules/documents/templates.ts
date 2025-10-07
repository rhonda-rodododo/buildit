/**
 * Document Templates
 * Pre-built templates for common organizing documents
 */

import type { DocumentTemplate } from './types'

export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Template for recording meeting notes and action items',
    icon: 'FileText',
    tags: ['meeting', 'notes'],
    content: `
<h1>Meeting Notes</h1>
<p><strong>Date:</strong> [Insert Date]</p>
<p><strong>Attendees:</strong> [List attendees]</p>
<p><strong>Facilitator:</strong> [Name]</p>

<h2>Agenda</h2>
<ol>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ol>

<h2>Discussion</h2>
<p>[Key points discussed...]</p>

<h2>Decisions Made</h2>
<ul>
  <li>Decision 1</li>
  <li>Decision 2</li>
</ul>

<h2>Action Items</h2>
<table>
  <thead>
    <tr>
      <th>Action</th>
      <th>Assignee</th>
      <th>Due Date</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Example task</td>
      <td>Name</td>
      <td>Date</td>
      <td>In Progress</td>
    </tr>
  </tbody>
</table>

<h2>Next Meeting</h2>
<p><strong>Date:</strong> [Next meeting date]</p>
<p><strong>Topics:</strong> [Topics to cover]</p>
    `.trim(),
  },
  {
    id: 'proposal',
    name: 'Proposal',
    description: 'Template for creating formal proposals',
    icon: 'FileText',
    tags: ['proposal', 'governance'],
    content: `
<h1>Proposal Title</h1>

<h2>Summary</h2>
<p>[Brief 2-3 sentence summary of the proposal]</p>

<h2>Background</h2>
<p>[Context and why this proposal is needed]</p>

<h2>Proposal Details</h2>
<p>[Detailed description of what is being proposed]</p>

<h3>Objectives</h3>
<ul>
  <li>Objective 1</li>
  <li>Objective 2</li>
  <li>Objective 3</li>
</ul>

<h2>Implementation Plan</h2>
<ol>
  <li>Step 1</li>
  <li>Step 2</li>
  <li>Step 3</li>
</ol>

<h2>Resources Required</h2>
<ul>
  <li>Resource 1</li>
  <li>Resource 2</li>
</ul>

<h2>Timeline</h2>
<p>[Expected duration and key milestones]</p>

<h2>Expected Outcomes</h2>
<p>[What success looks like]</p>

<h2>Risks & Mitigation</h2>
<table>
  <thead>
    <tr>
      <th>Risk</th>
      <th>Impact</th>
      <th>Mitigation</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Example risk</td>
      <td>High/Medium/Low</td>
      <td>Mitigation strategy</td>
    </tr>
  </tbody>
</table>
    `.trim(),
  },
  {
    id: 'manifesto',
    name: 'Manifesto',
    description: 'Template for writing a manifesto or statement of principles',
    icon: 'Megaphone',
    tags: ['manifesto', 'principles'],
    content: `
<h1>Our Manifesto</h1>

<h2>Vision</h2>
<p>[Our vision for change]</p>

<h2>Core Principles</h2>
<ol>
  <li><strong>Principle 1:</strong> Description</li>
  <li><strong>Principle 2:</strong> Description</li>
  <li><strong>Principle 3:</strong> Description</li>
  <li><strong>Principle 4:</strong> Description</li>
</ol>

<h2>Our Demands</h2>
<ul>
  <li>Demand 1</li>
  <li>Demand 2</li>
  <li>Demand 3</li>
</ul>

<h2>Why We Organize</h2>
<p>[The problem we're addressing]</p>

<h2>Our Strategy</h2>
<p>[How we plan to achieve our goals]</p>

<h2>Call to Action</h2>
<p>[How people can join or support the movement]</p>

<blockquote>
  <p>"Together, we can build a better future."</p>
</blockquote>
    `.trim(),
  },
  {
    id: 'press-release',
    name: 'Press Release',
    description: 'Template for writing press releases',
    icon: 'Newspaper',
    tags: ['media', 'communications'],
    content: `
<h1>FOR IMMEDIATE RELEASE</h1>

<p><strong>Contact:</strong> [Name]<br>
<strong>Phone:</strong> [Phone]<br>
<strong>Email:</strong> [Email]<br>
<strong>Date:</strong> [Date]</p>

<h2>[Headline: Clear and Attention-Grabbing]</h2>

<h3>[Subheadline: Adds context to the headline]</h3>

<p><strong>[CITY, State]</strong> — [Opening paragraph: Who, what, when, where, why. Most newsworthy information first.]</p>

<p>[Second paragraph: Supporting details, quotes from key people, additional context]</p>

<blockquote>
  <p>"[Quote from spokesperson or leader that adds human element or emphasizes key point]"</p>
  <p>— [Name, Title]</p>
</blockquote>

<p>[Third paragraph: Additional background, statistics, or context that supports the story]</p>

<p>[Fourth paragraph: Information about next steps, future plans, or call to action]</p>

<h3>About [Organization Name]</h3>
<p>[Boilerplate: Standard paragraph about your organization, its mission, and history. This stays the same across press releases.]</p>

<p style="text-align: center;"><strong>###</strong></p>

<p><em>[Note: Three hashtags (###) signal the end of the press release]</em></p>
    `.trim(),
  },
  {
    id: 'action-plan',
    name: 'Campaign Action Plan',
    description: 'Template for planning campaigns and direct actions',
    icon: 'Target',
    tags: ['campaign', 'action', 'organizing'],
    content: `
<h1>Campaign Action Plan</h1>

<h2>Campaign Name</h2>
<p>[Name of the campaign]</p>

<h2>Campaign Goal</h2>
<p>[What we want to achieve - be specific and measurable]</p>

<h2>Timeline</h2>
<p><strong>Start Date:</strong> [Date]<br>
<strong>End Date:</strong> [Date]<br>
<strong>Duration:</strong> [Duration]</p>

<h2>Key Demands</h2>
<ol>
  <li>Demand 1</li>
  <li>Demand 2</li>
  <li>Demand 3</li>
</ol>

<h2>Strategy & Tactics</h2>
<ul>
  <li><strong>Tactic 1:</strong> [Description]</li>
  <li><strong>Tactic 2:</strong> [Description]</li>
  <li><strong>Tactic 3:</strong> [Description]</li>
</ul>

<h2>Target Audiences</h2>
<ul>
  <li><strong>Primary:</strong> [Who we need to reach/pressure]</li>
  <li><strong>Secondary:</strong> [Allies and supporters]</li>
  <li><strong>Opposition:</strong> [Who opposes us and why]</li>
</ul>

<h2>Resources Needed</h2>
<ul>
  <li>People: [Number and roles]</li>
  <li>Budget: [Estimated costs]</li>
  <li>Materials: [Supplies, equipment]</li>
  <li>Technology: [Tools and platforms]</li>
</ul>

<h2>Key Milestones</h2>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Milestone</th>
      <th>Success Criteria</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[Date]</td>
      <td>[Milestone 1]</td>
      <td>[How we'll know it's done]</td>
    </tr>
    <tr>
      <td>[Date]</td>
      <td>[Milestone 2]</td>
      <td>[How we'll know it's done]</td>
    </tr>
  </tbody>
</table>

<h2>Communications Plan</h2>
<ul>
  <li><strong>Messaging:</strong> [Key messages]</li>
  <li><strong>Channels:</strong> [Social media, press, etc.]</li>
  <li><strong>Spokespeople:</strong> [Who speaks for the campaign]</li>
</ul>

<h2>Risk Assessment</h2>
<ul>
  <li><strong>Legal risks:</strong> [Potential legal issues]</li>
  <li><strong>Safety risks:</strong> [Physical safety concerns]</li>
  <li><strong>Reputational risks:</strong> [PR considerations]</li>
  <li><strong>Mitigation:</strong> [How we address these risks]</li>
</ul>

<h2>Success Metrics</h2>
<p>[How we'll measure whether the campaign succeeded]</p>
    `.trim(),
  },
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start with a blank document',
    icon: 'File',
    tags: [],
    content: '<p></p>',
  },
]

/**
 * Initialize templates in the store
 */
export function initializeTemplates() {
  documentTemplates.forEach((template) => {
    useDocumentsStore.getState().addTemplate(template)
  })
}
