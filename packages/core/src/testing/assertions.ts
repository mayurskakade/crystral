/**
 * Test assertion functions for Crystal AI test suites.
 */

export interface AssertionResult {
  passed: boolean;
  error?: string;
}

/**
 * Assert that the response contains the expected substring.
 */
export function assertContains(response: string, expected: string): AssertionResult {
  const passed = response.includes(expected);
  return passed
    ? { passed: true }
    : { passed: false, error: `Expected response to contain "${expected}" but it was not found.` };
}

/**
 * Assert that the response does NOT contain the given substring.
 */
export function assertNotContains(response: string, notExpected: string): AssertionResult {
  const passed = !response.includes(notExpected);
  return passed
    ? { passed: true }
    : { passed: false, error: `Expected response to NOT contain "${notExpected}" but it was found.` };
}

/**
 * Assert that the response does not exceed maxTokens (approximated by whitespace-split word count).
 */
export function assertMaxTokens(response: string, maxTokens: number): AssertionResult {
  // Approximate token count by splitting on whitespace
  const tokenCount = response.split(/\s+/).filter(Boolean).length;
  const passed = tokenCount <= maxTokens;
  return passed
    ? { passed: true }
    : { passed: false, error: `Expected at most ${maxTokens} tokens but got approximately ${tokenCount}.` };
}

/**
 * Assert that the parsed output conforms to a basic schema shape.
 * Checks that every key in the schema exists in the parsed result
 * and that the value type matches (using typeof).
 */
export function assertSchema(parsed: unknown, schema: Record<string, unknown>): AssertionResult {
  if (parsed === null || parsed === undefined) {
    return { passed: false, error: 'Parsed output is null or undefined; expected an object matching schema.' };
  }

  if (typeof parsed !== 'object') {
    return { passed: false, error: `Expected parsed output to be an object but got ${typeof parsed}.` };
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing key "${key}".`);
      continue;
    }
    if (typeof expectedType === 'string') {
      const actualType = typeof obj[key];
      if (actualType !== expectedType) {
        errors.push(`Key "${key}" expected type "${expectedType}" but got "${actualType}".`);
      }
    }
  }

  if (errors.length > 0) {
    return { passed: false, error: `Schema validation failed: ${errors.join(' ')}` };
  }
  return { passed: true };
}

/**
 * Assert that the guardrail blocked (or did not block) as expected.
 */
export function assertGuardrailBlocked(wasBlocked: boolean, expectedBlocked: boolean): AssertionResult {
  const passed = wasBlocked === expectedBlocked;
  return passed
    ? { passed: true }
    : {
        passed: false,
        error: expectedBlocked
          ? 'Expected input to be blocked by guardrail but it was not.'
          : 'Expected input to NOT be blocked by guardrail but it was.',
      };
}
