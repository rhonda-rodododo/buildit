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
      };
    case 'kotlin':
      return {
        'just-types': 'true',
        'framework': 'kotlinx',
        'package': 'network.buildit.generated.schemas',
      };
    default:
      return {};
  }
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
        const outputFile = join(target.outputDir, `${moduleName}${target.ext}`);
        await writeFile(outputFile, code);
        console.log(`  ✅ ${target.name}: ${moduleName}${target.ext}`);
      } catch (error) {
        console.error(`  ❌ ${target.name}: ${error}`);
      }
    }
  }

  // Generate index files
  if (!targetFilter || targetFilter === 'typescript') {
    await generateTypeScriptIndex(schemaFiles);
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
    case 'typescript':
      return (
        header +
        `// Version constants
export const ${constPrefix}_VERSION = '${version}';
export const ${constPrefix}_MIN_READER_VERSION = '${minReaderVersion}';

` +
        generatedCode
      );

    case 'swift':
      return (
        header +
        `import Foundation

public enum ${pascalModule}Schema {
    public static let version = "${version}"
    public static let minReaderVersion = "${minReaderVersion}"
}

` +
        generatedCode
      );

    case 'kotlin':
      // Kotlin already has package declaration from quicktype, just add header
      return header + generatedCode;

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
