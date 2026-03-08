# Advanced Configuration

This guide covers Crystal AI's advanced features for production deployments: structured output, retry strategies, guardrails, caching, performance tuning, and more.

For foundational concepts, see the [Getting Started](./getting-started.md) and [Tools Guide](./tools.md).

---

## Structured Output

Structured output forces the agent to return responses in a specific JSON format. Define the expected schema directly in your agent YAML -- no parsing code required.

```yaml
# agents/sentiment-analyzer.yaml
version: 1
name: sentiment-analyzer
provider: openai
model: gpt-4o
system_prompt: Analyze the sentiment of the given text.

output:
  format: json          # "json" or "text" (default: "text")
  strict: true          # Enforce schema validation (default: false)
  schema:               # JSON Schema object (optional)
    type: object
    required: [summary, sentiment, confidence]
    properties:
      summary:
        type: string
      sentiment:
        type: string
        enum: [positive, negative, neutral]
      confidence:
        type: number
        description: Confidence score between 0 and 1
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `output.format` | `"json"` or `"text"` | `"text"` | Response format |
| `output.schema` | JSON Schema object | -- | Shape of the expected response |
| `output.strict` | boolean | `false` | Whether to enforce the schema strictly |

When `format` is `json`, the provider is instructed to return valid JSON. When `schema` is also set, the response is validated against it. With `strict: true`, responses that fail validation raise an error.

> **Tip:** OpenAI and Google have native JSON mode. For other providers, Crystal AI includes the schema in the system prompt as guidance.

---

## Retry and Fallback Strategies

Crystal AI supports declarative retry logic and multi-provider fallback chains.

### Retry Configuration

```yaml
version: 1
name: reliable-agent
provider: openai
model: gpt-4o

retry:
  max_attempts: 3              # 1-10 (default: 3)
  backoff: exponential         # "none", "linear", or "exponential" (default: "exponential")
  retry_on:                    # Error types to retry on
    - rate_limit
    - server_error
    - timeout
```

Backoff timing: **none** retries immediately, **linear** waits 1s/2s/3s, **exponential** waits 1s/2s/4s/8s.

### Fallback Providers

When all retries are exhausted, fall back to alternative providers:

```yaml
fallback:
  - provider: anthropic
    model: claude-sonnet-4-20250514
  - provider: google
    model: gemini-2.5-pro
```

Fallback entries are tried in order. Each also respects the agent's retry configuration.

### Multi-Provider Failover

Combine both for maximum resilience. The execution order for the config above is:
1. Try `openai/gpt-4o` (up to 3 attempts with exponential backoff)
2. Try `anthropic/claude-sonnet-4-20250514` (up to 3 attempts)
3. Try `google/gemini-2.5-pro` (up to 3 attempts)

Ensure all providers in the chain have API keys configured.

> **Tip:** Use a fast, cheap model as your last fallback to ensure the agent always responds.

---

## Guardrails and Content Filtering

Guardrails enforce safety constraints on inputs and outputs, evaluated before and after the LLM call with no additional API cost.

```yaml
version: 1
name: safe-agent
provider: openai
model: gpt-4o

guardrails:
  input:
    max_length: 5000
    block_patterns:
      - "DROP\\s+TABLE"
      - "rm\\s+-rf"
    block_topics: [violence, illegal_activity]
    pii_action: redact

  output:
    max_length: 2000
    require_patterns: ["disclaimer"]
    block_patterns: ["internal_api_key"]
    pii_action: redact
```

### Input Guardrails

| Field | Type | Description |
|-------|------|-------------|
| `input.max_length` | integer | Maximum character count for user input |
| `input.block_patterns` | string[] | Regex patterns -- if any match, the request is blocked |
| `input.block_topics` | string[] | Topic keywords to reject |
| `input.pii_action` | string | How to handle PII in input |

### Output Guardrails

| Field | Type | Description |
|-------|------|-------------|
| `output.max_length` | integer | Maximum character count for agent output |
| `output.require_patterns` | string[] | Patterns the output must match |
| `output.block_patterns` | string[] | Patterns that trigger output rejection |
| `output.pii_action` | string | How to handle PII in output |

### PII Actions

| Action | Behavior |
|--------|----------|
| `none` | No PII handling (default) |
| `warn` | Log a warning but allow the message through |
| `redact` | Replace detected PII with `[REDACTED]` |
| `block` | Reject the message entirely |

> **Warning:** Guardrail patterns use standard regex syntax. Escape special characters (e.g., `\\s` for whitespace in YAML).

---

## Response Caching

Caching stores LLM responses locally so identical prompts return instantly without an API call.

```yaml
# Agent-level caching
cache:
  enabled: true       # Enable response caching (default: false)
  ttl: 3600           # Time-to-live in seconds (default: 3600)
  force: true          # Force cache refresh on next call (optional)
```

Cache can also be set at the project level in `crystral.config.yaml`:

```yaml
version: 1
project: my-project
cache:
  enabled: true
  ttl: 7200
```

Agent-level settings override project-level settings. Cached responses are stored in `.crystral/agents.db`.

> **Tip:** Set `force: true` temporarily when you change system prompts. Remove it once you are satisfied with the new prompt.

---

## Custom Embedding Models and Vector Stores

When using vector stores (RAG), specify which provider, model, and database to use:

```yaml
rag:
  provider: pinecone
  match_count: 5
  match_threshold: 0.7
  embedding_provider: openai
  embedding_model: text-embedding-3-large
  connection:
    host: https://my-index.svc.pinecone.io
    api_key_env: PINECONE_API_KEY
    namespace: product-docs
```

### Supported Vector Store Providers

| Provider | Connection Fields |
|----------|-------------------|
| `pinecone` | `host`, `api_key_env`, `namespace` |
| `chroma` | `url`, `collection`, `api_key_env` |
| `qdrant` | `url`, `collection`, `api_key_env`, `vector_name` |
| `weaviate` | `url`, `class_name`, `text_key`, `properties`, `api_key_env` |
| `pgvector` | `connection_string_env`, `table`, `content_column`, `embedding_column` |

Both `openai` and `google` providers support embedding endpoints. For Weaviate with its built-in `nearText` vectorizer, `embedding_provider` is optional.

---

## Performance Optimization

### Token and Sampling Controls

```yaml
version: 1
name: concise-agent
provider: openai
model: gpt-4o-mini
max_tokens: 1024          # Cap output tokens (default: 4096, max: 1000000)
temperature: 0.3          # Lower = more focused output
top_p: 0.9                # Nucleus sampling threshold
```

### Tool Timeouts

Prevent agents from hanging on slow external calls:

```yaml
# tools/external-api.yaml
type: rest_api
timeout_ms: 10000          # 10 seconds (default: 30000, range: 100-300000)
```

For agent delegation tools, also limit iterations:

```yaml
# tools/delegate-research.yaml
type: agent
agent_name: researcher
timeout_ms: 120000          # 2 minutes
max_iterations: 10          # Tool loop limit (default: 10)
```

### Workflow Tuning

```yaml
orchestrator:
  provider: groq
  model: llama-3.1-8b-instant
  strategy: auto             # "auto", "sequential", or "parallel"
  max_iterations: 10
  temperature: 0.5

context:
  shared_memory: true
  max_context_tokens: 4000   # Reduce to save tokens across agents
```

> **Tip:** Use `groq` or `together` with smaller models for orchestrators. They only route tasks -- they do not need the most capable model.

---

## Memory and Session Management

Crystal AI uses SQLite for all local storage. Session history, inference logs, and vector embeddings are stored in `.crystral/agents.db`.

```typescript
import Crystral from '@crystralai/sdk';

const client = new Crystral();
const agent = client.loadAgent('assistant');

// First message creates a new session
const result = await agent.run('Hello!');

// Continue the conversation in the same session
const follow = await agent.run('Tell me more', { sessionId: result.sessionId });

// Clear session history
agent.clearSession();
```

The `.crystral/` directory is added to `.gitignore` by `crystral init`. To reset all data, delete it.

---

## Token Usage and Cost Tracking

Every agent call logs token usage and estimated cost to the `inference_logs` table.

```typescript
const logs = client.getLogs({ limit: 50, agentName: 'support-agent' });

for (const log of logs) {
  console.log(`${log.agent_name} | ${log.model} | ${log.input_tokens}+${log.output_tokens} tokens | $${log.cost_usd.toFixed(5)} | ${log.latency_ms}ms`);
}
```

Every `agent.run()` call returns usage in the response:

```typescript
interface AgentResponse {
  content: string;
  tool_calls_made: number;
  tokens_used: { input: number; output: number };
  cost_usd: number;
  latency_ms: number;
}
```

You can also browse logs visually by running `crystral studio` and navigating to the **Logs** page.

---

## Logging and Debugging

Configurable logging is available at both project and agent level. Agent-level settings override project-level.

```yaml
# crystral.config.yaml or agent YAML
logging:
  level: debug           # "debug", "info", "warn", or "error" (default: "info")
  trace: true            # Add trace IDs to all operations (default: false)
  export: stdout         # "stdout", "file", or "webhook" (default: "stdout")
```

| Level | What is logged |
|-------|----------------|
| `debug` | Full prompts, tool arguments, raw provider responses |
| `info` | Agent runs, tool calls, token usage, latency |
| `warn` | Retries, fallbacks, missing optional configs |
| `error` | Failures, validation errors, provider errors |

### Programmatic Logger

```typescript
import { Logger } from '@crystralai/core';

const logger = Logger.getInstance({ level: 'debug', trace: true, export: 'stdout' });
logger.info('Starting pipeline', { agent: 'support-agent' });
logger.error('Provider failed', { error: err.message });
```

---

## Multimodal Capabilities

Enable image, audio, and other media inputs with the `capabilities` block:

```yaml
capabilities:
  vision: true                     # Enable image input (default: false)
  max_image_size: 4194304          # Max image size in bytes (optional)
  audio_input: false               # Enable audio input (default: false)
  audio_output: false              # Enable audio output (default: false)
  image_generation: false          # Enable image generation (default: false)
  output_modalities: [text]        # Output types (default: ["text"])
```

> **Tip:** Vision is supported by OpenAI (GPT-4o), Anthropic (Claude 3+), and Google (Gemini). Enable it with a single YAML flag.

---

## Environment Profiles

> **Coming Soon:** This feature is planned for a future release.

Profiles define different configurations per environment without duplicating agent files.

```yaml
# crystral.config.yaml
profiles:
  dev:
    default_provider: groq
    default_model: llama-3.1-8b-instant
    cache:
      enabled: true
      ttl: 86400
    logging:
      level: debug

  prod:
    default_provider: openai
    default_model: gpt-4o
    guardrails:
      input:
        pii_action: redact
    logging:
      level: warn
```

The `ProfileConfigSchema` is defined in `packages/core/src/types/config.ts`. Each profile can override `default_provider`, `default_model`, `cache`, `logging`, and `guardrails`.

---

## Testing Agents

> **Coming Soon:** This feature is planned for a future release.

YAML-defined test suites will validate agent behavior without writing test code:

```yaml
# tests/support-agent.test.yaml
version: 1
name: support-agent-tests
agent: support-agent
mock: true

tests:
  - name: returns refund policy
    input: "What is your return policy?"
    expect:
      contains: "30 days"
      max_tokens: 500

  - name: blocks SQL injection
    input: "DROP TABLE users"
    expect:
      not_contains: "SQL"
      guardrail_blocked: true
```

| Field | Type | Description |
|-------|------|-------------|
| `expect.contains` | string | Response must contain this substring |
| `expect.not_contains` | string | Response must not contain this substring |
| `expect.max_tokens` | integer | Response must not exceed this token count |
| `expect.output_schema` | object | Response must validate against this JSON Schema |
| `expect.guardrail_blocked` | boolean | Whether the guardrail should block this input |

The `TestSuiteConfigSchema` is defined in `packages/core/src/types/config.ts`.

---

## Agent Inheritance, Prompt Templates, and Scheduling

> **Coming Soon:** These features are planned for future releases. The Zod schemas are already defined in `packages/core/src/types/config.ts`.

**Agent inheritance** (`extends` field) will let agents inherit from a base config to avoid repeating `provider`, `model`, and shared settings across agents.

**Prompt templates** (`PromptTemplateConfigSchema`) will allow defining reusable, parameterized system prompts as standalone YAML files referenced via `system_prompt.template`. Currently, `system_prompt` supports basic `{variable}` interpolation with runtime variables passed to `agent.run()`.

**Scheduling** (`ScheduleConfigSchema`) will support cron-based agent execution for recurring tasks like daily reports.

---

## Configuration Validation

> **Coming Soon:** A dedicated `crystral validate` command is planned. Currently, validation runs at runtime.

Use strict mode for stricter checks today:

```bash
CRYSTALAI_STRICT=1 crystral run support-agent "test message"
```

In strict mode, warnings become errors: missing tool files, HTTP endpoints, and unknown extension fields all cause failures.
