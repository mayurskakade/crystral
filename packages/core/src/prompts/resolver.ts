/**
 * Variable interpolation and merging utilities for prompt templates.
 */

/**
 * Replace all {varName} placeholders in template with values from variables.
 * If a variable is referenced but not in the map, leave {varName} as-is.
 */
export function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match, varName: string) => {
    if (varName in variables) {
      return variables[varName]!;
    }
    return `{${varName}}`;
  });
}

/**
 * Merge multiple variable sources, later ones override earlier.
 * Skip undefined sources.
 */
export function mergeVariables(...sources: (Record<string, string> | undefined)[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const source of sources) {
    if (source === undefined) continue;
    for (const [key, value] of Object.entries(source)) {
      result[key] = value;
    }
  }
  return result;
}
