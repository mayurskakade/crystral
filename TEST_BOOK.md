# Crystal AI — Test Cases Book

Comprehensive test reference for all 13 features implemented. Each section maps to a feature from GAPS.md. Mark each test case `[x]` when verified.

---

## Table of Contents

1. [Structured Output (JSON Mode)](#1-structured-output-json-mode)
2. [Retry + Fallback](#2-retry--fallback)
3. [Guardrails](#3-guardrails)
4. [Prompt Templates](#4-prompt-templates)
5. [Multimodal (Vision)](#5-multimodal-vision)
6. [Response Caching](#6-response-caching)
7. [Workflow Conditionals](#7-workflow-conditionals)
8. [Testing Framework](#8-testing-framework)
9. [Environment Profiles](#9-environment-profiles)
10. [Config Validation](#10-config-validation)
11. [Scheduling](#11-scheduling)
12. [Observability (Logging + Tracing)](#12-observability-logging--tracing)
13. [Agent Inheritance](#13-agent-inheritance)
14. [SDK Surface](#14-sdk-surface)
15. [Studio Dashboard](#15-studio-dashboard)
16. [Schema Validation (Zod)](#16-schema-validation-zod)

---

## 1. Structured Output (JSON Mode)

**Files:** `core/src/output/index.ts`, `core/src/output/parser.ts`, `core/src/agent/runner.ts`

### 1.1 Output Parser — `parseOutput()`

- [ ] **1.1.1** Text format returns response as-is with `valid: true`
  ```ts
  parseOutput('hello', { format: 'text', strict: false })
  // => { parsed: 'hello', raw: 'hello', valid: true }
  ```

- [ ] **1.1.2** JSON format parses valid JSON directly
  ```ts
  parseOutput('{"key":"value"}', { format: 'json', strict: false })
  // => { parsed: { key: 'value' }, raw: '...', valid: true }
  ```

- [ ] **1.1.3** JSON format extracts from markdown code fences
  ```ts
  parseOutput('Here is the result:\n```json\n{"ok":true}\n```', { format: 'json', strict: false })
  // => { parsed: { ok: true }, raw: '...', valid: true }
  ```

- [ ] **1.1.4** JSON format returns `valid: false` for unparseable text
  ```ts
  parseOutput('not json at all', { format: 'json', strict: false })
  // => { parsed: undefined, raw: '...', valid: false, error: 'Failed to parse JSON...' }
  ```

- [ ] **1.1.5** Strict mode with schema validates parsed JSON
  ```ts
  parseOutput('{"name":"Alice"}', { format: 'json', strict: true, schema: { type: 'object', required: ['name', 'age'], properties: { name: { type: 'string' }, age: { type: 'number' } } } })
  // => valid: false, error contains 'age: required field is missing'
  ```

- [ ] **1.1.6** Strict mode passes when schema is satisfied
  ```ts
  parseOutput('{"name":"Alice","age":30}', { format: 'json', strict: true, schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } })
  // => valid: true, parsed: { name: 'Alice', age: 30 }
  ```

### 1.2 JSON Schema Validator — `validateJsonSchema()`

- [ ] **1.2.1** Type check: string
  ```ts
  validateJsonSchema('hello', { type: 'string' })  // => valid: true
  validateJsonSchema(42, { type: 'string' })        // => valid: false
  ```

- [ ] **1.2.2** Type check: number, integer
  ```ts
  validateJsonSchema(3.14, { type: 'number' })   // => valid: true
  validateJsonSchema(3.14, { type: 'integer' })   // => valid: false
  validateJsonSchema(3, { type: 'integer' })       // => valid: true
  ```

- [ ] **1.2.3** Type check: boolean, array, object
  ```ts
  validateJsonSchema(true, { type: 'boolean' })    // => valid: true
  validateJsonSchema([1,2], { type: 'array' })      // => valid: true
  validateJsonSchema({}, { type: 'object' })         // => valid: true
  ```

- [ ] **1.2.4** Enum validation
  ```ts
  validateJsonSchema('red', { enum: ['red', 'green', 'blue'] })     // => valid: true
  validateJsonSchema('yellow', { enum: ['red', 'green', 'blue'] })  // => valid: false
  ```

- [ ] **1.2.5** Required fields check on objects
  ```ts
  validateJsonSchema({ a: 1 }, { type: 'object', required: ['a', 'b'], properties: { a: { type: 'number' }, b: { type: 'number' } } })
  // => valid: false, errors: ['b: required field is missing']
  ```

- [ ] **1.2.6** Nested property validation
  ```ts
  validateJsonSchema({ inner: { x: 'not-a-number' } }, { type: 'object', properties: { inner: { type: 'object', properties: { x: { type: 'number' } } } } })
  // => valid: false, errors include type mismatch at 'inner.x'
  ```

### 1.3 Retry Prompt — `buildRetryPrompt()`

- [ ] **1.3.1** Returns a prompt containing the error message
  ```ts
  buildRetryPrompt('Missing field "age"')
  // => includes 'Missing field "age"' and 'valid JSON'
  ```

### 1.4 Runner Integration

- [ ] **1.4.1** Agent with `output.format: 'json'` sets `response_format: { type: 'json_object' }` on completion options
- [ ] **1.4.2** Agent with `output` config calls `parseOutput()` on the LLM response
- [ ] **1.4.3** If first parse fails, runner sends retry prompt and calls LLM again (once)
- [ ] **1.4.4** `result.parsed` contains the parsed object when parsing succeeds
- [ ] **1.4.5** `result.parsed` is undefined when parsing fails on both attempts

### 1.5 Provider JSON Mode

- [ ] **1.5.1** OpenAI provider sends `response_format: { type: 'json_object' }` when set
- [ ] **1.5.2** Google provider sends JSON mode when set
- [ ] **1.5.3** Groq provider sends JSON mode when set
- [ ] **1.5.4** Together provider sends JSON mode when set

---

## 2. Retry + Fallback

**Files:** `core/src/retry/index.ts`, `core/src/retry/fallback.ts`, `core/src/agent/runner.ts`

### 2.1 Retry — `withRetry()`

- [ ] **2.1.1** Succeeds on first attempt — no retries
  ```ts
  let calls = 0;
  await withRetry(() => { calls++; return Promise.resolve('ok'); }, { max_attempts: 3, backoff: 'none', retry_on: ['server_error'] });
  // calls === 1
  ```

- [ ] **2.1.2** Retries on retryable error up to `max_attempts`
  ```ts
  // Function fails twice with 500, succeeds third time
  // With max_attempts: 3 => should succeed
  ```

- [ ] **2.1.3** Does NOT retry non-matching error types
  ```ts
  // Function throws TypeError, retry_on: ['rate_limit']
  // Should throw immediately without retry
  ```

- [ ] **2.1.4** Rate limit error (status 429) is retryable when `retry_on` includes `'rate_limit'`

- [ ] **2.1.5** Server error (status >= 500) is retryable when `retry_on` includes `'server_error'`

- [ ] **2.1.6** Timeout error (message contains 'timeout') is retryable when `retry_on` includes `'timeout'`

- [ ] **2.1.7** Backoff `'none'` — zero delay between retries

- [ ] **2.1.8** Backoff `'linear'` — delay = attempt * 1000ms (1s, 2s, 3s...)

- [ ] **2.1.9** Backoff `'exponential'` — delay = 2^attempt * 500ms (1s, 2s, 4s...)

- [ ] **2.1.10** Throws last error after all attempts exhausted

### 2.2 Fallback — `withFallback()`

- [ ] **2.2.1** Primary succeeds — returns result with primary provider info
  ```ts
  const r = await withFallback(() => Promise.resolve('ok'), [...], createFb, 'openai', 'gpt-4o');
  // r.providerUsed === { provider: 'openai', model: 'gpt-4o' }
  ```

- [ ] **2.2.2** Primary fails — first fallback succeeds
  ```ts
  // Primary throws, fallback[0] succeeds
  // r.providerUsed === { provider: fallback[0].provider, model: fallback[0].model }
  ```

- [ ] **2.2.3** Primary and first fallback fail — second fallback succeeds

- [ ] **2.2.4** All providers fail — throws last error

- [ ] **2.2.5** Empty fallback list — throws primary error immediately

### 2.3 Runner Integration

- [ ] **2.3.1** Agent with `retry` config wraps LLM call in `withRetry()`
- [ ] **2.3.2** Agent with `fallback` config wraps LLM call in `withFallback()`
- [ ] **2.3.3** `result.providerUsed` reflects which provider actually served (primary or fallback)
- [ ] **2.3.4** Retry wraps each fallback provider individually (retry per fallback)

---

## 3. Guardrails

**Files:** `core/src/guardrails/index.ts`, `core/src/guardrails/pii.ts`, `core/src/agent/runner.ts`, `core/src/errors/index.ts`

### 3.1 Input Guardrails — `checkInputGuardrails()`

- [ ] **3.1.1** No config — returns `{ passed: true }`
  ```ts
  checkInputGuardrails('anything', undefined)  // => { passed: true }
  ```

- [ ] **3.1.2** `max_length` — blocks when message exceeds limit
  ```ts
  checkInputGuardrails('hello world', { max_length: 5, pii_action: 'none' })
  // => { passed: false, violation: '...exceeds maximum length of 5...' }
  ```

- [ ] **3.1.3** `max_length` — passes when within limit

- [ ] **3.1.4** `block_patterns` — blocks on regex match
  ```ts
  checkInputGuardrails('DROP TABLE users', { block_patterns: ['DROP\\s+TABLE'], pii_action: 'none' })
  // => { passed: false, violation: '...matches blocked pattern...' }
  ```

- [ ] **3.1.5** `block_patterns` — passes when no match

- [ ] **3.1.6** `block_topics` — blocks on keyword match (case-insensitive)
  ```ts
  checkInputGuardrails('Tell me about violence', { block_topics: ['violence'], pii_action: 'none' })
  // => { passed: false, violation: '...blocked topic: violence' }
  ```

- [ ] **3.1.7** `block_topics` — passes when no topic match

- [ ] **3.1.8** `pii_action: 'block'` — blocks when PII detected
  ```ts
  checkInputGuardrails('Email me at john@example.com', { pii_action: 'block' })
  // => { passed: false, violation: '...contains PII (email)' }
  ```

- [ ] **3.1.9** `pii_action: 'redact'` — passes with transformed text
  ```ts
  checkInputGuardrails('Call me at 555-123-4567', { pii_action: 'redact' })
  // => { passed: true, transformed: 'Call me at [REDACTED_PHONE]' }
  ```

- [ ] **3.1.10** `pii_action: 'warn'` — passes but notes PII
  ```ts
  // => { passed: true, violation: '...contains PII...warning only' }
  ```

- [ ] **3.1.11** `pii_action: 'none'` — skips PII check entirely

### 3.2 Output Guardrails — `checkOutputGuardrails()`

- [ ] **3.2.1** No config — returns `{ passed: true }`

- [ ] **3.2.2** `max_length` — blocks when response exceeds limit

- [ ] **3.2.3** `require_patterns` — blocks when none of the required patterns match
  ```ts
  checkOutputGuardrails('random text', { require_patterns: ['\\d+\\.\\d+'], pii_action: 'none' })
  // => { passed: false, violation: '...does not match any required pattern' }
  ```

- [ ] **3.2.4** `require_patterns` — passes when at least one pattern matches

- [ ] **3.2.5** `block_patterns` — blocks when pattern matches

- [ ] **3.2.6** PII actions work the same as input guardrails (block/redact/warn/none)

### 3.3 PII Detection — `detectPII()`

- [ ] **3.3.1** Detects email addresses
  ```ts
  detectPII('Contact john@example.com')  // => { found: true, types: ['email'] }
  ```

- [ ] **3.3.2** Detects SSN patterns (###-##-####)
  ```ts
  detectPII('SSN: 123-45-6789')  // => { found: true, types: ['ssn'] }
  ```

- [ ] **3.3.3** Detects credit card numbers (#### #### #### ####)
  ```ts
  detectPII('Card: 4111 1111 1111 1111')  // => { found: true, types: ['credit_card'] }
  ```

- [ ] **3.3.4** Detects phone numbers
  ```ts
  detectPII('Call (555) 123-4567')  // => { found: true, types: ['phone'] }
  ```

- [ ] **3.3.5** Returns `found: false` when no PII present
  ```ts
  detectPII('Hello world')  // => { found: false, types: [] }
  ```

- [ ] **3.3.6** Detects multiple PII types in same text
  ```ts
  detectPII('Email: a@b.com, SSN: 123-45-6789')
  // => { found: true, types: ['email', 'ssn'] }
  ```

### 3.4 PII Redaction — `redactPII()`

- [ ] **3.4.1** Redacts emails with `[REDACTED_EMAIL]`
- [ ] **3.4.2** Redacts SSNs with `[REDACTED_SSN]`
- [ ] **3.4.3** Redacts credit cards with `[REDACTED_CREDIT_CARD]`
- [ ] **3.4.4** Redacts phone numbers with `[REDACTED_PHONE]`
- [ ] **3.4.5** Leaves non-PII text unchanged

### 3.5 Runner Integration

- [ ] **3.5.1** Input blocked — returns refusal message immediately, no LLM call
- [ ] **3.5.2** Input redacted — LLM receives redacted text, `result.guardrails.piiRedacted === true`
- [ ] **3.5.3** Output blocked — returns guardrail violation message, `result.guardrails.outputBlocked === true`
- [ ] **3.5.4** Output redacted — response has PII replaced
- [ ] **3.5.5** `result.guardrails.inputBlocked` is set correctly

### 3.6 GuardrailError

- [ ] **3.6.1** GuardrailError has `guardrailType: 'input' | 'output'` property
- [ ] **3.6.2** GuardrailError has `GUARDRAIL_VIOLATION` error code

---

## 4. Prompt Templates

**Files:** `core/src/prompts/index.ts`, `core/src/prompts/resolver.ts`, `core/src/config/loader.ts`

### 4.1 Variable Interpolation — `interpolateVariables()`

- [ ] **4.1.1** Replaces `{varName}` with value
  ```ts
  interpolateVariables('Hello {name}!', { name: 'Alice' })
  // => 'Hello Alice!'
  ```

- [ ] **4.1.2** Leaves unreferenced variables untouched
  ```ts
  interpolateVariables('Hello {name}!', {})
  // => 'Hello {name}!'
  ```

- [ ] **4.1.3** Handles multiple variables
  ```ts
  interpolateVariables('{greeting} {name}, you are {role}.', { greeting: 'Hi', name: 'Bob', role: 'admin' })
  // => 'Hi Bob, you are admin.'
  ```

- [ ] **4.1.4** Only matches valid identifier patterns `[a-zA-Z_][a-zA-Z0-9_]*`

### 4.2 Variable Merging — `mergeVariables()`

- [ ] **4.2.1** Later sources override earlier
  ```ts
  mergeVariables({ a: '1' }, { a: '2' })  // => { a: '2' }
  ```

- [ ] **4.2.2** Skips undefined sources
  ```ts
  mergeVariables({ a: '1' }, undefined, { b: '2' })  // => { a: '1', b: '2' }
  ```

### 4.3 System Prompt Resolution — `resolveSystemPrompt()`

- [ ] **4.3.1** String input — interpolates variables directly
  ```ts
  resolveSystemPrompt('You are a {role} assistant', { role: 'helpful' })
  // => 'You are a helpful assistant'
  ```

- [ ] **4.3.2** Template object — loads prompt template, merges variables, interpolates
  ```ts
  // Given prompts/support.yaml with template: 'You are {role} for {company}'
  resolveSystemPrompt({ template: 'support', variables: { company: 'Acme' } }, { role: 'agent' }, cwd)
  // => 'You are agent for Acme'
  ```

- [ ] **4.3.3** Template defaults are lowest priority (overridden by agent vars, then runtime vars)

### 4.4 Config Loader

- [ ] **4.4.1** `loadPromptTemplate(name, cwd)` — loads from `prompts/<name>.yaml`
- [ ] **4.4.2** `loadPromptTemplate()` validates against `PromptTemplateConfigSchema`
- [ ] **4.4.3** `listPromptTemplates(cwd)` — returns list of prompt template names
- [ ] **4.4.4** `writePromptTemplate(config, cwd)` — writes valid YAML to `prompts/<name>.yaml`

### 4.5 Runner Integration

- [ ] **4.5.1** Runner calls `resolveSystemPrompt()` on the agent's `system_prompt`
- [ ] **4.5.2** String system prompt works as before (backward compatible)
- [ ] **4.5.3** Template object system prompt resolves via prompt template file

---

## 5. Multimodal (Vision)

**Files:** `core/src/providers/base.ts`, `core/src/providers/openai.ts`, `core/src/providers/anthropic.ts`, `core/src/providers/google.ts`, `core/src/agent/runner.ts`

### 5.1 Image Content Builders

- [ ] **5.1.1** `buildOpenAIImageContent(images)` — returns `{ type: 'image_url', image_url: { url: 'data:...' } }` blocks
- [ ] **5.1.2** `buildAnthropicImageContent(images)` — returns `{ type: 'image', source: { type: 'base64', ... } }` blocks
- [ ] **5.1.3** `buildGeminiImageParts(images)` — returns Gemini-format `inlineData` parts

### 5.2 Provider Vision Support

- [ ] **5.2.1** OpenAI provider formats messages with image content blocks when `images` present
- [ ] **5.2.2** Anthropic provider formats messages with image content blocks when `images` present
- [ ] **5.2.3** Google provider formats messages with image parts when `images` present

### 5.3 Runner Integration

- [ ] **5.3.1** `options.images` is passed through to `completionOptions.images`
- [ ] **5.3.2** ImageInput shape: `{ data: string, media_type: string }`

---

## 6. Response Caching

**Files:** `core/src/cache/index.ts`, `core/src/cache/hasher.ts`, `core/src/storage/adapter.ts`, `core/src/agent/runner.ts`

### 6.1 Cache Key Generation — `hashCacheKey()`

- [ ] **6.1.1** Same input produces same hash (deterministic)
  ```ts
  hashCacheKey({ a: 1, b: 2 }) === hashCacheKey({ a: 1, b: 2 })  // true
  ```

- [ ] **6.1.2** Key order does not matter (stable stringify sorts keys)
  ```ts
  hashCacheKey({ b: 2, a: 1 }) === hashCacheKey({ a: 1, b: 2 })  // true
  ```

- [ ] **6.1.3** Different input produces different hash
  ```ts
  hashCacheKey({ a: 1 }) !== hashCacheKey({ a: 2 })  // true
  ```

### 6.2 Stable Stringify — `stableStringify()`

- [ ] **6.2.1** Sorts object keys alphabetically
  ```ts
  stableStringify({ c: 3, a: 1, b: 2 })
  // => '{"a":1,"b":2,"c":3}'
  ```

- [ ] **6.2.2** Handles nested objects with sorted keys
- [ ] **6.2.3** Handles arrays (order preserved)
- [ ] **6.2.4** Handles primitives: string, number, boolean, null

### 6.3 CacheManager

- [ ] **6.3.1** `get()` returns `null` when cache disabled
  ```ts
  const cm = new CacheManager(storage, { enabled: false, ttl: 3600 });
  cm.get('key')  // => null
  ```

- [ ] **6.3.2** `set()` does nothing when cache disabled

- [ ] **6.3.3** `get()` returns cached response after `set()`
  ```ts
  cm.set('key', 'response');
  cm.get('key')  // => 'response'
  ```

- [ ] **6.3.4** `get()` returns `null` for expired entries

- [ ] **6.3.5** `clear()` removes all cache entries

- [ ] **6.3.6** `clearExpired()` removes only expired entries

- [ ] **6.3.7** `generateKey()` produces deterministic key from provider/model/messages/systemPrompt

### 6.4 Storage Layer

- [ ] **6.4.1** `llm_cache` table created in SQLite schema
- [ ] **6.4.2** `getCachedResponse(key)` returns null for missing keys
- [ ] **6.4.3** `getCachedResponse(key)` returns null for expired entries
- [ ] **6.4.4** `setCachedResponse(key, response, expiresAt)` stores correctly
- [ ] **6.4.5** `clearCache()` empties the cache table
- [ ] **6.4.6** `clearExpiredCache()` deletes only expired rows
- [ ] **6.4.7** `getCacheStats()` returns hit/miss counts

### 6.5 Runner Integration

- [ ] **6.5.1** Cache lookup before LLM call when `config.cache.enabled`
- [ ] **6.5.2** Cache hit returns immediately with `result.cached === true`
- [ ] **6.5.3** Cache miss proceeds to LLM call
- [ ] **6.5.4** Response stored in cache when `temperature === 0`
- [ ] **6.5.5** Response stored in cache when `config.cache.force === true`
- [ ] **6.5.6** Response NOT stored when `temperature > 0` and `force !== true`

---

## 7. Workflow Conditionals

**Files:** `core/src/workflow/conditionals.ts`, `core/src/workflow/engine.ts`

### 7.1 Condition Evaluator — `evaluateCondition()`

- [ ] **7.1.1** Empty/whitespace expression returns `true`
  ```ts
  evaluateCondition('', {})   // => true
  evaluateCondition('  ', {}) // => true
  ```

- [ ] **7.1.2** `'always'` returns `true`
- [ ] **7.1.3** `'never'` returns `false`

- [ ] **7.1.4** Equality: `output == 'value'`
  ```ts
  evaluateCondition("status == 'approved'", { status: 'approved' })  // => true
  evaluateCondition("status == 'approved'", { status: 'denied' })    // => false
  ```

- [ ] **7.1.5** Inequality: `output != 'value'`
  ```ts
  evaluateCondition("status != 'rejected'", { status: 'approved' })  // => true
  ```

- [ ] **7.1.6** Membership: `'value' in output`
  ```ts
  evaluateCondition("'error' in result", { result: 'no error found' })  // => true
  evaluateCondition("'error' in result", { result: 'all good' })        // => false
  ```

- [ ] **7.1.7** Array membership: `'value' in list`
  ```ts
  evaluateCondition("'admin' in roles", { roles: ['user', 'admin'] })  // => true
  ```

- [ ] **7.1.8** Logical AND: `condition1 and condition2`
  ```ts
  evaluateCondition("a == '1' and b == '2'", { a: '1', b: '2' })  // => true
  evaluateCondition("a == '1' and b == '3'", { a: '1', b: '2' })  // => false
  ```

- [ ] **7.1.9** Logical OR: `condition1 or condition2`
  ```ts
  evaluateCondition("a == '1' or b == '2'", { a: '0', b: '2' })  // => true
  ```

- [ ] **7.1.10** Logical NOT: `not condition`
  ```ts
  evaluateCondition("not status == 'blocked'", { status: 'open' })  // => true
  ```

- [ ] **7.1.11** Dot-path access: `agent.field`
  ```ts
  evaluateCondition("research.status == 'done'", { research: { status: 'done' } })  // => true
  ```

- [ ] **7.1.12** Bare reference is truthy check
  ```ts
  evaluateCondition('has_data', { has_data: true })    // => true
  evaluateCondition('has_data', { has_data: false })   // => false
  evaluateCondition('has_data', { has_data: '' })      // => false
  evaluateCondition('missing', {})                      // => false
  ```

- [ ] **7.1.13** Quoted string literals (single and double quotes)
- [ ] **7.1.14** Numeric literals
- [ ] **7.1.15** Boolean literals (`true`, `false`)
- [ ] **7.1.16** Handles quotes inside keyword splitting correctly

### 7.2 Engine Integration

- [ ] **7.2.1** Agent with `output_as` stores its result in the outputs map
- [ ] **7.2.2** Agent with `run_if` is evaluated before delegation
- [ ] **7.2.3** Agent with `run_if` returning `false` is skipped
- [ ] **7.2.4** Skipped agents report "skipped due to condition"
- [ ] **7.2.5** Outputs map is passed to subsequent condition evaluations

---

## 8. Testing Framework

**Files:** `core/src/testing/runner.ts`, `core/src/testing/assertions.ts`, `core/src/testing/mock-provider.ts`, `core/src/testing/dry-run.ts`, `core/src/config/loader.ts`

### 8.1 Assertions

- [ ] **8.1.1** `assertContains('hello world', 'hello')` => passed
- [ ] **8.1.2** `assertContains('hello world', 'missing')` => failed with error
- [ ] **8.1.3** `assertNotContains('hello world', 'missing')` => passed
- [ ] **8.1.4** `assertNotContains('hello world', 'hello')` => failed
- [ ] **8.1.5** `assertMaxTokens('one two three', 5)` => passed
- [ ] **8.1.6** `assertMaxTokens('one two three four five six', 3)` => failed
- [ ] **8.1.7** `assertSchema({ name: 'Alice' }, { name: 'string' })` => passed
- [ ] **8.1.8** `assertSchema({ name: 42 }, { name: 'string' })` => failed
- [ ] **8.1.9** `assertSchema(null, { name: 'string' })` => failed (null/undefined)
- [ ] **8.1.10** `assertGuardrailBlocked(true, true)` => passed
- [ ] **8.1.11** `assertGuardrailBlocked(false, true)` => failed

### 8.2 Mock Provider

- [ ] **8.2.1** Returns echo of last user message
  ```ts
  const mock = new MockProvider();
  const r = await mock.complete([{ role: 'user', content: 'hello' }]);
  // r.content === 'hello'
  ```

- [ ] **8.2.2** Returns `finish_reason: 'stop'`
- [ ] **8.2.3** Returns zero token usage
- [ ] **8.2.4** Returns `'mock response'` when no messages

### 8.3 Test Suite Runner — `runTestSuite()`

- [ ] **8.3.1** Runs all test cases and returns aggregated result
  ```ts
  const config = { name: 'suite', agent: 'test', tests: [...], version: 1, mock: false };
  const result = await runTestSuite(config, mockRunner);
  // result.suite === 'suite', result.results.length === tests.length
  ```

- [ ] **8.3.2** Passing test: `expect.contains` matches response
- [ ] **8.3.3** Failing test: `expect.contains` does NOT match response
- [ ] **8.3.4** `expect.not_contains` works correctly
- [ ] **8.3.5** `expect.max_tokens` works correctly
- [ ] **8.3.6** `expect.output_schema` validates parsed output
- [ ] **8.3.7** `expect.guardrail_blocked` checks if input was blocked
- [ ] **8.3.8** Multiple expectations combined — all must pass
- [ ] **8.3.9** Agent run error is caught and marked as failed test
- [ ] **8.3.10** `result.passed` and `result.failed` counts are correct
- [ ] **8.3.11** `result.duration` reflects total suite time
- [ ] **8.3.12** Test variables passed through to agent runner

### 8.4 Dry Run — `dryRun()`

- [ ] **8.4.1** Returns resolved agent config without making LLM calls
- [ ] **8.4.2** Resolves system prompt (string or template)
- [ ] **8.4.3** Lists agent tools
- [ ] **8.4.4** Reports warnings for: missing project root, no tools, empty system prompt
- [ ] **8.4.5** Handles inheritance (`extends`) before returning config

### 8.5 Config Loader

- [ ] **8.5.1** `loadTestSuite(name, cwd)` loads from `tests/<name>.yaml`
- [ ] **8.5.2** `loadTestSuite()` validates against `TestSuiteConfigSchema`
- [ ] **8.5.3** `listTestSuites(cwd)` returns list of test suite names

---

## 9. Environment Profiles

**Files:** `core/src/profiles/index.ts`, `core/src/config/loader.ts`

### 9.1 Profile Resolution — `getActiveProfile()`

- [ ] **9.1.1** Returns explicit profile name when provided
  ```ts
  getActiveProfile(config, 'staging')  // => 'staging'
  ```

- [ ] **9.1.2** Falls back to `CRYSTRAL_PROFILE` env var
  ```ts
  process.env.CRYSTRAL_PROFILE = 'production';
  getActiveProfile(config)  // => 'production'
  ```

- [ ] **9.1.3** Returns `undefined` when no profile specified and no env var

### 9.2 Profile Application — `applyProfile()`

- [ ] **9.2.1** No active profile — returns agent config unchanged
- [ ] **9.2.2** Profile not found in project config — returns agent config unchanged
- [ ] **9.2.3** Profile applies `cache` when agent doesn't have it
  ```ts
  // agent: { cache: undefined }, profile: { cache: { enabled: true, ttl: 600 } }
  // result.cache === { enabled: true, ttl: 600 }
  ```

- [ ] **9.2.4** Agent's explicit `cache` takes precedence over profile
  ```ts
  // agent: { cache: { enabled: false, ttl: 100 } }, profile: { cache: { enabled: true, ttl: 600 } }
  // result.cache === { enabled: false, ttl: 100 }
  ```

- [ ] **9.2.5** Profile applies `logging` as default
- [ ] **9.2.6** Profile applies `guardrails` as default
- [ ] **9.2.7** Profile's `default_provider`/`default_model` — acts as fallback (agent provider/model are required so these are effectively informational)

### 9.3 Loader Integration

- [ ] **9.3.1** `loadAgentConfig()` applies active profile after loading
- [ ] **9.3.2** Profile applied after inheritance resolution (extends)
- [ ] **9.3.3** `getActiveProfileName(cwd)` reads env var and returns name

---

## 10. Config Validation

**Files:** `core/src/validation/index.ts`

### 10.1 `validateProject()`

- [ ] **10.1.1** Validates project config (`crystral.config.yaml`) against `ProjectConfigSchema`
- [ ] **10.1.2** Validates all agent configs in `agents/` against `AgentConfigSchema`
- [ ] **10.1.3** Validates all tool configs in `tools/` against `ToolConfigSchema`
- [ ] **10.1.4** Validates all workflow configs in `workflows/` against `WorkflowConfigSchema`
- [ ] **10.1.5** Validates all prompt templates in `prompts/` against `PromptTemplateConfigSchema`
- [ ] **10.1.6** Validates all test suites in `tests/` against `TestSuiteConfigSchema`
- [ ] **10.1.7** Validates all schedules in `schedules/` against `ScheduleConfigSchema`

### 10.2 Result Structure

- [ ] **10.2.1** `result.files` contains per-file details
- [ ] **10.2.2** Each file result has `file`, `type`, `valid`, `errors[]`, `warnings[]`
- [ ] **10.2.3** `result.valid` count is correct
- [ ] **10.2.4** `result.errors` count is correct
- [ ] **10.2.5** `result.warnings` count is correct

### 10.3 Error Reporting

- [ ] **10.3.1** Zod validation errors include field paths (e.g., `name: String must contain at least 1 character(s)`)
- [ ] **10.3.2** Non-YAML files produce appropriate errors
- [ ] **10.3.3** Missing `version` field generates a warning
- [ ] **10.3.4** Non-existent directories are skipped gracefully

### 10.4 Edge Cases

- [ ] **10.4.1** Valid project with all config types passes
- [ ] **10.4.2** Empty project (no config files) returns zero files
- [ ] **10.4.3** Mixed valid/invalid configs reports correct counts

---

## 11. Scheduling

**Files:** `core/src/scheduling/index.ts`, `core/src/config/loader.ts`

### 11.1 Cron Parser — `parseCron()`

- [ ] **11.1.1** `* * * * *` matches every minute
  ```ts
  parseCron('* * * * *').matches(new Date())  // => true (always)
  ```

- [ ] **11.1.2** `0 * * * *` matches only at minute 0 (hourly)
  ```ts
  const d = new Date('2026-01-01T10:00:00');
  parseCron('0 * * * *').matches(d)  // => true
  d.setMinutes(5);
  parseCron('0 * * * *').matches(d)  // => false
  ```

- [ ] **11.1.3** `*/5 * * * *` matches every 5 minutes (0, 5, 10, ... 55)

- [ ] **11.1.4** `0 9 * * 1-5` matches weekdays at 9:00 AM
  ```ts
  // Monday at 9:00 => true
  // Saturday at 9:00 => false
  ```

- [ ] **11.1.5** Range: `1-5` generates values [1, 2, 3, 4, 5]

- [ ] **11.1.6** List: `1,3,5` matches only those values

- [ ] **11.1.7** Step: `*/10` from 0-59 generates [0, 10, 20, 30, 40, 50]

- [ ] **11.1.8** Invalid expression (not 5 fields) throws error

- [ ] **11.1.9** Day of week: 0 = Sunday, 6 = Saturday

- [ ] **11.1.10** Month field is 1-indexed (1 = January)

### 11.2 ScheduleRunner

- [ ] **11.2.1** `load(configs)` stores schedules and computes next run times
- [ ] **11.2.2** `start(executor)` starts the interval timer
- [ ] **11.2.3** `start()` does not create duplicate timers if called twice
- [ ] **11.2.4** `stop()` clears the interval timer
- [ ] **11.2.5** `getSchedules()` returns all schedules with next run times
- [ ] **11.2.6** `toggle(name, false)` disables a schedule
- [ ] **11.2.7** `toggle(name, true)` re-enables and recomputes next run
- [ ] **11.2.8** Disabled schedules are skipped during tick
- [ ] **11.2.9** Executor is called when `now >= nextRun`
- [ ] **11.2.10** `nextRun` is updated after executor fires

### 11.3 Config Loader

- [ ] **11.3.1** `loadScheduleConfig(name, cwd)` loads from `schedules/<name>.yaml`
- [ ] **11.3.2** `loadScheduleConfig()` validates against `ScheduleConfigSchema`
- [ ] **11.3.3** `listSchedules(cwd)` returns list of schedule names

---

## 12. Observability (Logging + Tracing)

**Files:** `core/src/observability/logger.ts`, `core/src/observability/tracer.ts`, `core/src/agent/runner.ts`

### 12.1 Logger

- [ ] **12.1.1** `Logger.getInstance()` returns singleton
  ```ts
  Logger.getInstance() === Logger.getInstance()  // true
  ```

- [ ] **12.1.2** `Logger.configure()` replaces the singleton instance

- [ ] **12.1.3** `Logger.reset()` clears the singleton

- [ ] **12.1.4** Log level filtering: debug messages hidden at `info` level
  ```ts
  const logger = Logger.getInstance({ level: 'info', trace: false, export: 'stdout' });
  logger.debug('hidden');  // not output
  logger.info('shown');    // output
  ```

- [ ] **12.1.5** Log level filtering: error shown at all levels

- [ ] **12.1.6** Level hierarchy: debug < info < warn < error

- [ ] **12.1.7** Output is structured JSON with `timestamp`, `level`, `message`, optional `data`

- [ ] **12.1.8** Export `'stdout'` writes to console.log

### 12.2 Tracer

- [ ] **12.2.1** Trace ID format: `trc_<16chars>`
  ```ts
  const t = new Tracer();
  t.id.startsWith('trc_')  // true
  t.id.length === 20        // true (4 + 16)
  ```

- [ ] **12.2.2** `startSpan()` creates a span with name and attributes
  ```ts
  const span = tracer.startSpan('test', { key: 'value' });
  span.name === 'test'
  span.attributes.key === 'value'
  ```

- [ ] **12.2.3** `endSpan()` sets endTime and durationMs
  ```ts
  tracer.startSpan('test');
  const span = tracer.endSpan();
  span.durationMs >= 0  // true
  ```

- [ ] **12.2.4** `endSpan()` returns null when no active span

- [ ] **12.2.5** Starting a new span auto-ends the active span

- [ ] **12.2.6** `getSpans()` returns all completed spans in order

- [ ] **12.2.7** Span ID format: `spn_<16chars>`

- [ ] **12.2.8** Span has `traceId` matching the tracer's ID

### 12.3 Runner Integration

- [ ] **12.3.1** Logger initialized with `config.logging` at start of run
- [ ] **12.3.2** Tracer created when `config.logging.trace === true`
- [ ] **12.3.3** Tracer NOT created when `trace === false`
- [ ] **12.3.4** `result.traceId` set when tracing enabled
- [ ] **12.3.5** `result.traceId` undefined when tracing disabled
- [ ] **12.3.6** Spans created for: `agent.run`, `provider.complete`, `tool.execute`
- [ ] **12.3.7** Log messages emitted for: agent start, cache hit/miss, LLM call, tool execution

---

## 13. Agent Inheritance

**Files:** `core/src/config/loader.ts`

### 13.1 `extends` Field

- [ ] **13.1.1** Agent with `extends: _base` loads base config and deep merges
  ```yaml
  # agents/_base.yaml
  version: 1
  name: _base
  provider: openai
  model: gpt-4o
  temperature: 0.7

  # agents/child.yaml
  version: 1
  name: child
  extends: _base
  provider: openai
  model: gpt-4o
  temperature: 0.3   # overrides base
  ```

- [ ] **13.1.2** Child fields override base fields
- [ ] **13.1.3** Base fields used as defaults for missing child fields
- [ ] **13.1.4** Arrays replace (not concat) during merge
- [ ] **13.1.5** Circular extends detection (A extends B extends A) throws error
- [ ] **13.1.6** Multi-level inheritance: C extends B extends A

### 13.2 Underscore Convention

- [ ] **13.2.1** `listAgents()` excludes files starting with `_` prefix
- [ ] **13.2.2** `loadAgentConfig('_base')` still loads the config when explicitly requested

---

## 14. SDK Surface

**Files:** `sdk/src/index.ts`

### 14.1 Type Re-exports

- [ ] **14.1.1** All new config types exported: `OutputConfig`, `RetryConfig`, `FallbackProvider`, `GuardrailsConfig`, `GuardrailsInputConfig`, `GuardrailsOutputConfig`, `CapabilitiesConfig`, `CacheConfig`, `LoggingConfig`, `ProfileConfig`, `PromptTemplateConfig`, `ScheduleConfig`, `TestSuiteConfig`, `TestCase`, `TestExpect`, `SystemPromptTemplate`
- [ ] **14.1.2** Runtime types exported: `ImageInput`, `GuardrailResult`, `ProviderUsed`
- [ ] **14.1.3** Result types exported: `TestSuiteResult`, `TestResult`, `ValidationResult`, `ValidationFileResult`, `DryRunResult`
- [ ] **14.1.4** `GuardrailError` exported

### 14.2 Function Re-exports

- [ ] **14.2.1** `validateProject` re-exported
- [ ] **14.2.2** `runTestSuite` re-exported
- [ ] **14.2.3** `dryRun` re-exported
- [ ] **14.2.4** `resolveSystemPrompt` re-exported
- [ ] **14.2.5** `loadPromptTemplate`, `listPromptTemplates`, `writePromptTemplate` re-exported
- [ ] **14.2.6** `loadTestSuite`, `listTestSuites` re-exported
- [ ] **14.2.7** `loadScheduleConfig`, `listSchedules` re-exported

### 14.3 RunOptions Updates

- [ ] **14.3.1** `profile?: string` field exists
- [ ] **14.3.2** `images?: ImageInput[]` field exists
- [ ] **14.3.3** `variables` docs mention prompt template usage

### 14.4 RunResult Updates

- [ ] **14.4.1** `parsed?: unknown` flows from core result
- [ ] **14.4.2** `cached?: boolean` flows from core result
- [ ] **14.4.3** `traceId?: string` flows from core result
- [ ] **14.4.4** `providerUsed?: { provider, model }` flows from core result
- [ ] **14.4.5** `guardrails?: { inputBlocked?, outputBlocked?, piiRedacted? }` flows from core result

### 14.5 Agent Class

- [ ] **14.5.1** `agent.run()` passes `images` through to core runner
- [ ] **14.5.2** `agent.dryRun()` returns `DryRunResult`
- [ ] **14.5.3** Agent constructor accepts and stores `cwd`

### 14.6 Crystral Class

- [ ] **14.6.1** `client.validate()` calls `validateProject(cwd)` and returns result
- [ ] **14.6.2** `client.test(suiteName)` loads test suite, creates agent runner, runs tests
- [ ] **14.6.3** `client.loadPrompt(name)` loads prompt template
- [ ] **14.6.4** `client.loadAgent(name)` passes `cwd` to Agent constructor

---

## 15. Studio Dashboard

**Files:** `studio/src/server.ts`, `studio/src/routes/*.ts`, `studio/src/ui/dashboard.ts`

### 15.1 New API Routes

#### Prompts (`/api/prompts`)
- [ ] **15.1.1** `GET /api/prompts` — lists all prompt templates
- [ ] **15.1.2** `GET /api/prompts/:name` — returns prompt template detail
- [ ] **15.1.3** `POST /api/prompts` — creates new prompt template
- [ ] **15.1.4** `PUT /api/prompts/:name` — updates existing prompt template
- [ ] **15.1.5** `DELETE /api/prompts/:name` — deletes prompt template file

#### Tests (`/api/tests`)
- [ ] **15.1.6** `GET /api/tests` — lists all test suites
- [ ] **15.1.7** `GET /api/tests/:name` — returns test suite detail
- [ ] **15.1.8** `POST /api/tests/:name/run` — runs test suite and returns results

#### Validate (`/api/validate`)
- [ ] **15.1.9** `POST /api/validate` — validates all project configs, returns report

#### Schedules (`/api/schedules`)
- [ ] **15.1.10** `GET /api/schedules` — lists all schedules
- [ ] **15.1.11** `POST /api/schedules/:name/toggle` — toggles schedule enable/disable

### 15.2 Updated Routes

- [ ] **15.2.1** `GET /api/agents/:name` includes: output, retry, fallback, guardrails, capabilities, cache, logging, extends
- [ ] **15.2.2** `POST /api/agents` accepts new config fields
- [ ] **15.2.3** `PUT /api/agents/:name` accepts new config fields
- [ ] **15.2.4** Workflow agent responses include `run_if` and `output_as`

### 15.3 Route Mounting

- [ ] **15.3.1** `/api/prompts` route mounted in server.ts
- [ ] **15.3.2** `/api/tests` route mounted in server.ts
- [ ] **15.3.3** `/api/validate` route mounted in server.ts
- [ ] **15.3.4** `/api/schedules` route mounted in server.ts

### 15.4 Dashboard UI

- [ ] **15.4.1** Navigation includes: Prompts, Tests, Schedules
- [ ] **15.4.2** "Validate Project" button in sidebar footer
- [ ] **15.4.3** Agent form — Output Schema section (format toggle, schema textarea, strict checkbox)
- [ ] **15.4.4** Agent form — Retry section (max_attempts, backoff dropdown)
- [ ] **15.4.5** Agent form — Fallback section (provider+model pairs, add/remove)
- [ ] **15.4.6** Agent form — Guardrails section (input + output subsections)
- [ ] **15.4.7** Agent form — Capabilities section (vision toggle)
- [ ] **15.4.8** Agent form — Cache section (enabled toggle, TTL)
- [ ] **15.4.9** Agent form — Logging section (level dropdown)
- [ ] **15.4.10** Agent form — Extends field (text input)
- [ ] **15.4.11** Prompts page — list templates, create/edit form
- [ ] **15.4.12** Tests page — list suites, run button, results display
- [ ] **15.4.13** Schedules page — list with toggle, schedule expression
- [ ] **15.4.14** Workflow detail — `run_if` shown as badges
- [ ] **15.4.15** Workflow detail — `output_as` shown as badges
- [ ] **15.4.16** Validate button shows results modal

---

## 16. Schema Validation (Zod)

**Files:** `core/src/types/config.ts`

### 16.1 New Schemas Parse Valid Input

- [ ] **16.1.1** `OutputConfigSchema` parses `{ format: 'json', strict: true }`
- [ ] **16.1.2** `RetryConfigSchema` parses `{ max_attempts: 3, backoff: 'exponential', retry_on: ['rate_limit'] }`
- [ ] **16.1.3** `FallbackProviderSchema` parses `[{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }]`
- [ ] **16.1.4** `GuardrailsInputConfigSchema` parses `{ max_length: 5000, pii_action: 'redact' }`
- [ ] **16.1.5** `GuardrailsOutputConfigSchema` parses `{ max_length: 2000, require_patterns: ['\\d+'], pii_action: 'none' }`
- [ ] **16.1.6** `CapabilitiesConfigSchema` parses `{ vision: true, max_image_size: 1048576 }`
- [ ] **16.1.7** `CacheConfigSchema` parses `{ enabled: true, ttl: 3600, force: true }`
- [ ] **16.1.8** `LoggingConfigSchema` parses `{ level: 'debug', trace: true, export: 'file' }`
- [ ] **16.1.9** `ProfileConfigSchema` parses `{ default_provider: 'openai', cache: { enabled: true, ttl: 600 } }`
- [ ] **16.1.10** `PromptTemplateConfigSchema` parses `{ version: 1, name: 'test', template: 'Hello {name}' }`
- [ ] **16.1.11** `SystemPromptSchema` parses string `'You are helpful'`
- [ ] **16.1.12** `SystemPromptSchema` parses object `{ template: 'support', variables: { tone: 'friendly' } }`
- [ ] **16.1.13** `ScheduleConfigSchema` parses `{ version: 1, name: 's1', agent: 'reporter', schedule: '0 9 * * *', input: 'Generate report' }`
- [ ] **16.1.14** `TestSuiteConfigSchema` parses with at least one test case
- [ ] **16.1.15** `TestExpectSchema` parses `{ contains: 'hello', max_tokens: 100 }`

### 16.2 Extended Schemas

- [ ] **16.2.1** `AgentConfigSchema` accepts `output`, `retry`, `fallback`, `guardrails`, `capabilities`, `cache`, `logging`, `extends` (all optional)
- [ ] **16.2.2** `ProjectConfigSchema` accepts `cache`, `profiles`, `logging` (all optional)
- [ ] **16.2.3** `WorkflowAgentSchema` accepts `run_if` and `output_as` (optional strings)

### 16.3 Defaults

- [ ] **16.3.1** `OutputConfigSchema` defaults: `format: 'text'`, `strict: false`
- [ ] **16.3.2** `RetryConfigSchema` defaults: `max_attempts: 3`, `backoff: 'exponential'`, `retry_on: ['rate_limit', 'server_error', 'timeout']`
- [ ] **16.3.3** `CacheConfigSchema` defaults: `enabled: false`, `ttl: 3600`
- [ ] **16.3.4** `LoggingConfigSchema` defaults: `level: 'info'`, `trace: false`, `export: 'stdout'`
- [ ] **16.3.5** `AgentConfigSchema` defaults: `temperature: 1.0`, `max_tokens: 4096`, `top_p: 1.0`, `system_prompt: ''`

### 16.4 Validation Rejections

- [ ] **16.4.1** Agent name with spaces rejected
- [ ] **16.4.2** Agent name with special chars (e.g., `@#$`) rejected
- [ ] **16.4.3** `max_attempts` outside 1-10 range rejected
- [ ] **16.4.4** `temperature` outside 0-2 range rejected
- [ ] **16.4.5** `version` not equal to `1` rejected (literal check)
- [ ] **16.4.6** Unknown provider string rejected (not in enum)
- [ ] **16.4.7** Empty `name` field rejected (min 1 char)

---

## Execution Notes

### Running Unit Tests

```bash
# Typecheck all packages
pnpm -r typecheck

# Build all packages
pnpm -r build

# Run a specific test file (if vitest/jest configured)
pnpm --filter @crystral/core test -- --grep "output parser"
```

### Manual Verification

Create a test project structure:
```
test-project/
  crystral.config.yaml
  agents/
    _base.yaml
    test-agent.yaml
  tools/
    search.yaml
  workflows/
    pipeline.yaml
  prompts/
    support.yaml
  tests/
    basic.yaml
  schedules/
    daily-report.yaml
```

### Full-Feature Agent YAML

```yaml
version: 1
name: full-test
extends: _base
provider: openai
model: gpt-4o
system_prompt:
  template: support
  variables:
    role: tester
output:
  format: json
  schema:
    type: object
    properties:
      ok:
        type: boolean
  strict: true
retry:
  max_attempts: 3
  backoff: exponential
fallback:
  - provider: anthropic
    model: claude-sonnet-4-20250514
guardrails:
  input:
    max_length: 5000
    pii_action: redact
  output:
    max_length: 2000
capabilities:
  vision: true
cache:
  enabled: true
  ttl: 3600
logging:
  level: debug
  trace: true
```

### SDK Smoke Test

```typescript
import { Crystral } from '@crystral/sdk';

const client = new Crystral({ cwd: './test-project' });

// Validate all configs
const validation = client.validate();
console.log(`${validation.valid} valid, ${validation.errors} errors`);

// Load and dry-run agent
const agent = client.loadAgent('full-test');
const dryResult = agent.dryRun();
console.log('Warnings:', dryResult.warnings);

// Run tests
const testResult = await client.test('basic');
console.log(`${testResult.passed}/${testResult.passed + testResult.failed} passed`);

// Load prompt
const prompt = client.loadPrompt('support');
console.log('Template:', prompt.template);
```

---

**Total Test Cases: 278**
