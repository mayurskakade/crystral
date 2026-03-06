/**
 * PII detection and redaction utilities.
 */

interface PIIPattern {
  name: string;
  pattern: RegExp;
  redactLabel: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    redactLabel: '[REDACTED_EMAIL]',
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    redactLabel: '[REDACTED_SSN]',
  },
  {
    name: 'credit_card',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    redactLabel: '[REDACTED_CREDIT_CARD]',
  },
  {
    name: 'phone',
    pattern: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    redactLabel: '[REDACTED_PHONE]',
  },
];

export interface PIIDetectionResult {
  found: boolean;
  types: string[];
}

/**
 * Detect PII in the given text.
 * Returns whether PII was found and which types were detected.
 */
export function detectPII(text: string): PIIDetectionResult {
  const types: string[] = [];

  for (const piiPattern of PII_PATTERNS) {
    // Reset lastIndex since we reuse the regex
    piiPattern.pattern.lastIndex = 0;
    if (piiPattern.pattern.test(text)) {
      types.push(piiPattern.name);
    }
  }

  return {
    found: types.length > 0,
    types,
  };
}

/**
 * Redact PII in the given text, replacing matches with labeled placeholders.
 */
export function redactPII(text: string): string {
  let result = text;

  for (const piiPattern of PII_PATTERNS) {
    // Create a new regex instance to avoid shared state issues
    const regex = new RegExp(piiPattern.pattern.source, piiPattern.pattern.flags);
    result = result.replace(regex, piiPattern.redactLabel);
  }

  return result;
}
