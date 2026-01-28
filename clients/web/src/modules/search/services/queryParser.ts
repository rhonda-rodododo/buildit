/**
 * Query Parser Service
 * Parses search queries into structured form with filters, phrases, and intent detection
 */

import type { ModuleType } from '@/types/modules';
import type {
  ParsedQuery,
  QueryFilter,
  QueryIntent,
  SearchScope,
} from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Organizing-specific concept expansions
 * Maps common organizing terms to related concepts
 */
const CONCEPT_EXPANSIONS: Record<string, string[]> = {
  // Events
  meeting: ['event', 'gathering', 'session', 'call', 'assembly', 'caucus'],
  event: ['meeting', 'gathering', 'action', 'rally', 'march'],
  rally: ['march', 'protest', 'demonstration', 'action', 'event'],
  action: ['event', 'rally', 'protest', 'campaign', 'direct action'],

  // Finance
  budget: ['finance', 'money', 'funding', 'costs', 'expenses', 'dues'],
  dues: ['membership', 'payment', 'contribution', 'budget', 'finance'],
  fundraising: ['donation', 'campaign', 'money', 'grant', 'crowdfunding'],

  // Governance
  vote: ['ballot', 'poll', 'election', 'proposal', 'decision'],
  proposal: ['motion', 'resolution', 'vote', 'decision', 'initiative'],
  election: ['vote', 'ballot', 'candidate', 'nomination'],

  // Organizing
  campaign: ['drive', 'effort', 'initiative', 'action', 'movement'],
  outreach: ['canvassing', 'phonebank', 'doorknock', 'tabling'],
  canvassing: ['doorknock', 'outreach', 'petitioning', 'signatures'],

  // Communication
  message: ['dm', 'chat', 'conversation', 'thread'],
  announcement: ['news', 'update', 'notice', 'broadcast'],

  // Mutual aid
  request: ['need', 'ask', 'help', 'assistance'],
  offer: ['give', 'provide', 'volunteer', 'share'],
  rideshare: ['carpool', 'ride', 'transport', 'pickup'],

  // Documentation
  document: ['doc', 'file', 'paper', 'record'],
  wiki: ['knowledge', 'documentation', 'guide', 'reference'],
  minutes: ['notes', 'record', 'transcript', 'summary'],
};

/**
 * Common stop words to filter out
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
  'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
  'or', 'she', 'that', 'the', 'they', 'to', 'was', 'were',
  'which', 'with', 'you', 'your', 'this', 'these', 'those',
]);

/**
 * Filter operators for query syntax
 */
const FILTER_PATTERNS: Array<{
  pattern: RegExp;
  field: string;
  operator: QueryFilter['operator'];
  transform?: (match: string) => unknown;
}> = [
  // @author:pubkey or @username
  {
    pattern: /@(\w+)/g,
    field: 'author',
    operator: 'eq',
    transform: (match) => match,
  },
  // #tag
  {
    pattern: /#([\w-]+)/g,
    field: 'tag',
    operator: 'contains',
    transform: (match) => match.toLowerCase(),
  },
  // type:events or module:events
  {
    pattern: /(?:type|module):(\w+)/gi,
    field: 'moduleType',
    operator: 'eq',
    transform: (match) => match.toLowerCase() as ModuleType,
  },
  // group:groupId
  {
    pattern: /group:([\w-]+)/gi,
    field: 'groupId',
    operator: 'eq',
    transform: (match) => match,
  },
  // date:2024-01-01 or date:today or date:yesterday
  {
    pattern: /date:([\w-]+)/gi,
    field: 'date',
    operator: 'eq',
    transform: (match) => parseDateValue(match),
  },
  // before:2024-01-01
  {
    pattern: /before:([\w-]+)/gi,
    field: 'date',
    operator: 'lt',
    transform: (match) => parseDateValue(match),
  },
  // after:2024-01-01
  {
    pattern: /after:([\w-]+)/gi,
    field: 'date',
    operator: 'gt',
    transform: (match) => parseDateValue(match),
  },
  // status:open or status:closed
  {
    pattern: /status:(\w+)/gi,
    field: 'status',
    operator: 'eq',
    transform: (match) => match.toLowerCase(),
  },
];

/**
 * Temporal patterns for intent detection
 */
const TEMPORAL_PATTERNS: Array<{
  pattern: RegExp;
  intent: QueryIntent;
}> = [
  {
    pattern: /\b(upcoming|future|next|soon)\b/i,
    intent: {
      type: 'temporal',
      params: { direction: 'future', relative: true },
    },
  },
  {
    pattern: /\b(past|previous|last|recent|earlier)\b/i,
    intent: {
      type: 'temporal',
      params: { direction: 'past', relative: true },
    },
  },
  {
    pattern: /\b(today|tonight)\b/i,
    intent: {
      type: 'temporal',
      params: { period: 'today' },
    },
  },
  {
    pattern: /\b(tomorrow)\b/i,
    intent: {
      type: 'temporal',
      params: { period: 'tomorrow' },
    },
  },
  {
    pattern: /\b(yesterday)\b/i,
    intent: {
      type: 'temporal',
      params: { period: 'yesterday' },
    },
  },
  {
    pattern: /\bthis\s+(week|month|year)\b/i,
    intent: {
      type: 'temporal',
      params: { period: 'this', unit: '$1' },
    },
  },
  {
    pattern: /\blast\s+(week|month|year)\b/i,
    intent: {
      type: 'temporal',
      params: { period: 'last', unit: '$1' },
    },
  },
];

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse a date value from query syntax
 */
function parseDateValue(value: string): number {
  const now = new Date();
  const lowered = value.toLowerCase();

  switch (lowered) {
    case 'today':
      return startOfDay(now).getTime();
    case 'yesterday':
      return startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)).getTime();
    case 'tomorrow':
      return startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000)).getTime();
    case 'thisweek':
    case 'this-week':
      return startOfWeek(now).getTime();
    case 'lastweek':
    case 'last-week':
      return startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).getTime();
    case 'thismonth':
    case 'this-month':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    default:
      // Try to parse as ISO date
      const parsed = Date.parse(value);
      return isNaN(parsed) ? now.getTime() : parsed;
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

/**
 * Extract quoted phrases from query
 */
function extractPhrases(query: string): { phrases: string[]; remaining: string } {
  const phrases: string[] = [];
  let remaining = query;

  // Match "quoted phrases" or 'quoted phrases'
  const phrasePattern = /["']([^"']+)["']/g;
  let match;

  while ((match = phrasePattern.exec(query)) !== null) {
    phrases.push(match[1].trim());
    remaining = remaining.replace(match[0], ' ');
  }

  return { phrases, remaining: remaining.trim() };
}

/**
 * Extract filters from query syntax
 */
function extractFilters(query: string): { filters: QueryFilter[]; remaining: string } {
  const filters: QueryFilter[] = [];
  let remaining = query;

  for (const { pattern, field, operator, transform } of FILTER_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(query)) !== null) {
      const rawValue = match[1];
      const value = transform ? transform(rawValue) : rawValue;

      filters.push({
        field,
        operator,
        value: value as string | number | boolean | string[],
      });

      remaining = remaining.replace(match[0], ' ');
    }
  }

  return { filters, remaining: remaining.trim() };
}

/**
 * Detect query intent from natural language patterns
 */
function detectIntent(query: string): QueryIntent | undefined {
  for (const { pattern, intent } of TEMPORAL_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      // Replace placeholders in params with captured groups
      const params = { ...intent.params };
      if (match[1] && params.unit === '$1') {
        params.unit = match[1].toLowerCase();
      }
      return { ...intent, params };
    }
  }

  return undefined;
}

/**
 * Tokenize and stem keywords
 */
function tokenizeKeywords(text: string): string[] {
  // Split on whitespace and punctuation
  const tokens = text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter(Boolean);

  // Filter stop words and short tokens
  return tokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token)
  );
}

/**
 * Expand keywords with synonyms/related concepts
 */
function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>();

  for (const keyword of keywords) {
    expanded.add(keyword);

    // Check for concept expansions
    const synonyms = CONCEPT_EXPANSIONS[keyword];
    if (synonyms) {
      for (const syn of synonyms) {
        expanded.add(syn);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Simple stemmer for English words
 * Handles common suffixes
 */
function stem(word: string): string {
  // Very basic stemming - could use a proper library for production
  return word
    .replace(/ies$/, 'y')
    .replace(/es$/, '')
    .replace(/s$/, '')
    .replace(/ing$/, '')
    .replace(/ed$/, '')
    .replace(/ly$/, '')
    .replace(/ment$/, '')
    .replace(/tion$/, '')
    .replace(/ness$/, '');
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a raw search query into a structured ParsedQuery
 */
export function parseQuery(raw: string, scope: SearchScope): ParsedQuery {
  if (!raw || typeof raw !== 'string') {
    return {
      raw: '',
      keywords: [],
      phrases: [],
      expandedTerms: [],
      filters: [],
      intent: undefined,
      scope,
    };
  }

  const trimmed = raw.trim();

  // Extract quoted phrases first
  const { phrases, remaining: afterPhrases } = extractPhrases(trimmed);

  // Extract filter syntax
  const { filters, remaining: afterFilters } = extractFilters(afterPhrases);

  // Detect intent from remaining text
  const intent = detectIntent(afterFilters);

  // Tokenize remaining text into keywords
  const keywords = tokenizeKeywords(afterFilters);

  // Stem keywords
  const stemmedKeywords = keywords.map(stem);

  // Expand with synonyms
  const expandedTerms = expandKeywords(stemmedKeywords);

  return {
    raw: trimmed,
    keywords: stemmedKeywords,
    phrases,
    expandedTerms,
    filters,
    intent,
    scope,
  };
}

/**
 * Build a display-friendly representation of the parsed query
 */
export function formatParsedQuery(query: ParsedQuery): string {
  const parts: string[] = [];

  if (query.phrases.length > 0) {
    parts.push(query.phrases.map((p) => `"${p}"`).join(' '));
  }

  if (query.keywords.length > 0) {
    parts.push(query.keywords.join(' '));
  }

  if (query.filters.length > 0) {
    const filterStrs = query.filters.map((f) => {
      switch (f.field) {
        case 'author':
          return `@${f.value}`;
        case 'tag':
          return `#${f.value}`;
        default:
          return `${f.field}:${f.value}`;
      }
    });
    parts.push(filterStrs.join(' '));
  }

  return parts.join(' ') || query.raw;
}

/**
 * Check if a query has any meaningful content
 */
export function isEmptyQuery(query: ParsedQuery): boolean {
  return (
    query.keywords.length === 0 &&
    query.phrases.length === 0 &&
    query.filters.length === 0
  );
}

/**
 * Get concept expansions dictionary
 */
export function getConceptExpansions(): Record<string, string[]> {
  return { ...CONCEPT_EXPANSIONS };
}

/**
 * Add custom concept expansion
 */
export function addConceptExpansion(term: string, synonyms: string[]): void {
  CONCEPT_EXPANSIONS[term.toLowerCase()] = synonyms.map((s) => s.toLowerCase());
}
