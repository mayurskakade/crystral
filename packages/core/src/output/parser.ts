/**
 * Simple JSON schema validation (subset)
 * Supports: type checking for object/string/number/boolean, required fields, enum values
 */

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate data against a JSON schema (subset implementation)
 */
export function validateJsonSchema(
  data: unknown,
  schema: Record<string, unknown>,
  path: string = ''
): SchemaValidationResult {
  const errors: string[] = [];

  const type = schema.type as string | undefined;

  if (type !== undefined) {
    if (!checkType(data, type)) {
      errors.push(`${path || 'root'}: expected type "${type}", got "${typeof data}"`);
      return { valid: false, errors };
    }
  }

  // Enum validation
  const enumValues = schema.enum as unknown[] | undefined;
  if (enumValues !== undefined) {
    if (!enumValues.includes(data)) {
      errors.push(
        `${path || 'root'}: value ${JSON.stringify(data)} is not one of [${enumValues.map(v => JSON.stringify(v)).join(', ')}]`
      );
    }
  }

  // Object-specific validations
  if (type === 'object' && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;

    // Check required fields
    if (required !== undefined) {
      for (const field of required) {
        if (!(field in obj)) {
          errors.push(`${path ? path + '.' : ''}${field}: required field is missing`);
        }
      }
    }

    // Validate each property against its sub-schema
    if (properties !== undefined) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = properties[key];
        if (propSchema !== undefined) {
          const result = validateJsonSchema(value, propSchema, path ? `${path}.${key}` : key);
          errors.push(...result.errors);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}
