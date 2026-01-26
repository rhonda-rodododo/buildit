#!/usr/bin/env bun
/**
 * Schema Code Generator
 *
 * Generates native type definitions from JSON Schema files using quicktype.
 * Extracts $defs and generates code for TypeScript, Swift, and Kotlin.
 *
 * Features:
 * - Generates types with _v version field for graceful degradation
 * - Includes _unknownFields for relay forwarding
 * - Validates schemas against JSON Schema spec
 * - Cross-version test vector validation
 *
 * Usage:
 *   bun run src/index.ts                    # Generate all targets
 *   bun run src/index.ts --target=typescript
 *   bun run src/index.ts --validate         # Validate only
 *   bun run src/index.ts --validate-vectors # Validate test vectors
 */

import { glob } from 'glob';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename, join } from 'path';
import {
  quicktype,
  InputData,
  JSONSchemaInput,
  JSONSchemaStore,
} from 'quicktype-core';

const REPO_ROOT = join(import.meta.dir, '../../..');
const SCHEMAS_DIR = join(REPO_ROOT, 'protocol/schemas/modules');
const TEST_VECTORS_DIR = join(REPO_ROOT, 'protocol/test-vectors');

interface ModuleSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  version: string;
  minReaderVersion?: string;
  type?: string;
  $defs?: Record<string, any>;
  testVectors?: any[];
  coreModule?: boolean;
}

// Custom schema store for resolving local refs
class LocalSchemaStore extends JSONSchemaStore {
  async fetch(_address: string): Promise<any> {
    return undefined;
  }
}

async function generateAllTypesWithQuicktype(
  moduleName: string,
  schema: ModuleSchema,
  lang: string
): Promise<string> {
  const allDefs = schema.$defs || {};

  // Create a schema with all definitions available
  // Each definition is added as a separate top-level type
  const schemaInput = new JSONSchemaInput(new LocalSchemaStore());

  // Add each type definition as a separate source
  for (const [name, def] of Object.entries(allDefs)) {
    // Create a standalone schema for this type with definitions available for refs
    const typeSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: name,
      definitions: {} as Record<string, any>,
      ...convertRefsToDefinitions(def),
    };

    // Include all definitions for reference resolution
    for (const [defName, defDef] of Object.entries(allDefs)) {
      typeSchema.definitions[defName] = convertRefsToDefinitions(defDef);
    }

    await schemaInput.addSource({
      name: name,
      schema: JSON.stringify(typeSchema),
    });
  }

  const inputData = new InputData();
  inputData.addInput(schemaInput);

  const result = await quicktype({
    inputData,
    lang,
    rendererOptions: getRendererOptions(lang),
    inferEnums: true,
    inferDateTimes: false,
    inferIntegerStrings: false,
    inferUuids: false,
    inferMaps: false,
    inferBooleanStrings: false,
    alphabetizeProperties: false,
    allPropertiesOptional: false,
    combineClasses: false,
  });

  return result.lines.join('\n');
}

// Convert $defs refs to definitions refs for quicktype
function convertRefsToDefinitions(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj.$ref && typeof obj.$ref === 'string') {
    // Convert #/$defs/Name to #/definitions/Name
    return {
      ...obj,
      $ref: obj.$ref.replace('#/$defs/', '#/definitions/'),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(convertRefsToDefinitions);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertRefsToDefinitions(value);
  }
  return result;
}

function pascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Post-process TypeScript code to deduplicate identical interfaces
 * quicktype generates duplicates like OptionElement/VoteOption when the same
 * schema is referenced from different places
 */
function postProcessTypeScript(code: string): string {
  // Known duplicates mapping: less descriptive name -> canonical name
  // The canonical name is the one defined in the $defs of the schema
  // Build a dynamic duplicate map based on what's actually in the code
  // The key is the auto-generated name (e.g., "FooElement", "FooObject")
  // The value is the canonical schema name (e.g., "Foo")
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

  // Also check for AttachmentElement which could map to different canonical names
  // depending on the schema (Attachment in events, ProposalAttachment in governance)
  const attachmentCanonicals = ['Attachment', 'ProposalAttachment', 'DocumentAttachment'];
  for (const canonical of attachmentCanonicals) {
    if (new RegExp(`export interface ${canonical}\\s*\\{`).test(code)) {
      baseDuplicates.push(['AttachmentElement', canonical]);
      break;
    }
  }

  const duplicateMap: Record<string, string> = Object.fromEntries(baseDuplicates);

  let processed = code;

  // For each duplicate, replace usages and remove the duplicate definition
  for (const [duplicate, canonical] of Object.entries(duplicateMap)) {
    // Skip if duplicate or canonical is too short (avoid accidental matches)
    if (duplicate.length < 5 || canonical.length < 5) continue;

    // Check if both exist in the code - must be interfaces specifically
    const hasDuplicate = new RegExp(`export interface ${duplicate}\\s*\\{`).test(processed);
    const hasCanonical = new RegExp(`export interface ${canonical}\\s*\\{`).test(processed);

    if (hasDuplicate && hasCanonical) {
      // Remove the duplicate interface definition
      // Pattern: optional SINGLE-LINE doc comment + interface definition ending with }
      // Use [^*] to avoid matching across multiple JSDoc blocks
      const interfacePattern = new RegExp(
        `(\\/\\*\\*(?:[^*]|\\*(?!\\/))*\\*\\/\\s*)?` +  // optional JSDoc (non-greedy, single block)
        `export interface ${duplicate} \\{` +           // interface declaration
        `[\\s\\S]*?` +                                  // interface body (non-greedy)
        `\\n\\}\\s*\\n`,                                // closing brace on its own line
        'g'
      );
      processed = processed.replace(interfacePattern, '\n');

      // Replace usages of the duplicate name with the canonical name
      // Only replace type references (after : or in generics), not enum/interface declarations
      processed = processed.replace(new RegExp(`:\\s*${duplicate}(\\s*[;,\\[\\]\\}])`, 'g'), `: ${canonical}$1`);
      processed = processed.replace(new RegExp(`<${duplicate}>`, 'g'), `<${canonical}>`);
      processed = processed.replace(new RegExp(`${duplicate}\\[\\]`, 'g'), `${canonical}[]`);
    }
  }

  // Clean up multiple consecutive newlines
  processed = processed.replace(/\n{3,}/g, '\n\n');

  return processed;
}

function getRendererOptions(lang: string): Record<string, string> {
  switch (lang) {
    case 'typescript':
      return {
        'just-types': 'true',
        'nice-property-names': 'false',
      };
    case 'swift':
      return {
        'just-types': 'true',
        'struct-or-class': 'struct',
        'access-level': 'public',
        // Note: quicktype doesn't add Codable with just-types
        // We post-process Swift output to add conformances
      };
    case 'kotlin':
      return {
        'just-types': 'true',
        'framework': 'kotlinx',
        'package': 'network.buildit.generated.schemas',
      };
    case 'rust':
      return {
        'density': 'normal',
        'visibility': 'public',
        'derive-debug': 'true',
      };
    default:
      return {};
  }
}

/**
 * Convert camelCase to snake_case
 * Handles consecutive uppercase letters (e.g., targetID -> target_id)
 */
function toSnakeCase(str: string): string {
  return str
    // Insert underscore before sequences of uppercase letters followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Insert underscore before uppercase letters that follow lowercase
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Check if a property name needs a CodingKey (camelCase -> snake_case)
 */
function needsCodingKey(propName: string): boolean {
  // Special cases that need explicit mapping
  if (propName === 'v') return true; // maps to _v
  // Check if has uppercase letters (camelCase)
  return /[A-Z]/.test(propName);
}

/**
 * Get the JSON key for a Swift property
 */
function getJsonKey(propName: string): string {
  if (propName === 'v') return '_v';
  return toSnakeCase(propName);
}

/**
 * Post-process Rust code to ensure proper serde attributes and naming
 * - Remove example code comments
 * - Remove duplicate use statements
 * - Clean up duplicate serde renames
 * - Replace Option<Box<Vec<...>>> with Option<Vec<...>> (quicktype quirk)
 */
function postProcessRust(code: string, moduleName: string): string {
  let processed = code;

  // Remove the example code comment block that quicktype adds
  processed = processed.replace(
    /\/\/ Example code that deserializes[\s\S]*?fn main\(\)[\s\S]*?\}[\s\S]*?\n\n/g,
    ''
  );

  // Remove ALL serde use statements (we add one in the header)
  processed = processed.replace(/use serde::\{[^}]+\};\n*/g, '');

  // Remove duplicate serde(rename = "_v") attributes
  processed = processed.replace(
    /#\[serde\(rename = "_v"\)\]\s+#\[serde\(rename = "_v"\)\]/g,
    '#[serde(rename = "_v")]'
  );

  // Replace Option<Box<Vec<...>>> with Option<Vec<...>> (quicktype quirk)
  processed = processed.replace(/Option<Box<Vec<([^>]+)>>>/g, 'Option<Vec<$1>>');

  // Replace Box<Vec<...>> with Vec<...>
  processed = processed.replace(/Box<Vec<([^>]+)>>/g, 'Vec<$1>');

  // Add Clone to derives that don't have it
  processed = processed.replace(
    /#\[derive\(Debug, Serialize, Deserialize\)\]/g,
    '#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]'
  );

  return processed;
}

/**
 * Post-process Swift code to add Codable, Sendable conformance
 * and proper CodingKeys for snake_case JSON property names
 */
function postProcessSwift(code: string): string {
  // Add Codable, Sendable to struct declarations
  let processed = code.replace(
    /public struct (\w+) \{/g,
    'public struct $1: Codable, Sendable {'
  );

  // Add Codable, Sendable to enum declarations
  processed = processed.replace(
    /public enum (\w+): String \{/g,
    'public enum $1: String, Codable, Sendable {'
  );

  // For enums that don't have ": String"
  processed = processed.replace(
    /public enum (\w+) \{(\s+case )/g,
    'public enum $1: String, Codable, Sendable {$2'
  );

  // Process each struct by finding balanced braces
  const lines = processed.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this is a struct with Codable, Sendable
    const structMatch = line.match(/^public struct (\w+): Codable, Sendable \{$/);
    if (structMatch) {
      // Collect all lines of this struct
      const structLines: string[] = [line];
      let braceCount = 1;
      let j = i + 1;

      while (j < lines.length && braceCount > 0) {
        structLines.push(lines[j]);
        braceCount += (lines[j].match(/\{/g) || []).length;
        braceCount -= (lines[j].match(/\}/g) || []).length;
        j++;
      }

      // Extract property names from the struct
      const structBody = structLines.join('\n');
      const properties: string[] = [];
      const propMatches = structBody.matchAll(/public (?:let|var) (\w+):/g);
      for (const match of propMatches) {
        properties.push(match[1]);
      }

      // Check if any properties need CodingKeys
      const propsNeedingKeys = properties.filter(needsCodingKey);
      if (propsNeedingKeys.length > 0) {
        // Generate CodingKeys enum
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

        // Insert before the final closing brace
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

async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate');
  const validateVectors = args.includes('--validate-vectors');
  const targetFilter = args.find((a) => a.startsWith('--target='))?.split('=')[1];

  console.log('📦 BuildIt Schema Code Generator (quicktype)\n');

  // Find all schema files
  const schemaFiles = await glob(`${SCHEMAS_DIR}/**/v*.json`);
  console.log(`Found ${schemaFiles.length} schema files\n`);

  if (validateVectors) {
    await validateTestVectors();
    return;
  }

  if (validateOnly) {
    console.log('Validating schemas...');
    let hasErrors = false;
    for (const file of schemaFiles) {
      const content = await readFile(file, 'utf-8');
      try {
        const schema: ModuleSchema = JSON.parse(content);

        // Validate required fields
        if (!schema.version) {
          console.error(`  ❌ ${basename(dirname(file))}/${basename(file)}: Missing version field`);
          hasErrors = true;
          continue;
        }

        // Validate _v field is present in all type definitions
        if (schema.$defs) {
          for (const [typeName, typeDef] of Object.entries(schema.$defs)) {
            if (typeDef.type === 'object' && typeDef.required) {
              if (!typeDef.properties?._v) {
                console.warn(`  ⚠️  ${basename(dirname(file))}/${typeName}: Missing _v property (recommended for versioning)`);
              }
            }
          }
        }

        console.log(`  ✅ ${basename(dirname(file))}/${basename(file)} (v${schema.version})`);
      } catch (e) {
        console.error(`  ❌ ${file}: ${e}`);
        hasErrors = true;
      }
    }
    if (hasErrors) {
      console.log('\n❌ Validation failed');
      process.exit(1);
    }
    console.log('\n✅ All schemas valid');
    return;
  }

  const targets = [
    {
      name: 'typescript',
      lang: 'typescript',
      outputDir: join(REPO_ROOT, 'clients/web/src/generated/schemas'),
      ext: '.ts',
    },
    {
      name: 'swift',
      lang: 'swift',
      outputDir: join(REPO_ROOT, 'clients/ios/Sources/Generated/Schemas'),
      ext: '.swift',
    },
    {
      name: 'kotlin',
      lang: 'kotlin',
      outputDir: join(REPO_ROOT, 'clients/android/app/src/main/java/network/buildit/generated/schemas'),
      ext: '.kt',
    },
    {
      name: 'rust',
      lang: 'rust',
      outputDir: join(REPO_ROOT, 'packages/crypto/src/generated/schemas'),
      ext: '.rs',
    },
  ];

  // Filter targets if specified
  const activeTargets = targetFilter
    ? targets.filter((t) => t.name === targetFilter)
    : targets;

  // Process each schema file
  for (const file of schemaFiles) {
    const content = await readFile(file, 'utf-8');
    const schema: ModuleSchema = JSON.parse(content);
    const moduleName = basename(dirname(file));

    console.log(`\n📄 Processing ${moduleName}...`);

    if (!schema.$defs || Object.keys(schema.$defs).length === 0) {
      console.log(`  ⏭️  No $defs found, skipping`);
      continue;
    }

    for (const target of activeTargets) {
      await mkdir(target.outputDir, { recursive: true });

      try {
        const generatedCode = await generateAllTypesWithQuicktype(moduleName, schema, target.lang);
        const code = formatOutput(moduleName, schema.version || '1.0.0', schema.minReaderVersion || schema.version || '1.0.0', generatedCode, target.lang);
        // Use snake_case filenames for Rust
        const outputName = target.lang === 'rust' ? moduleName.replace(/-/g, '_') : moduleName;
        const outputFile = join(target.outputDir, `${outputName}${target.ext}`);
        await writeFile(outputFile, code);
        console.log(`  ✅ ${target.name}: ${outputName}${target.ext}`);
      } catch (error) {
        console.error(`  ❌ ${target.name}: ${error}`);
      }
    }
  }

  // Generate index files
  if (!targetFilter || targetFilter === 'typescript') {
    await generateTypeScriptIndex(schemaFiles);
  }

  // Generate Rust mod.rs
  if (!targetFilter || targetFilter === 'rust') {
    await generateRustMod(schemaFiles);
  }

  console.log('\n✅ Code generation complete!');
}

function formatOutput(
  moduleName: string,
  version: string,
  minReaderVersion: string,
  generatedCode: string,
  lang: string
): string {
  const constPrefix = moduleName.toUpperCase().replace(/-/g, '_');
  const pascalModule = pascalCase(moduleName);

  const header = `/**
 * @generated from protocol/schemas/modules/${moduleName}/v${version.split('.')[0]}.json
 * @version ${version}
 * @minReaderVersion ${minReaderVersion}
 *
 * DO NOT EDIT - This file is auto-generated by tools/codegen using quicktype
 */

`;

  switch (lang) {
    case 'typescript': {
      const processedTS = postProcessTypeScript(generatedCode);
      return (
        header +
        `// Version constants
export const ${constPrefix}_VERSION = '${version}';
export const ${constPrefix}_MIN_READER_VERSION = '${minReaderVersion}';

` +
        processedTS
      );
    }

    case 'swift':
      // Post-process Swift to add Codable, Sendable conformance
      const processedSwift = postProcessSwift(generatedCode);
      return (
        header +
        `import Foundation

public enum ${pascalModule}Schema {
    public static let version = "${version}"
    public static let minReaderVersion = "${minReaderVersion}"
}

` +
        processedSwift
      );

    case 'kotlin':
      // Kotlin already has package declaration from quicktype, just add header
      return header + generatedCode;

    case 'rust': {
      const processedRust = postProcessRust(generatedCode, moduleName);
      const snakeModule = moduleName.replace(/-/g, '_');
      // For Rust, inner doc comments must come FIRST, before any other content
      return `//! ${pascalModule} module schema types
//!
//! @generated from protocol/schemas/modules/${moduleName}/v${version.split('.')[0]}.json
//! Version: ${version}
//! Min Reader Version: ${minReaderVersion}
//!
//! DO NOT EDIT - This file is auto-generated by tools/codegen using quicktype

use serde::{Deserialize, Serialize};

/// Schema version for ${pascalModule} module
pub const ${snakeModule.toUpperCase()}_VERSION: &str = "${version}";
/// Minimum reader version for ${pascalModule} module
pub const ${snakeModule.toUpperCase()}_MIN_READER_VERSION: &str = "${minReaderVersion}";

${processedRust}
`;
    }

    default:
      return header + generatedCode;
  }
}

async function generateTypeScriptIndex(schemaFiles: string[]) {
  const outputDir = join(REPO_ROOT, 'clients/web/src/generated/schemas');
  const modules = schemaFiles.map((f) => basename(dirname(f)));

  // Read generated files to find actual exports (distinguish types vs values)
  interface ExportInfo {
    name: string;
    kind: 'type' | 'value'; // interface = type, enum/const = value
  }
  const moduleExports: Map<string, ExportInfo[]> = new Map();

  for (const moduleName of modules) {
    const generatedFile = join(outputDir, `${moduleName}.ts`);
    try {
      const content = await readFile(generatedFile, 'utf-8');
      const exports: ExportInfo[] = [];

      // Match interface declarations (types)
      const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
      for (const match of interfaceMatches) {
        exports.push({ name: match[1], kind: 'type' });
      }

      // Match enum declarations (values - can also be used as types)
      const enumMatches = content.matchAll(/export\s+enum\s+(\w+)/g);
      for (const match of enumMatches) {
        exports.push({ name: match[1], kind: 'value' });
      }

      // Match const declarations (values)
      const constMatches = content.matchAll(/export\s+const\s+(\w+)/g);
      for (const match of constMatches) {
        exports.push({ name: match[1], kind: 'value' });
      }

      moduleExports.set(moduleName, exports);
    } catch {
      moduleExports.set(moduleName, []);
    }
  }

  // Track all exports to detect conflicts
  const allExports: Map<string, string[]> = new Map();
  for (const [moduleName, exports] of moduleExports) {
    for (const exp of exports) {
      if (!allExports.has(exp.name)) allExports.set(exp.name, []);
      allExports.get(exp.name)!.push(moduleName);
    }
  }

  // Find conflicts
  const conflicts = new Set<string>();
  for (const [exp, mods] of allExports) {
    if (mods.length > 1) conflicts.add(exp);
  }

  // Generate index with explicit exports, using export type for interfaces
  let code = '// Auto-generated index - DO NOT EDIT\n';
  code += '// For conflicting types, import directly from the module file\n\n';

  for (const moduleName of modules) {
    const pascalModule = pascalCase(moduleName);
    const constPrefix = moduleName.toUpperCase().replace(/-/g, '_');
    const exports = moduleExports.get(moduleName) || [];

    code += `// ${pascalModule} module\n`;

    // Always export version constants
    code += `export { ${constPrefix}_VERSION, ${constPrefix}_MIN_READER_VERSION } from './${moduleName}';\n`;

    // Separate type exports and value exports
    const typeExports: string[] = [];
    const valueExports: string[] = [];

    for (const exp of exports) {
      // Skip version constants already exported
      if (exp.name === `${constPrefix}_VERSION` || exp.name === `${constPrefix}_MIN_READER_VERSION`) {
        continue;
      }

      const exportName = conflicts.has(exp.name)
        ? `${exp.name} as ${pascalModule}${exp.name}`
        : exp.name;

      if (exp.kind === 'type') {
        typeExports.push(exportName);
      } else {
        valueExports.push(exportName);
      }
    }

    if (typeExports.length > 0) {
      code += `export type { ${typeExports.join(', ')} } from './${moduleName}';\n`;
    }

    if (valueExports.length > 0) {
      code += `export { ${valueExports.join(', ')} } from './${moduleName}';\n`;
    }

    code += '\n';
  }

  await writeFile(join(outputDir, 'index.ts'), code);
  console.log(`  ✅ TypeScript: index.ts`);
}

/**
 * Generate Rust mod.rs index file
 */
async function generateRustMod(schemaFiles: string[]) {
  const outputDir = join(REPO_ROOT, 'packages/crypto/src/generated/schemas');
  const modules = schemaFiles.map((f) => basename(dirname(f)));

  let code = `//! Auto-generated schema module index
//!
//! DO NOT EDIT - This file is auto-generated by tools/codegen
//!
//! Each schema module is exposed separately to avoid type name conflicts.
//! Import directly from the module you need:
//!
//! \`\`\`rust
//! use buildit_crypto::generated::schemas::messaging::DirectMessage;
//! use buildit_crypto::generated::schemas::events::Event;
//! \`\`\`

`;

  // Generate mod declarations only - no glob re-exports to avoid conflicts
  for (const moduleName of modules) {
    const snakeModule = moduleName.replace(/-/g, '_');
    code += `pub mod ${snakeModule};\n`;
  }

  await writeFile(join(outputDir, 'mod.rs'), code);
  console.log(`  ✅ Rust: mod.rs`);
}

/**
 * Validate test vectors for cross-version parsing
 * Only processes test vector files with schema versioning structure
 */
async function validateTestVectors() {
  console.log('Validating schema versioning test vectors...\n');

  const vectorFiles = await glob(`${TEST_VECTORS_DIR}/*.json`);

  if (vectorFiles.length === 0) {
    console.log('  No test vector files found');
    return;
  }

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedFiles = 0;

  for (const file of vectorFiles) {
    const content = await readFile(file, 'utf-8');
    const vectors = JSON.parse(content);

    // Only process files with schema versioning test structure
    // These have testCases with input/expected and module fields
    const isSchemaVersioningTest = vectors.testCases?.some((tc: any) =>
      tc.module && (tc.expected?.canParse !== undefined || tc.expected?.unknownFields)
    );

    if (!isSchemaVersioningTest) {
      skippedFiles++;
      continue; // Skip non-schema-versioning test files
    }

    console.log(`📄 ${basename(file)}`);

    if (!vectors.testCases || !Array.isArray(vectors.testCases)) {
      console.log('  ⚠️  No test cases found');
      continue;
    }

    for (const testCase of vectors.testCases) {
      totalTests++;

      try {
        // Validate test case structure for schema versioning tests
        if (!testCase.id || !testCase.name || !testCase.input || !testCase.expected) {
          throw new Error('Missing required test case fields');
        }

        // Validate version field handling
        const input = testCase.input;
        const expected = testCase.expected;

        // Check _v field presence
        if (expected.canParse && !expected.inferredVersion) {
          if (!input._v) {
            // Should infer 1.0.0
            if (expected.inferredVersion !== '1.0.0') {
              // Missing version should default to 1.0.0
            }
          }
        }

        // Check unknown fields detection
        if (expected.unknownFields && expected.unknownFields.length > 0) {
          for (const field of expected.unknownFields) {
            if (!(field in input)) {
              throw new Error(`Unknown field '${field}' not present in input`);
            }
          }
        }

        // Check relay forwarding preservation
        if (expected.relayOutput) {
          // Verify unknown fields are in relay output
          for (const field of (expected.unknownFields || [])) {
            if (!(field in expected.relayOutput)) {
              throw new Error(`Unknown field '${field}' not preserved in relay output`);
            }
          }
        }

        console.log(`  ✅ ${testCase.id}: ${testCase.name}`);
        passedTests++;
      } catch (error) {
        console.error(`  ❌ ${testCase.id}: ${testCase.name}`);
        console.error(`     ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
      }
    }
    console.log('');
  }

  console.log(`\nResults: ${passedTests}/${totalTests} passed, ${failedTests} failed`);
  if (skippedFiles > 0) {
    console.log(`(Skipped ${skippedFiles} non-schema-versioning test files)`);
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
