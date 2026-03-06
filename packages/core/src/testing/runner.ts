/**
 * Test runner for Crystal AI test suites.
 *
 * Loads a TestSuiteConfig, runs each test case through an agent runner,
 * evaluates assertions, and returns a TestSuiteResult.
 */
import type { TestSuiteConfig, TestExpect } from '../types/index.js';
import {
  assertContains,
  assertNotContains,
  assertMaxTokens,
  assertSchema,
  assertGuardrailBlocked,
} from './assertions.js';

// ---------------------------------------------------------------------------
// Built-in framework logger
// ---------------------------------------------------------------------------

type LogTag = 'EXECUTE' | 'RESULT ' | 'ASSERT ' | 'PASS   ' | 'FAIL   ' | 'SUITE  ';

function flog(tag: LogTag, message: string): void {
  console.log(`[${tag}] ${message}`);
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  response?: string;
}

export interface TestSuiteResult {
  suite: string;
  agent: string;
  results: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// Minimal agent runner interface expected by the test runner
// ---------------------------------------------------------------------------

export interface TestableAgentRunner {
  run(
    input: string,
    options?: { variables?: Record<string, string> },
  ): Promise<{
    response: string;
    parsed?: unknown;
    guardrails?: { inputBlocked?: boolean };
  }>;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Run every test case in a test suite and return aggregated results.
 */
export async function runTestSuite(
  config: TestSuiteConfig,
  agentRunner: TestableAgentRunner,
  _options?: { mock?: boolean },
): Promise<TestSuiteResult> {
  const suiteStart = Date.now();
  const results: TestResult[] = [];

  flog('SUITE  ', `Starting suite "${config.name}" (agent: ${config.agent}, tests: ${config.tests.length})`);

  for (const testCase of config.tests) {
    const caseStart = Date.now();
    let result: TestResult;

    flog('EXECUTE', `[${testCase.name}] agent.run(${JSON.stringify(testCase.input)})`);

    try {
      const opts = testCase.variables ? { variables: testCase.variables } : undefined;
      const runResult = await agentRunner.run(testCase.input, opts);

      const response = runResult.response;
      flog('RESULT ', `[${testCase.name}] ${JSON.stringify({ response: response.slice(0, 120), parsed: runResult.parsed ?? null })}`);

      const errors = evaluateExpectations(
        testCase.expect,
        response,
        runResult.parsed,
        runResult.guardrails?.inputBlocked ?? false,
        testCase.name,
      );

      if (errors.length > 0) {
        flog('FAIL   ', `[${testCase.name}] ${errors.join(' | ')}`);
        result = {
          name: testCase.name,
          passed: false,
          error: errors.join(' | '),
          duration: Date.now() - caseStart,
          response,
        };
      } else {
        flog('PASS   ', `[${testCase.name}] all assertions passed (${Date.now() - caseStart}ms)`);
        result = {
          name: testCase.name,
          passed: true,
          duration: Date.now() - caseStart,
          response,
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      flog('FAIL   ', `[${testCase.name}] Execution error: ${errorMessage}`);
      result = {
        name: testCase.name,
        passed: false,
        error: `Execution error: ${errorMessage}`,
        duration: Date.now() - caseStart,
      };
    }

    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const duration = Date.now() - suiteStart;

  flog('SUITE  ', `Finished "${config.name}": ${passed} passed, ${failed} failed (${duration}ms)`);

  return {
    suite: config.name,
    agent: config.agent,
    results,
    passed,
    failed,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evaluateExpectations(
  expect: TestExpect,
  response: string,
  parsed: unknown,
  wasBlocked: boolean,
  testName: string,
): string[] {
  const errors: string[] = [];

  if (expect.contains !== undefined) {
    flog('ASSERT ', `[${testName}] contains(${JSON.stringify(expect.contains)})`);
    const r = assertContains(response, expect.contains);
    if (!r.passed && r.error) errors.push(r.error);
  }

  if (expect.not_contains !== undefined) {
    flog('ASSERT ', `[${testName}] not_contains(${JSON.stringify(expect.not_contains)})`);
    const r = assertNotContains(response, expect.not_contains);
    if (!r.passed && r.error) errors.push(r.error);
  }

  if (expect.max_tokens !== undefined) {
    flog('ASSERT ', `[${testName}] max_tokens(${expect.max_tokens})`);
    const r = assertMaxTokens(response, expect.max_tokens);
    if (!r.passed && r.error) errors.push(r.error);
  }

  if (expect.output_schema !== undefined) {
    flog('ASSERT ', `[${testName}] output_schema(${JSON.stringify(expect.output_schema)})`);
    const r = assertSchema(parsed, expect.output_schema);
    if (!r.passed && r.error) errors.push(r.error);
  }

  if (expect.guardrail_blocked !== undefined) {
    flog('ASSERT ', `[${testName}] guardrail_blocked(expected=${expect.guardrail_blocked}, actual=${wasBlocked})`);
    const r = assertGuardrailBlocked(wasBlocked, expect.guardrail_blocked);
    if (!r.passed && r.error) errors.push(r.error);
  }

  return errors;
}
