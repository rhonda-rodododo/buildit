/**
 * SQLite Schema Generator
 *
 * Generates SQL CREATE TABLE statements and migration files from protocol
 * schemas with x-storage annotations. Parallel to dexie.ts but outputs SQL
 * instead of Dexie TableSchema definitions.
 *
 * Output for each module:
 *   - CREATE TABLE statements with proper column types
 *   - CREATE INDEX statements for all indexed columns
 *   - Junction tables for multi-entry indexes
 *
 * Column naming: Uses snake_case (SQL convention). The Rust backend handles
 * camelCase↔snake_case conversion at the Tauri command boundary.
 */

import type {
  ModuleSchema,
  JsonSchemaDef,
  JsonSchemaProperty,
  XStorageTable,
  XStorageDbOnlyField,
} from '../utils/json-schema';
import { pascalCase, resolveRefName } from '../utils/json-schema';

interface SqlColumn {
  name: string;
  sqlType: string;
  nullable: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  description?: string;
}

interface SqlTable {
  tableName: string;
  columns: SqlColumn[];
  primaryKey: string;
  autoIncrement: boolean;
  indexes: SqlIndex[];
  uniqueConstraints: string[][];
  junctionTables: SqlJunctionTable[];
}

interface SqlIndex {
  columns: string[];
  unique: boolean;
}

interface SqlJunctionTable {
  name: string;
  parentTable: string;
  parentPk: string;
  valueColumn: string;
}

/**
 * Generate SQL migration code for a module's x-storage tables.
 */
export function generateSqliteMigration(moduleName: string, schema: ModuleSchema): string | null {
  const xStorage = schema['x-storage'];
  if (!xStorage || Object.keys(xStorage.tables).length === 0) {
    return null;
  }

  const defs = schema.$defs || {};
  const tables: SqlTable[] = [];

  for (const [tableName, tableConfig] of Object.entries(xStorage.tables)) {
    const typeDef = defs[tableConfig.type];
    if (!typeDef) {
      console.warn(`  ⚠️  x-storage references $defs[${tableConfig.type}] but it doesn't exist`);
      continue;
    }

    const sqlTable = buildSqlTable(
      tableName,
      tableConfig,
      typeDef,
      defs,
      xStorage.protocolOnly || [],
      xStorage.dbOnly?.[tableName] || {}
    );

    tables.push(sqlTable);
  }

  if (tables.length === 0) return null;

  return renderSqlMigration(moduleName, schema, tables);
}

function buildSqlTable(
  tableName: string,
  tableConfig: XStorageTable,
  typeDef: JsonSchemaDef,
  allDefs: Record<string, JsonSchemaDef>,
  protocolOnly: string[],
  dbOnly: Record<string, XStorageDbOnlyField>
): SqlTable {
  const snakeTableName = camelToSnake(tableName);
  const properties = typeDef.properties || {};
  const required = new Set(typeDef.required || []);

  // Determine primary key
  const isAutoIncrement = tableConfig.primaryKey.startsWith('++');
  const pkFieldName = tableConfig.primaryKey.replace(/^\+\+/, '');
  const pkColumnName = camelToSnake(pkFieldName);

  const columns: SqlColumn[] = [];
  const indexes: SqlIndex[] = [];
  const uniqueConstraints: string[][] = [];
  const junctionTables: SqlJunctionTable[] = [];

  // Add protocol properties as columns
  for (const [propName, propDef] of Object.entries(properties)) {
    if (protocolOnly.includes(propName)) continue;

    const colName = camelToSnake(propName);
    const sqlType = jsonSchemaToSqlType(propDef, allDefs);
    const nullable = !required.has(propName) && propName !== pkFieldName;
    const defaultValue = getDefaultValue(propDef, sqlType);
    const checkConstraint = getCheckConstraint(propDef, colName, allDefs);

    columns.push({
      name: colName,
      sqlType,
      nullable,
      defaultValue,
      checkConstraint,
      description: propDef.description,
    });
  }

  // Add dbOnly fields
  for (const [fieldName, fieldConfig] of Object.entries(dbOnly)) {
    const colName = camelToSnake(fieldName);
    // Skip if already exists from protocol
    if (columns.some((c) => c.name === colName)) continue;

    columns.push({
      name: colName,
      sqlType: dbOnlyFieldToSqlType(fieldConfig),
      nullable: fieldConfig.optional !== false,
      defaultValue: fieldConfig.default !== undefined ? String(fieldConfig.default) : undefined,
      description: fieldConfig.description,
    });
  }

  // Ensure _v column exists for schema version tracking
  // It may already exist from the protocol properties
  if (!columns.some((c) => c.name === '_v')) {
    columns.push({
      name: '_v',
      sqlType: 'TEXT',
      nullable: false,
      defaultValue: "'1.0.0'",
      description: 'Schema version that created this content',
    });
  } else {
    // If _v already exists, ensure it has a default value
    const vCol = columns.find((c) => c.name === '_v');
    if (vCol && !vCol.defaultValue) {
      vCol.defaultValue = "'1.0.0'";
    }
  }

  // Build indexes from tableConfig
  if (tableConfig.indexes) {
    for (const idx of tableConfig.indexes) {
      const colName = camelToSnake(idx);
      indexes.push({ columns: [colName], unique: false });
    }
  }

  // Compound indexes
  if (tableConfig.compoundIndexes) {
    for (const compound of tableConfig.compoundIndexes) {
      // Parse "[a+b]" format
      const match = compound.match(/^\[(.+)\]$/);
      if (match) {
        const cols = match[1].split('+').map((c) => camelToSnake(c.trim()));
        indexes.push({ columns: cols, unique: false });
      }
    }
  }

  // Unique indexes
  if (tableConfig.unique) {
    for (const u of tableConfig.unique) {
      const colName = camelToSnake(u);
      indexes.push({ columns: [colName], unique: true });
    }
  }

  // Multi-entry indexes → junction tables
  if (tableConfig.multiEntryIndexes) {
    for (const mei of tableConfig.multiEntryIndexes) {
      const fieldName = mei.replace(/^\*/, '');
      const colName = camelToSnake(fieldName);
      junctionTables.push({
        name: `${snakeTableName}_${colName}`,
        parentTable: snakeTableName,
        parentPk: pkColumnName,
        valueColumn: colName.endsWith('s') ? colName.slice(0, -1) : colName, // singularize
      });
    }
  }

  return {
    tableName: snakeTableName,
    columns,
    primaryKey: pkColumnName,
    autoIncrement: isAutoIncrement,
    indexes,
    uniqueConstraints,
    junctionTables,
  };
}

function jsonSchemaToSqlType(
  prop: JsonSchemaProperty,
  defs: Record<string, JsonSchemaDef>
): string {
  // Handle $ref
  if (prop.$ref) {
    const refName = resolveRefName(prop.$ref);
    if (refName && defs[refName]) {
      const refDef = defs[refName];
      if (refDef.enum) return 'TEXT';
      if (refDef.type === 'object') return 'TEXT'; // JSON-serialized
      return jsonSchemaToSqlType(refDef, defs);
    }
    return 'TEXT';
  }

  // Handle enum
  if (prop.enum) return 'TEXT';

  // Handle oneOf
  if (prop.oneOf) return 'TEXT';

  // Handle array
  if (prop.type === 'array') return 'TEXT'; // JSON-serialized

  // Handle object
  if (prop.type === 'object') return 'TEXT'; // JSON-serialized

  // Simple types
  switch (prop.type) {
    case 'string':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'number':
      return 'REAL';
    case 'boolean':
      return 'INTEGER'; // 0/1
    default:
      return 'TEXT';
  }
}

function dbOnlyFieldToSqlType(field: XStorageDbOnlyField): string {
  switch (field.type) {
    case 'string':
      return 'TEXT';
    case 'number':
    case 'integer':
      return field.type === 'number' ? 'REAL' : 'INTEGER';
    case 'boolean':
      return 'INTEGER';
    case 'object':
    case 'array':
      return 'TEXT'; // JSON-serialized
    default:
      return 'TEXT';
  }
}

function getDefaultValue(prop: JsonSchemaProperty, sqlType: string): string | undefined {
  if (prop.default === undefined) return undefined;

  if (typeof prop.default === 'boolean') {
    return prop.default ? '1' : '0';
  }
  if (typeof prop.default === 'number') {
    return String(prop.default);
  }
  if (typeof prop.default === 'string') {
    return `'${prop.default.replace(/'/g, "''")}'`;
  }
  if (Array.isArray(prop.default)) {
    return "'[]'";
  }
  if (typeof prop.default === 'object' && prop.default !== null) {
    return "'{}'";
  }
  return undefined;
}

function getCheckConstraint(
  prop: JsonSchemaProperty,
  colName: string,
  defs: Record<string, JsonSchemaDef>
): string | undefined {
  let enumValues: string[] | undefined;

  if (prop.enum) {
    enumValues = prop.enum;
  } else if (prop.$ref) {
    const refName = resolveRefName(prop.$ref);
    if (refName && defs[refName]?.enum) {
      enumValues = defs[refName].enum;
    }
  }

  if (enumValues && enumValues.length > 0 && enumValues.length <= 10) {
    const values = enumValues.map((v) => `'${v}'`).join(', ');
    return `CHECK("${colName}" IN (${values}))`;
  }

  return undefined;
}

function renderSqlMigration(
  moduleName: string,
  schema: ModuleSchema,
  tables: SqlTable[]
): string {
  const pascal = pascalCase(moduleName);
  const version = schema.version || '1.0.0';

  let sql = `-- ${pascal} module tables\n`;
  sql += `-- Generated from protocol/schemas/modules/${moduleName}/v${version.split('.')[0]}.json\n`;
  sql += `-- Version: ${version}\n\n`;

  for (const table of tables) {
    sql += renderCreateTable(table);
    sql += '\n';
  }

  return sql;
}

function renderCreateTable(table: SqlTable): string {
  let sql = `-- ── ${table.tableName} ──\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS "${table.tableName}" (\n`;

  const lines: string[] = [];

  for (const col of table.columns) {
    let line = `    "${col.name}" ${col.sqlType}`;

    if (col.name === table.primaryKey) {
      line += ' PRIMARY KEY';
      if (table.autoIncrement) {
        line += ' AUTOINCREMENT';
      }
    } else if (!col.nullable) {
      line += ' NOT NULL';
    }

    if (col.defaultValue !== undefined) {
      line += ` DEFAULT ${col.defaultValue}`;
    }

    if (col.checkConstraint) {
      line += ` ${col.checkConstraint}`;
    }

    lines.push(line);
  }

  sql += lines.join(',\n');
  sql += '\n);\n\n';

  // Indexes
  for (const idx of table.indexes) {
    const indexName = `idx_${table.tableName}_${idx.columns.join('_')}`;
    const uniqueStr = idx.unique ? 'UNIQUE ' : '';
    const colList = idx.columns.map((c) => `"${c}"`).join(', ');
    sql += `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${indexName}" ON "${table.tableName}"(${colList});\n`;
  }

  if (table.indexes.length > 0) sql += '\n';

  // Junction tables
  for (const jt of table.junctionTables) {
    sql += `CREATE TABLE IF NOT EXISTS "${jt.name}" (\n`;
    sql += `    "${jt.parentPk}" TEXT NOT NULL REFERENCES "${jt.parentTable}"("${jt.parentPk}") ON DELETE CASCADE,\n`;
    sql += `    "${jt.valueColumn}" TEXT NOT NULL,\n`;
    sql += `    PRIMARY KEY ("${jt.parentPk}", "${jt.valueColumn}")\n`;
    sql += `);\n\n`;
    sql += `CREATE INDEX IF NOT EXISTS "idx_${jt.name}_${jt.valueColumn}" ON "${jt.name}"("${jt.valueColumn}");\n\n`;
  }

  return sql;
}

/** Convert camelCase to snake_case, preserving leading underscores */
function camelToSnake(s: string): string {
  // Preserve leading underscores (e.g., _v stays as _v)
  const leadingUnderscores = s.match(/^_+/)?.[0] || '';
  const rest = s.slice(leadingUnderscores.length);
  const snaked = rest.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return leadingUnderscores + snaked;
}
