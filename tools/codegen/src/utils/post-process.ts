/**
 * Language-specific post-processing for generated code
 *
 * Extracted from the monolithic index.ts for modularity.
 */

/**
 * Post-process TypeScript code to deduplicate identical interfaces.
 * quicktype generates duplicates like OptionElement/VoteOption when the same
 * schema is referenced from different places.
 */
export function postProcessTypeScript(code: string): string {
  const baseDuplicates: [string, string][] = [
    // Governance
    ['OptionElement', 'VoteOption'],
    ['QuorumObject', 'QuorumRequirement'],
    ['ThresholdObject', 'PassingThreshold'],
    // Events
    ['LocationObject', 'Location'],
    ['RecurrenceObject', 'RecurrenceRule'],
    // Database
    ['ColumnElement', 'Column'],
    ['FilterElement', 'Filter'],
    ['SortElement', 'Sort'],
    ['ColumnOptionObject', 'ColumnOption'],
    // Custom Fields
    ['FieldElement', 'FieldDefinition'],
    ['FieldOptionsObject', 'FieldOptions'],
    ['FieldValidationObject', 'FieldValidation'],
    // Forms
    ['FormFieldElement', 'FormField'],
    // Fundraising
    ['TierElement', 'DonationTier'],
    ['UpdateElement', 'CampaignUpdate'],
    // Mutual Aid
    ['FulfillmentElement', 'Fulfillment'],
    ['ClaimedByElement', 'OfferClaim'],
    ['RecurringNeedObject', 'RecurringNeed'],
    ['RecurringAvailabilityObject', 'RecurringAvailability'],
    ['DestinationObject', 'Destination'],
    ['RecurringObject', 'Recurring'],
    // CRM
    ['AddressObject', 'Address'],
    // Wiki
    ['PermissionsObject', 'Permissions'],
    // Publishing
    ['SEOObject', 'SEO'],
  ];

  const attachmentCanonicals = ['Attachment', 'ProposalAttachment', 'DocumentAttachment'];
  for (const canonical of attachmentCanonicals) {
    if (new RegExp(`export interface ${canonical}\\s*\\{`).test(code)) {
      baseDuplicates.push(['AttachmentElement', canonical]);
      break;
    }
  }

  const duplicateMap: Record<string, string> = Object.fromEntries(baseDuplicates);

  let processed = code;

  for (const [duplicate, canonical] of Object.entries(duplicateMap)) {
    if (duplicate.length < 5 || canonical.length < 5) continue;

    const hasDuplicate = new RegExp(`export interface ${duplicate}\\s*\\{`).test(processed);
    const hasCanonical = new RegExp(`export interface ${canonical}\\s*\\{`).test(processed);

    if (hasDuplicate && hasCanonical) {
      const interfacePattern = new RegExp(
        `(\\/\\*\\*(?:[^*]|\\*(?!\\/))*\\*\\/\\s*)?` +
        `export interface ${duplicate} \\{` +
        `[\\s\\S]*?` +
        `\\n\\}\\s*\\n`,
        'g'
      );
      processed = processed.replace(interfacePattern, '\n');
      processed = processed.replace(new RegExp(`:\\s*${duplicate}(\\s*[;,\\[\\]\\}])`, 'g'), `: ${canonical}$1`);
      processed = processed.replace(new RegExp(`<${duplicate}>`, 'g'), `<${canonical}>`);
      processed = processed.replace(new RegExp(`${duplicate}\\[\\]`, 'g'), `${canonical}[]`);
    }
  }

  processed = processed.replace(/\n{3,}/g, '\n\n');
  return processed;
}

/**
 * Check if a Swift property name needs a CodingKey.
 */
function needsCodingKey(propName: string): boolean {
  if (propName === 'v') return true;
  if (propName.endsWith('ID')) return true;
  return false;
}

/**
 * Get the JSON key for a Swift property.
 */
function getJsonKey(propName: string): string {
  if (propName === 'v') return '_v';
  if (propName.endsWith('ID')) {
    return propName.slice(0, -2) + 'Id';
  }
  return propName;
}

/**
 * Post-process Swift code to add Codable, Sendable conformance
 * and proper CodingKeys.
 */
export function postProcessSwift(code: string): string {
  let processed = code.replace(
    /public struct (\w+) \{/g,
    'public struct $1: Codable, Sendable {'
  );

  processed = processed.replace(
    /public enum (\w+): String \{/g,
    'public enum $1: String, Codable, Sendable {'
  );

  processed = processed.replace(
    /public enum (\w+) \{(\s+case )/g,
    'public enum $1: String, Codable, Sendable {$2'
  );

  const lines = processed.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const structMatch = line.match(/^public struct (\w+): Codable, Sendable \{$/);

    if (structMatch) {
      const structLines: string[] = [line];
      let braceCount = 1;
      let j = i + 1;

      while (j < lines.length && braceCount > 0) {
        structLines.push(lines[j]);
        braceCount += (lines[j].match(/\{/g) || []).length;
        braceCount -= (lines[j].match(/\}/g) || []).length;
        j++;
      }

      const structBody = structLines.join('\n');
      const properties: string[] = [];
      const propMatches = structBody.matchAll(/public (?:let|var) (\w+):/g);
      for (const match of propMatches) {
        properties.push(match[1]);
      }

      const propsNeedingKeys = properties.filter(needsCodingKey);
      if (propsNeedingKeys.length > 0) {
        const codingKeysLines = properties.map((prop) => {
          if (needsCodingKey(prop)) {
            return `        case ${prop} = "${getJsonKey(prop)}"`;
          }
          return `        case ${prop}`;
        });

        const codingKeys = `
    enum CodingKeys: String, CodingKey {
${codingKeysLines.join('\n')}
    }`;

        structLines.splice(structLines.length - 1, 0, codingKeys);
      }

      result.push(...structLines);
      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Post-process Rust code to ensure proper serde attributes and naming.
 */
export function postProcessRust(code: string): string {
  let processed = code;

  processed = processed.replace(
    /\/\/ Example code that deserializes[\s\S]*?fn main\(\)[\s\S]*?\}[\s\S]*?\n\n/g,
    ''
  );

  processed = processed.replace(/use serde::\{[^}]+\};\n*/g, '');

  processed = processed.replace(
    /#\[serde\(rename = "_v"\)\]\s+#\[serde\(rename = "_v"\)\]/g,
    '#[serde(rename = "_v")]'
  );

  processed = processed.replace(/Option<Box<Vec<([^>]+)>>>/g, 'Option<Vec<$1>>');
  processed = processed.replace(/Box<Vec<([^>]+)>>/g, 'Vec<$1>');

  processed = processed.replace(
    /#\[derive\(Debug, Serialize, Deserialize\)\]/g,
    '#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]'
  );

  return processed;
}
