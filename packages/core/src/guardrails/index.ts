import type { GuardrailsInputConfig, GuardrailsOutputConfig } from '../types/index.js';
import { detectPII, redactPII } from './pii.js';

export interface GuardrailCheckResult {
  passed: boolean;
  violation?: string;
  transformed?: string;
}

/**
 * Check input guardrails against a user message.
 *
 * - max_length: blocks if message exceeds the limit
 * - block_patterns: blocks if any regex pattern matches
 * - block_topics: blocks if any keyword is found (case-insensitive)
 * - pii_action: 'block' blocks on PII, 'redact' redacts and passes, 'warn' passes but notes, 'none' skips
 */
export function checkInputGuardrails(
  message: string,
  config?: GuardrailsInputConfig,
): GuardrailCheckResult {
  if (!config) {
    return { passed: true };
  }

  // Check max_length
  if (config.max_length !== undefined && message.length > config.max_length) {
    return {
      passed: false,
      violation: `Input exceeds maximum length of ${config.max_length} characters (got ${message.length})`,
    };
  }

  // Check block_patterns
  if (config.block_patterns) {
    for (const pattern of config.block_patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(message)) {
        return {
          passed: false,
          violation: `Input matches blocked pattern: ${pattern}`,
        };
      }
    }
  }

  // Check block_topics (simple keyword match, case-insensitive)
  if (config.block_topics) {
    const lowerMessage = message.toLowerCase();
    for (const topic of config.block_topics) {
      if (lowerMessage.includes(topic.toLowerCase())) {
        return {
          passed: false,
          violation: `Input contains blocked topic: ${topic}`,
        };
      }
    }
  }

  // Check PII
  if (config.pii_action !== 'none') {
    const piiResult = detectPII(message);
    if (piiResult.found) {
      switch (config.pii_action) {
        case 'block':
          return {
            passed: false,
            violation: `Input contains PII (${piiResult.types.join(', ')})`,
          };
        case 'redact':
          return {
            passed: true,
            transformed: redactPII(message),
          };
        case 'warn':
          // Pass but note the PII
          return {
            passed: true,
            violation: `Input contains PII (${piiResult.types.join(', ')}) — warning only`,
          };
      }
    }
  }

  return { passed: true };
}

/**
 * Check output guardrails against an LLM response.
 *
 * - max_length: blocks if response exceeds the limit
 * - require_patterns: blocks if none of the required patterns match
 * - block_patterns: blocks if any regex pattern matches
 * - pii_action: 'block' blocks on PII, 'redact' redacts and passes, 'warn' passes but notes, 'none' skips
 */
export function checkOutputGuardrails(
  response: string,
  config?: GuardrailsOutputConfig,
): GuardrailCheckResult {
  if (!config) {
    return { passed: true };
  }

  // Check max_length
  if (config.max_length !== undefined && response.length > config.max_length) {
    return {
      passed: false,
      violation: `Output exceeds maximum length of ${config.max_length} characters (got ${response.length})`,
    };
  }

  // Check require_patterns (must match at least one)
  if (config.require_patterns && config.require_patterns.length > 0) {
    const hasMatch = config.require_patterns.some((pattern: string) => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(response);
    });
    if (!hasMatch) {
      return {
        passed: false,
        violation: `Output does not match any required pattern`,
      };
    }
  }

  // Check block_patterns
  if (config.block_patterns) {
    for (const pattern of config.block_patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(response)) {
        return {
          passed: false,
          violation: `Output matches blocked pattern: ${pattern}`,
        };
      }
    }
  }

  // Check PII
  if (config.pii_action !== 'none') {
    const piiResult = detectPII(response);
    if (piiResult.found) {
      switch (config.pii_action) {
        case 'block':
          return {
            passed: false,
            violation: `Output contains PII (${piiResult.types.join(', ')})`,
          };
        case 'redact':
          return {
            passed: true,
            transformed: redactPII(response),
          };
        case 'warn':
          return {
            passed: true,
            violation: `Output contains PII (${piiResult.types.join(', ')}) — warning only`,
          };
      }
    }
  }

  return { passed: true };
}

export { detectPII, redactPII } from './pii.js';
