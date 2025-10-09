/**
 * Public Page Templates
 * Pre-built content templates for common page types
 */

import type { PublicPage, PageType, SEOMetadata } from './types';

interface PageTemplate {
  title: string;
  slug: string;
  type: PageType;
  content: string;
  seo: SEOMetadata;
  description: string;
}

export const PAGE_TEMPLATES: Record<PageType, PageTemplate> = {
  landing: {
    title: 'Welcome',
    slug: 'home',
    type: 'landing',
    description: 'Main landing page for your organization',
    content: `
<h1>Welcome to Our Organization</h1>

<p>We're building a movement for social justice, economic democracy, and community power. Join us in creating the change we need.</p>

<h2>Our Mission</h2>
<p>To build power for working people and fight for a more just and equitable society through grassroots organizing, direct action, and community solidarity.</p>

<h2>Get Involved</h2>
<ul>
  <li><strong>Join a campaign:</strong> Connect with our current organizing drives</li>
  <li><strong>Attend an event:</strong> Come to our next meeting or action</li>
  <li><strong>Volunteer:</strong> Put your skills to work for the movement</li>
  <li><strong>Donate:</strong> Support our organizing efforts</li>
</ul>

<h2>Contact Us</h2>
<p>Ready to get involved? <a href="/contact">Reach out to our organizing team</a>.</p>
    `.trim(),
    seo: {
      title: 'Join Our Movement for Justice and Democracy',
      description: 'Building power for working people through grassroots organizing, direct action, and community solidarity. Get involved today.',
      robots: 'index, follow',
      ogType: 'website',
      twitterCard: 'summary_large_image',
    },
  },

  about: {
    title: 'About Us',
    slug: 'about',
    type: 'about',
    description: 'Learn about our organization and values',
    content: `
<h1>About Us</h1>

<h2>Who We Are</h2>
<p>We are a grassroots organization of workers, community members, and activists fighting for social and economic justice. Our members come from all walks of life, united by a commitment to building power for working people.</p>

<h2>Our Values</h2>
<ul>
  <li><strong>Democracy:</strong> We believe in participatory democracy and collective decision-making</li>
  <li><strong>Solidarity:</strong> We stand together across differences to build collective power</li>
  <li><strong>Justice:</strong> We fight for racial, economic, and social justice for all</li>
  <li><strong>Direct Action:</strong> We take collective action to win concrete victories</li>
  <li><strong>Mutual Aid:</strong> We support each other and build community resilience</li>
</ul>

<h2>Our History</h2>
<p>Founded in [year], our organization emerged from struggles for workplace democracy and community control. We've fought and won campaigns for living wages, tenant rights, police accountability, and environmental justice.</p>

<h2>Structure</h2>
<p>We operate as a democratic membership organization. All major decisions are made collectively through member assemblies and working groups. Leadership is accountable to the membership.</p>

<h2>Join Us</h2>
<p>Ready to build power with us? <a href="/contact">Get in touch</a> to learn more about membership.</p>
    `.trim(),
    seo: {
      title: 'About Our Organization - Our Mission, Values & History',
      description: 'Learn about our grassroots organization fighting for social and economic justice through participatory democracy and direct action.',
      robots: 'index, follow',
      ogType: 'website',
      twitterCard: 'summary',
    },
  },

  events: {
    title: 'Events Calendar',
    slug: 'events',
    type: 'events',
    description: 'Upcoming meetings, actions, and events',
    content: `
<h1>Upcoming Events</h1>

<p>Join us for our upcoming meetings, actions, trainings, and social events. All are welcome!</p>

<h2>How to Get Involved</h2>
<p>New to organizing? Start by attending one of our orientation sessions or general meetings. We'll help you find the right campaign or working group to plug into.</p>

<h2>Event Types</h2>
<ul>
  <li><strong>General Meetings:</strong> Monthly membership assemblies for strategic decisions</li>
  <li><strong>Campaign Meetings:</strong> Weekly meetings for active campaigns</li>
  <li><strong>Training Sessions:</strong> Skills workshops for organizers</li>
  <li><strong>Direct Actions:</strong> Public demonstrations and direct action campaigns</li>
  <li><strong>Social Events:</strong> Community building and celebration</li>
</ul>

<h2>Stay Updated</h2>
<p><a href="/contact">Sign up for our newsletter</a> to get event updates delivered to your inbox.</p>

<p><em>Note: This is a static events page. Individual events are managed through the Events module.</em></p>
    `.trim(),
    seo: {
      title: 'Events Calendar - Meetings, Actions & Trainings',
      description: 'Join us for upcoming organizing meetings, direct actions, training sessions, and community events. All are welcome!',
      robots: 'index, follow',
      ogType: 'website',
      twitterCard: 'summary',
    },
  },

  contact: {
    title: 'Contact Us',
    slug: 'contact',
    type: 'contact',
    description: 'Get in touch with our organizing team',
    content: `
<h1>Contact Us</h1>

<p>Want to get involved, ask questions, or learn more? We'd love to hear from you!</p>

<h2>Get In Touch</h2>
<p>Fill out the contact form below and our organizing team will get back to you within 48 hours.</p>

<p><em>Note: Contact form integration requires the Forms module.</em></p>

<h2>Email Us</h2>
<p>You can also reach us directly at: <a href="mailto:organize@example.org">organize@example.org</a></p>

<h2>Social Media</h2>
<ul>
  <li>Twitter: <a href="https://twitter.com/yourorg" target="_blank">@yourorg</a></li>
  <li>Instagram: <a href="https://instagram.com/yourorg" target="_blank">@yourorg</a></li>
  <li>Mastodon: <a href="https://mastodon.social/@yourorg" target="_blank">@yourorg@mastodon.social</a></li>
</ul>

<h2>Security & Privacy</h2>
<p>For sensitive communications, please use our <a href="https://keys.openpgp.org">PGP key</a> or contact us through Signal.</p>

<p><strong>Signal:</strong> [Your Signal number]</p>
    `.trim(),
    seo: {
      title: 'Contact Us - Join the Movement',
      description: 'Get in touch with our organizing team. We welcome new members, volunteers, and anyone interested in building power for working people.',
      robots: 'index, follow',
      ogType: 'website',
      twitterCard: 'summary',
    },
  },

  custom: {
    title: 'Custom Page',
    slug: 'custom-page',
    type: 'custom',
    description: 'Create your own custom page',
    content: `
<h1>Custom Page</h1>

<p>Start writing your custom content here...</p>

<h2>Subheading</h2>
<p>Add paragraphs, lists, images, and more using the rich text editor.</p>
    `.trim(),
    seo: {
      title: 'Custom Page',
      description: '',
      robots: 'index, follow',
    },
  },
};

/**
 * Create a new page from a template
 */
export function createPageFromTemplate(
  templateType: PageType,
  groupId: string,
  _createdBy: string,
  overrides?: Partial<PublicPage>
): Omit<PublicPage, 'id' | 'created' | 'createdBy' | 'updated'> {
  const template = PAGE_TEMPLATES[templateType];

  return {
    groupId,
    title: template.title,
    slug: template.slug,
    type: template.type,
    content: template.content,
    seo: template.seo,
    status: 'draft',
    ...overrides,
  };
}

/**
 * Get template description
 */
export function getTemplateDescription(templateType: PageType): string {
  return PAGE_TEMPLATES[templateType].description;
}

/**
 * List all available templates
 */
export function listTemplates(): Array<{
  type: PageType;
  title: string;
  description: string;
}> {
  return Object.entries(PAGE_TEMPLATES).map(([type, template]) => ({
    type: type as PageType,
    title: template.title,
    description: template.description,
  }));
}
