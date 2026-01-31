/**
 * Quicktype-based type generation for TypeScript, Swift, Kotlin, Rust
 *
 * Extracted from the monolithic index.ts. Generates native type definitions
 * from JSON Schema $defs using quicktype-core.
 */

import {
  quicktype,
  InputData,
  JSONSchemaInput,
  JSONSchemaStore,
} from 'quicktype-core';
import type { ModuleSchema } from '../utils/json-schema';
import { convertRefsToDefinitions } from '../utils/json-schema';

/** Custom schema store for resolving local refs */
class LocalSchemaStore extends JSONSchemaStore {
  async fetch(_address: string): Promise<undefined> {
    return undefined;
  }
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
 * Generate all type definitions for a module using quicktype.
 */
export async function generateAllTypesWithQuicktype(
  _moduleName: string,
  schema: ModuleSchema,
  lang: string
): Promise<string> {
  const allDefs = schema.$defs || {};

  const schemaInput = new JSONSchemaInput(new LocalSchemaStore());

  for (const [name, def] of Object.entries(allDefs)) {
    const typeSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: name,
      definitions: {} as Record<string, unknown>,
      ...convertRefsToDefinitions(def),
    };

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
