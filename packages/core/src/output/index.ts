import { validateJsonSchema } from './parser.js';
import type { OutputConfig } from '../types/index.js';

export { validateJsonSchema } from './parser.js';
export type { SchemaValidationResult } from './parser.js';

/**
 * Result of parsing an LLM response against an output config
 */
export interface OutputParseResult {
  parsed: unknown;
  raw: string;
  valid: boolean;
  error?: string;
}

/**
 * Parse an LLM response string according to the given output config.
 *
 * - If format is 'text', returns the response as-is.
 * - If format is 'json':
 *   1. Try JSON.parse directly
 *   2. Try extracting from markdown code fences (```json...```)
 *   3. If schema provided and strict, validate against it
 */
export function parseOutput(response: string, config: OutputConfig): OutputParseResult {
  if (config.format === 'text') {
    return { parsed: response, raw: response, valid: true };
  }

  // JSON mode
  let parsed: unknown;

  // 1. Try direct parse
  try {
    parsed = JSON.parse(response);
  } catch {
    // 2. Try extracting from markdown code fences
    const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch?.[1]) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch {
        return {
          parsed: undefined,
          raw: response,
          valid: false,
          error: 'Failed to parse JSON from response (tried direct parse and code fence extraction)',
        };
      }
    } else {
      return {
        parsed: undefined,
        raw: response,
        valid: false,
        error: 'Failed to parse JSON from response',
      };
    }
  }

  // 3. If schema provided and strict, validate
  if (config.schema && config.strict) {
    const validation = validateJsonSchema(parsed, config.schema);
    if (!validation.valid) {
      return {
        parsed,
        raw: response,
        valid: false,
        error: `Schema validation failed: ${validation.errors.join('; ')}`,
      };
    }
  }

  return { parsed, raw: response, valid: true };
}

/**
 * Build a retry prompt asking the model to fix its JSON output.
 */
export function buildRetryPrompt(error: string): string {
  return [
    'Your previous response could not be parsed as valid JSON.',
    `Error: ${error}`,
    '',
    'Please respond ONLY with valid JSON. Do not include markdown code fences, explanations, or any text outside the JSON object.',
  ].join('\n');
}
