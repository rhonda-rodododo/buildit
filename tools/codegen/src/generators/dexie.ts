/**
 * Dexie DB Schema Generator
 *
 * Generates TypeScript interfaces and Dexie TableSchema definitions
 * from protocol schemas with x-storage annotations.
 *
 * Output for each module:
 *   - DB{Type} interfaces with all protocol fields + dbOnly fields
 *   - TableSchema constants with Dexie index strings
 *   - Re-export of protocol types for convenience
 */

import type {
  ModuleSchema,
  JsonSchemaDef,
  JsonSchemaProperty,
  XStorageTable,
  XStorageDbOnlyField,
} from '../utils/json-schema';
import { pascalCase, resolveRefName, constCase } from '../utils/json-schema';

interface GeneratedTable {
  tableName: string;
  interfaceName: string;
  protocolTypeName: string;
  fields: GeneratedField[];
  dexieSchema: string;
}

interface GeneratedField {
  name: string;
  tsType: string;
  optional: boolean;
  description?: string;
  isDbOnly: boolean;
}

/**
 * Tracks $ref object types encountered during field generation
 * so we can emit inline interface definitions for them.
 */
interface RefTypeCollector {
  /** Map of type name → resolved inline interface code */
  collected: Map<string, string>;
  /** Set of type names currently being resolved (cycle detection) */
  resolving: Set<string>;
}

/**
 * Generate Dexie DB schema code for a module.
 */
export function generateDexieSchema(moduleName: string, schema: ModuleSchema): string | null {
  const xStorage = schema['x-storage'];
  if (!xStorage || Object.keys(xStorage.tables).length === 0) {
    return null;
  }

  const defs = schema.$defs || {};
  const tables: GeneratedTable[] = [];
  const refCollector: RefTypeCollector = { collected: new Map(), resolving: new Set() };

  for (const [tableName, tableConfig] of Object.entries(xStorage.tables)) {
    const typeDef = defs[tableConfig.type];
    if (!typeDef) {
      console.warn(`  ⚠️  x-storage references $defs[${tableConfig.type}] but it doesn't exist`);
      continue;
    }

    const interfaceName = `DB${tableConfig.type}`;
    const fields = generateFields(typeDef, defs, xStorage.protocolOnly || [], refCollector);

    // Add dbOnly fields (skip any that already exist from protocol)
    const existingFieldNames = new Set(fields.map((f) => f.name));
    const dbOnlyFields = xStorage.dbOnly?.[tableName] || {};
    for (const [fieldName, fieldConfig] of Object.entries(dbOnlyFields)) {
      if (existingFieldNames.has(fieldName)) continue;
      fields.push({
        name: fieldName,
        tsType: dbOnlyFieldToTs(fieldConfig),
        optional: fieldConfig.optional !== false,
        description: fieldConfig.description,
        isDbOnly: true,
      });
    }

    const dexieSchema = buildDexieSchemaString(tableConfig);

    tables.push({
      tableName,
      interfaceName,
      protocolTypeName: tableConfig.type,
      fields,
      dexieSchema,
    });
  }

  if (tables.length === 0) return null;

  return renderDexieModule(moduleName, schema, tables, refCollector);
}

function generateFields(
  typeDef: JsonSchemaDef,
  allDefs: Record<string, JsonSchemaDef>,
  protocolOnly: string[],
  collector: RefTypeCollector
): GeneratedField[] {
  const fields: GeneratedField[] = [];
  const properties = typeDef.properties || {};
  const required = new Set(typeDef.required || []);

  for (const [propName, propDef] of Object.entries(properties)) {
    if (protocolOnly.includes(propName)) continue;

    fields.push({
      name: propName,
      tsType: jsonSchemaToTs(propDef, allDefs, collector),
      optional: !required.has(propName),
      description: propDef.description,
      isDbOnly: false,
    });
  }

  return fields;
}

function jsonSchemaToTs(
  prop: JsonSchemaProperty,
  defs: Record<string, JsonSchemaDef>,
  collector?: RefTypeCollector
): string {
  // Handle $ref
  if (prop.$ref) {
    const refName = resolveRefName(prop.$ref);
    if (refName && defs[refName]) {
      const refDef = defs[refName];
      // Enum refs become string literal unions
      if (refDef.enum) {
        return refDef.enum.map((v) => `'${v}'`).join(' | ');
      }
      // Object refs: collect for inline generation, return the type name
      if (refDef.type === 'object') {
        if (collector) {
          collectRefType(refName, refDef, defs, collector);
        }
        return refName;
      }
      // Other refs (string with constraints, etc.)
      return jsonSchemaToTs(refDef, defs, collector);
    }
    return 'unknown';
  }

  // Handle enum
  if (prop.enum) {
    return prop.enum.map((v) => `'${v}'`).join(' | ');
  }

  // Handle oneOf
  if (prop.oneOf) {
    return prop.oneOf.map((o) => jsonSchemaToTs(o, defs, collector)).join(' | ');
  }

  // Handle array
  if (prop.type === 'array') {
    if (prop.items) {
      const itemType = jsonSchemaToTs(prop.items, defs, collector);
      return `${itemType}[]`;
    }
    return 'unknown[]';
  }

  // Handle object with no properties (record type)
  if (prop.type === 'object' && !prop.properties) {
    if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
      const valType = jsonSchemaToTs(prop.additionalProperties as JsonSchemaProperty, defs, collector);
      return `Record<string, ${valType}>`;
    }
    return 'Record<string, unknown>';
  }

  // Handle object with properties (inline)
  if (prop.type === 'object' && prop.properties) {
    const fields = Object.entries(prop.properties).map(([k, v]) => {
      const req = prop.required?.includes(k) ? '' : '?';
      return `${k}${req}: ${jsonSchemaToTs(v, defs, collector)}`;
    });
    return `{ ${fields.join('; ')} }`;
  }

  // Simple types
  switch (prop.type) {
    case 'string': return 'string';
    case 'integer': return 'number';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    default:
      if (Array.isArray(prop.type)) {
        return prop.type.map((t) => {
          if (t === 'integer' || t === 'number') return 'number';
          return t;
        }).join(' | ');
      }
      return 'unknown';
  }
}

/**
 * Recursively resolves a $ref object type and generates an inline interface definition.
 * Tracks already-resolved types to avoid duplicates and cycles.
 */
function collectRefType(
  name: string,
  def: JsonSchemaDef,
  defs: Record<string, JsonSchemaDef>,
  collector: RefTypeCollector
): void {
  // Already collected or currently resolving (cycle)
  if (collector.collected.has(name) || collector.resolving.has(name)) return;

  collector.resolving.add(name);

  const properties = def.properties || {};
  const required = new Set(def.required || []);
  const lines: string[] = [];

  if (def.description) {
    lines.push(`/** ${def.description} */`);
  }
  lines.push(`export interface ${name} {`);

  for (const [propName, propDef] of Object.entries(properties)) {
    if (propDef.description) {
      lines.push(`  /** ${propDef.description} */`);
    }
    const optMark = required.has(propName) ? '' : '?';
    const tsType = jsonSchemaToTs(propDef, defs, collector);
    lines.push(`  ${propName}${optMark}: ${tsType};`);
  }

  lines.push(`}`);

  collector.resolving.delete(name);
  collector.collected.set(name, lines.join('\n'));
}

function dbOnlyFieldToTs(field: XStorageDbOnlyField): string {
  if (field.enum) {
    return field.enum.map((v) => `'${v}'`).join(' | ');
  }
  switch (field.type) {
    case 'string': return 'string';
    case 'number':
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'object': {
      // Generate typed interface for objects with properties
      if (field.properties) {
        const required = new Set(field.required || []);
        const fields = Object.entries(field.properties).map(([name, prop]) => {
          const opt = required.has(name) ? '' : '?';
          return `${name}${opt}: ${dbOnlyFieldToTs(prop)}`;
        });
        return `{ ${fields.join('; ')} }`;
      }
      return 'Record<string, unknown>';
    }
    case 'array': return 'unknown[]';
    default: return 'unknown';
  }
}

function buildDexieSchemaString(tableConfig: XStorageTable): string {
  const parts: string[] = [];

  // Primary key
  parts.push(tableConfig.primaryKey);

  // Simple indexes
  if (tableConfig.indexes) {
    parts.push(...tableConfig.indexes);
  }

  // Compound indexes
  if (tableConfig.compoundIndexes) {
    parts.push(...tableConfig.compoundIndexes);
  }

  // Multi-entry indexes
  if (tableConfig.multiEntryIndexes) {
    parts.push(...tableConfig.multiEntryIndexes);
  }

  // Unique indexes
  if (tableConfig.unique) {
    parts.push(...tableConfig.unique.map((u) => `&${u}`));
  }

  return parts.join(', ');
}

function renderDexieModule(
  moduleName: string,
  schema: ModuleSchema,
  tables: GeneratedTable[],
  refCollector: RefTypeCollector
): string {
  const moduleConst = constCase(moduleName);
  const pascal = pascalCase(moduleName);
  const version = schema.version || '1.0.0';

  let code = `/**
 * @generated from protocol/schemas/modules/${moduleName}/v${version.split('.')[0]}.json
 * @version ${version}
 *
 * DO NOT EDIT - This file is auto-generated by tools/codegen
 * Dexie DB schema definitions for the ${pascal} module
 */

import type { TableSchema } from '@/types/modules';

`;

  // Generate inline interfaces for referenced $def object types
  if (refCollector.collected.size > 0) {
    code += `// ── Referenced types (from protocol $defs) ──────────────────────────\n\n`;
    for (const [, interfaceCode] of refCollector.collected) {
      code += `${interfaceCode}\n\n`;
    }
    code += `// ── DB interfaces ────────────────────────────────────────────────────\n\n`;
  }

  // Generate interfaces
  for (const table of tables) {
    code += `/**\n * DB interface for ${table.protocolTypeName} (table: ${table.tableName})\n */\n`;
    code += `export interface ${table.interfaceName} {\n`;

    for (const field of table.fields) {
      if (field.description) {
        code += `  /** ${field.description}${field.isDbOnly ? ' (DB-only)' : ''} */\n`;
      }
      const optMark = field.optional ? '?' : '';
      code += `  ${field.name}${optMark}: ${field.tsType};\n`;
    }

    code += `}\n\n`;
  }

  // Generate table schema constants
  code += `/**\n * ${pascal} module Dexie table schemas\n */\n`;
  code += `export const ${moduleConst}_TABLE_SCHEMAS: TableSchema[] = [\n`;

  for (const table of tables) {
    code += `  {\n`;
    code += `    name: '${table.tableName}',\n`;
    code += `    schema: '${table.dexieSchema}',\n`;

    // Parse indexes from schema string for the indexes array
    const indexParts = table.dexieSchema.split(', ').map((s) => s.trim());
    code += `    indexes: [${indexParts.map((i) => `'${i}'`).join(', ')}],\n`;

    code += `  },\n`;
  }

  code += `];\n\n`;

  // Generate table name constants
  code += `/** Type-safe table names */\n`;
  code += `export const ${moduleConst}_TABLES = {\n`;
  for (const table of tables) {
    const constName = table.tableName
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
    code += `  ${constName}: '${table.tableName}',\n`;
  }
  code += `} as const;\n`;

  return code;
}
