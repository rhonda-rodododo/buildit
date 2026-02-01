/**
 * Shared JSON Schema parsing utilities for codegen generators
 *
 * @generated infrastructure - manually maintained
 */

/** Top-level module schema structure */
export interface ModuleSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  version: string;
  minReaderVersion?: string;
  type?: string;
  $defs?: Record<string, JsonSchemaDef>;
  testVectors?: unknown[];
  coreModule?: boolean;
  'x-storage'?: XStorageAnnotation;
}

/** JSON Schema definition for a type */
export interface JsonSchemaDef {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  enum?: string[];
  items?: JsonSchemaProperty;
  oneOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  $ref?: string;
  default?: unknown;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;
  format?: string;
  title?: string;
}

/** JSON Schema property (same structure as def but used in property context) */
export type JsonSchemaProperty = JsonSchemaDef;

/** x-storage annotation structure */
export interface XStorageAnnotation {
  tables: Record<string, XStorageTable>;
  dbOnly?: Record<string, Record<string, XStorageDbOnlyField>>;
  protocolOnly?: string[];
}

export interface XStorageTable {
  type: string;
  primaryKey: string;
  indexes?: string[];
  compoundIndexes?: string[];
  multiEntryIndexes?: string[];
  unique?: string[];
}

export interface XStorageDbOnlyField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  optional?: boolean;
  description?: string;
  default?: unknown;
  items?: Record<string, unknown>;
  enum?: string[];
  /** For typed objects: define structure instead of Record<string, unknown> */
  properties?: Record<string, XStorageDbOnlyField>;
  /** Required properties for typed objects */
  required?: string[];
}

/**
 * Convert $defs refs to definitions refs for quicktype compatibility.
 * Handles both local refs (#/$defs/Foo) and cross-module refs
 * (https://buildit.network/schemas/modules/content/v1.json#/$defs/LinkPreview).
 */
export function convertRefsToDefinitions(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  const record = obj as Record<string, unknown>;

  if (record.$ref && typeof record.$ref === 'string') {
    const ref = record.$ref as string;
    // Cross-module $ref: extract just the type name and convert to local ref
    const crossModuleMatch = ref.match(
      /https:\/\/buildit\.network\/schemas\/modules\/[\w-]+\/v\d+\.json#\/\$defs\/(\w+)/
    );
    if (crossModuleMatch) {
      return {
        ...record,
        $ref: `#/definitions/${crossModuleMatch[1]}`,
      };
    }
    // Local $ref: #/$defs/Foo -> #/definitions/Foo
    return {
      ...record,
      $ref: ref.replace('#/$defs/', '#/definitions/'),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(convertRefsToDefinitions);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = convertRefsToDefinitions(value);
  }
  return result;
}

/**
 * Extract cross-module $ref URIs from a schema definition.
 * Returns a map of { moduleName: [typeName, ...] } for all referenced external types.
 */
export function extractCrossModuleRefs(obj: unknown): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const record = node as Record<string, unknown>;

    if (record.$ref && typeof record.$ref === 'string') {
      const match = (record.$ref as string).match(
        /https:\/\/buildit\.network\/schemas\/modules\/([\w-]+)\/v\d+\.json#\/\$defs\/(\w+)/
      );
      if (match) {
        const [, moduleName, typeName] = match;
        if (!refs.has(moduleName)) refs.set(moduleName, new Set());
        refs.get(moduleName)!.add(typeName);
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const value of Object.values(record)) {
      walk(value);
    }
  }

  walk(obj);
  return refs;
}

/** Convert kebab-case to PascalCase */
export function pascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Convert kebab-case to snake_case */
export function snakeCase(str: string): string {
  return str.replace(/-/g, '_');
}

/** Convert kebab-case to UPPER_SNAKE_CASE */
export function constCase(str: string): string {
  return str.toUpperCase().replace(/-/g, '_');
}

/**
 * Resolve a $ref string to the referenced type name.
 * e.g. "#/$defs/AidCategory" => "AidCategory"
 */
export function resolveRefName(ref: string): string | null {
  const match = ref.match(/#\/\$defs\/(\w+)/);
  return match ? match[1] : null;
}

/**
 * Get the effective type of a JSON Schema property, resolving $refs.
 */
export function getEffectiveType(
  prop: JsonSchemaProperty,
  defs: Record<string, JsonSchemaDef>
): { type: string; isArray: boolean; isEnum: boolean; enumValues?: string[]; refType?: string } {
  // Handle $ref
  if (prop.$ref) {
    const refName = resolveRefName(prop.$ref);
    if (refName && defs[refName]) {
      const refDef = defs[refName];
      if (refDef.enum) {
        return { type: 'string', isArray: false, isEnum: true, enumValues: refDef.enum, refType: refName };
      }
      if (refDef.type === 'object') {
        return { type: 'object', isArray: false, isEnum: false, refType: refName };
      }
      return { type: refDef.type as string || 'unknown', isArray: false, isEnum: false, refType: refName };
    }
    return { type: 'unknown', isArray: false, isEnum: false, refType: refName || undefined };
  }

  // Handle enum
  if (prop.enum) {
    return { type: 'string', isArray: false, isEnum: true, enumValues: prop.enum };
  }

  // Handle array
  if (prop.type === 'array') {
    if (prop.items) {
      const itemType = getEffectiveType(prop.items, defs);
      return { ...itemType, isArray: true };
    }
    return { type: 'unknown', isArray: true, isEnum: false };
  }

  // Handle oneOf
  if (prop.oneOf) {
    return { type: 'union', isArray: false, isEnum: false };
  }

  // Simple types
  const typeStr = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  return { type: typeStr || 'unknown', isArray: false, isEnum: false };
}
