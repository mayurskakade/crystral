# Server-Side SDK (`@crystralai/sdk`)

The `@crystralai/sdk` package is the primary TypeScript SDK for building AI agent applications on the server. It wraps the `@crystralai/core` engine with a clean, developer-friendly API for loading YAML-configured agents, running queries, streaming responses, orchestrating multi-agent workflows, and retrieving inference logs.

> **Note:** This package requires Node.js and a filesystem. For browser, React Native, or edge environments, use [`@crystralai/client`](./client.md) instead.

---

## Installation

```bash
# npm
npm install @crystralai/sdk

# pnpm
pnpm add @crystralai/sdk

# yarn
yarn add @crystralai/sdk
```

**Requirements:**

- Node.js 18 or later (ESM and CommonJS both supported)
- TypeScript 5+ (peer dependency)
- An `agents/` directory containing at least one agent YAML file
- A provider API key set in the environment or `.env` file

---

## Project Structure

The SDK expects a conventional directory layout rooted at your working directory (or the nearest parent containing `crystral.config.yaml`):

```
my-project/
├── crystral.config.yaml   # Optional project config
├── agents/
│   └── assistant.yaml     # Agent definitions
├── tools/
│   └── search.yaml        # Tool definitions
├── workflows/
│   └── pipeline.yaml      # Workflow definitions
├── prompts/
│   └── support.yaml       # Reusable prompt templates
├── tests/
│   └── assistant-tests.yaml
├── .env                   # OPENAI_API_KEY=sk-...
└── index.ts
```

---

## Quick Start

```typescript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const result = await client.run('assistant', 'What is the capital of France?');
console.log(result.content); // "Paris"
```

**`agents/assistant.yaml`:**

```yaml
version: "1"
name: assistant
provider: openai
model: gpt-4o-mini
system_prompt: You are a helpful assistant.
```

---

## Initialization

### Constructor

```typescript
import { Crystral } from '@crystralai/sdk';

// Default: uses process.cwd() to locate agents/
const client = new Crystral();

// Explicit working directory
const client = new Crystral({ cwd: '/opt/myapp' });
```

### `CrystralOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Working directory for resolving agent YAML, tools, and RAG collections. |

### Singleton shortcut

```typescript
import { crystral } from '@crystralai/sdk';

// Pre-constructed client backed by process.cwd()
const result = await crystral.run('assistant', 'Hello!');
```

---

## Loading and Running Agents

### Load an agent

```typescript
const agent = client.loadAgent('support-bot');
console.log(agent.name);     // "support-bot"
console.log(agent.provider);  // "openai"
console.log(agent.model);     // "gpt-4o"
```

### Run a single query

```typescript
const result = await agent.run('I need help with my order');
console.log(result.content);
console.log(result.sessionId);
console.log(result.usage.total);
```

### One-shot convenience

```typescript
// Load + run in a single call
const result = await client.run('support-bot', 'I need help');
```

---

## RunOptions

Pass options as the second argument to `agent.run()` or third argument to `client.run()`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sessionId` | `string` | auto | Resume an existing session. Omit to create a new one. |
| `variables` | `Record<string, string>` | `{}` | Key/value pairs substituted in tool URL/body templates and prompt templates. |
| `maxToolIterations` | `number` | `10` | Maximum tool-call cycles per run to prevent infinite loops. |
| `stream` | `boolean` | `false` | Deliver tokens via `onToken` as the model generates them. |
| `onToken` | `(token: string) => void` | -- | Streaming callback; called once per token when `stream` is `true`. |
| `onToolCall` | `(name, args) => void` | -- | Called before each tool is executed. |
| `onToolResult` | `(name, result) => void` | -- | Called after each tool finishes. `result.success` is `false` on error. |
| `onAgentDelegation` | `(parent, target, task) => void` | -- | Called when an agent delegates to another agent. |
| `onAgentDelegationResult` | `(parent, target, result, success) => void` | -- | Called when a delegation completes. |
| `profile` | `string` | -- | Environment profile name to apply. Falls back to `CRYSTRAL_PROFILE` env var. |
| `images` | `ImageInput[]` | -- | Legacy multimodal image inputs. |
| `input` | `ContentBlock[]` | -- | Unified multimodal input blocks (audio, image, document). |
| `outputModalities` | `Array<'text' \| 'audio' \| 'image'>` | `['text']` | Requested output modalities. |
| `ttsVoice` | `string` | -- | Override TTS voice (e.g. `'alloy'`, `'nova'`). |

---

## RunResult

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | The agent's final text response. |
| `sessionId` | `string` | Pass to `RunOptions.sessionId` to continue the conversation. |
| `messages` | `Message[]` | Full conversation history including this turn. |
| `toolCalls` | `Array<{name, args, result}>` | Tool invocations made during this run. |
| `ragContext` | `string \| undefined` | RAG context injected into the prompt, if any. |
| `usage.input` | `number` | Prompt tokens consumed. |
| `usage.output` | `number` | Completion tokens generated. |
| `usage.total` | `number` | Sum of input and output tokens. |
| `durationMs` | `number` | Wall-clock time in milliseconds. |
| `parsed` | `unknown \| undefined` | Parsed structured output when agent has `output.format: json`. |
| `cached` | `boolean \| undefined` | `true` when response was served from cache. |
| `traceId` | `string \| undefined` | Trace ID when `logging.trace: true` is configured. |
| `providerUsed` | `{provider, model} \| undefined` | Actual provider/model used (may differ on fallback). |
| `guardrails` | `object \| undefined` | Guardrail results: `inputBlocked`, `outputBlocked`, `piiRedacted`. |
| `media` | `MediaOutput[] \| undefined` | Generated images or audio when multimodal output is requested. |
| `transcript` | `string \| undefined` | Auto-transcribed text from audio input blocks. |

---

## Session Management

Sessions are persisted to a local SQLite database and survive process restarts. Pass `sessionId` from one result into the next call to continue a conversation.

```typescript
const client = new Crystral();

// Turn 1 -- new session created automatically
const r1 = await client.run('support-bot', 'My order arrived damaged.');
console.log('Session:', r1.sessionId);

// Turn 2 -- continue the same session
const r2 = await client.run('support-bot', 'Order #98765', {
  sessionId: r1.sessionId,
});

// Turn 3
const r3 = await client.run('support-bot', 'Yes, proceed with replacement.', {
  sessionId: r1.sessionId,
});
```

### In-memory history

```typescript
const agent = client.loadAgent('support-bot');
await agent.run('Hello');

const history = agent.getHistory();
history.forEach(m => console.log(`[${m.role}] ${m.content}`));

// Reset and start fresh
agent.clearSession();
```

---

## Streaming

Enable token-by-token streaming with the `stream` and `onToken` options:

```typescript
const result = await client.run('assistant', 'Write a short poem about the ocean.', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
  onToolCall: (name, args) => console.error(`\n[tool] ${name}(${JSON.stringify(args)})`),
  onToolResult: (name, res) => console.error(`[tool] ${name} -> ${res.success ? 'ok' : 'error'}`),
});

process.stdout.write('\n');
console.log('Tokens used:', result.usage.total);
```

> **Tip:** Even with streaming enabled, `result.content` contains the complete response once the promise resolves.

---

## Workflows

Workflows orchestrate multiple agents to accomplish complex tasks. Define a workflow in YAML and run it with the SDK.

```typescript
const workflow = client.loadWorkflow('content-pipeline');
const result = await workflow.run('Write an article about renewable energy');

console.log(result.content);
console.log(result.agentResults);  // Per-agent call counts
console.log(result.usage.total);   // Total tokens across all agents
```

### One-shot convenience

```typescript
const result = await client.runWorkflow('content-pipeline', 'Write about AI');
```

### Workflow callbacks

```typescript
const result = await workflow.run('Research quantum computing', {
  onToken: (token) => process.stdout.write(token),
  onAgentDelegation: (parent, target, task) => {
    console.log(`\n[delegation] ${parent} -> ${target}: ${task}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    console.log(`[result] ${target}: ${success ? 'ok' : 'failed'}`);
  },
});
```

### `SDKWorkflowRunResult`

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Final response from the orchestrator. |
| `sessionId` | `string` | Session ID of the orchestrator. |
| `agentResults` | `Array<{name, calls, lastResult?}>` | Per-agent call statistics. |
| `usage` | `{input, output, total}` | Total token usage across all agents. |
| `durationMs` | `number` | Total wall-clock execution time. |

---

## Express.js Integration

```typescript
import express from 'express';
import { Crystral } from '@crystralai/sdk';

const app = express();
const client = new Crystral();

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { agent, message, sessionId } = req.body;
    const result = await client.run(agent, message, { sessionId });

    res.json({
      content: result.content,
      sessionId: result.sessionId,
      usage: result.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  const { agent, message, sessionId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const result = await client.run(agent, message, {
    sessionId,
    stream: true,
    onToken: (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
  });

  res.write(`data: ${JSON.stringify({ done: true, sessionId: result.sessionId })}\n\n`);
  res.end();
});

app.listen(3000);
```

---

## Inference Logs

Every agent run is automatically logged to SQLite. Query logs for monitoring or cost tracking:

```typescript
// All logs
const allLogs = client.getLogs();

// Filter by agent, time window, and count
const recentLogs = client.getLogs({
  agentName: 'support-bot',
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
  limit: 50,
});

recentLogs.forEach(log => {
  console.log(`${log.agentName} | ${log.durationMs}ms | ${log.usage?.totalTokens} tokens`);
});
```

### `GetLogsFilter`

| Field | Type | Description |
|-------|------|-------------|
| `agentName` | `string` | Restrict results to a specific agent. |
| `limit` | `number` | Maximum entries to return (newest first). |
| `since` | `Date` | Only return logs recorded after this timestamp. |

---

## Validation, Testing, and Dry Run

```typescript
// Validate all YAML files in the project
const validation = client.validate();
console.log(`${validation.valid} valid, ${validation.errors} errors`);

// Run a test suite
const testResult = await client.test('my-agent-tests');
console.log(`${testResult.passed}/${testResult.passed + testResult.failed} tests passed`);

// Load a prompt template
const template = client.loadPrompt('customer-support');

// Dry run (resolve config without making LLM calls)
const agent = client.loadAgent('assistant');
const dryResult = agent.dryRun();
console.log(dryResult.resolvedSystemPrompt);
```

---

## Error Handling

All SDK errors extend `CrystralError` and carry a machine-readable `code` property.

```typescript
import {
  CrystralError,
  AgentNotFoundError,
  CredentialNotFoundError,
  ProviderError,
  RateLimitError,
  ToolExecutionError,
  ValidationError,
  CircularDelegationError,
  GuardrailError,
} from '@crystralai/sdk';

try {
  const result = await client.run('my-agent', 'Hello');
} catch (err) {
  if (err instanceof AgentNotFoundError) {
    console.error('Agent YAML not found. Check your agents/ directory.');
  } else if (err instanceof CredentialNotFoundError) {
    console.error(`Missing API key. Set ${err.envVarName} in your environment.`);
  } else if (err instanceof RateLimitError) {
    const wait = err.retryAfterMs ?? 5000;
    console.warn(`Rate limited. Retry after ${wait}ms.`);
  } else if (err instanceof ProviderError) {
    console.error(`LLM provider error [${err.code}]: ${err.message}`);
  } else if (err instanceof ToolExecutionError) {
    console.error(`Tool "${err.toolName}" failed: ${err.message}`);
  } else if (err instanceof CircularDelegationError) {
    console.error(`Circular delegation: ${err.callStack.join(' -> ')}`);
  } else if (err instanceof GuardrailError) {
    console.error(`Guardrail (${err.guardrailType}): ${err.message}`);
  } else if (err instanceof ValidationError) {
    console.error(`YAML invalid: ${err.message}`);
  } else if (err instanceof CrystralError) {
    console.error(`Crystral error [${err.code}]: ${err.message}`);
  } else {
    throw err;
  }
}
```

---

## Full API Reference

### `Crystral` Client

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `new Crystral(options?: CrystralOptions)` | Create a client. `options.cwd` defaults to `process.cwd()`. |
| `loadAgent` | `(name: string) => Agent` | Load an agent by name from `agents/<name>.yaml`. |
| `run` | `(name: string, message: string, options?: RunOptions) => Promise<RunResult>` | One-shot: load agent and run in a single call. |
| `loadWorkflow` | `(name: string) => Workflow` | Load a workflow by name from `workflows/<name>.yaml`. |
| `runWorkflow` | `(name: string, task: string, options?: SDKWorkflowRunOptions) => Promise<SDKWorkflowRunResult>` | One-shot: load workflow and run in a single call. |
| `getLogs` | `(filter?: GetLogsFilter) => InferenceLog[]` | Query persisted inference logs from SQLite. |
| `validate` | `() => ValidationResult` | Validate all YAML config files against their schemas. |
| `test` | `(suiteName: string) => Promise<TestSuiteResult>` | Run a test suite by name from `tests/<name>.yaml`. |
| `loadPrompt` | `(name: string) => PromptTemplateConfig` | Load a prompt template from `prompts/<name>.yaml`. |

### `Agent` Instance

| Member | Signature | Description |
|--------|-----------|-------------|
| `name` | `string` (getter) | Agent name from YAML. |
| `provider` | `string` (getter) | LLM provider (e.g. `"openai"`). |
| `model` | `string` (getter) | Model identifier (e.g. `"gpt-4o"`). |
| `run` | `(message: string, options?: RunOptions) => Promise<RunResult>` | Send a message, get a response. |
| `getHistory` | `() => Message[]` | In-memory conversation history. |
| `clearSession` | `() => void` | Reset in-memory history and start a new session. |
| `dryRun` | `() => DryRunResult` | Resolve config without making LLM calls. |

### `Workflow` Instance

| Member | Signature | Description |
|--------|-----------|-------------|
| `name` | `string` (getter) | Workflow name. |
| `description` | `string \| undefined` (getter) | Workflow description. |
| `strategy` | `string` (getter) | Orchestrator strategy (`auto`, `sequential`, `parallel`). |
| `agents` | `Array<{name, agent, description}>` (getter) | Agent references in this workflow. |
| `run` | `(task: string, options?: SDKWorkflowRunOptions) => Promise<SDKWorkflowRunResult>` | Run the workflow. |

---

## Supported Providers

| Provider | Value | Default Model | Environment Variable |
|----------|-------|---------------|----------------------|
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| Groq | `groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Google | `google` | `gemini-1.5-pro` | `GOOGLE_API_KEY` |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |

Custom providers can be registered at runtime:

```typescript
import { registerProvider, unregisterProvider, listProviders } from '@crystralai/sdk';
```

---

## TypeScript Types

All types are exported from the package entry point. Key types include:

```typescript
import type {
  // Config types
  AgentConfig,
  ToolConfig,
  WorkflowConfig,
  MCPServerConfig,
  RAGConfig,
  OutputConfig,
  RetryConfig,
  GuardrailsConfig,
  CacheConfig,
  LoggingConfig,
  PromptTemplateConfig,

  // Runtime types
  Message,
  Session,
  ToolCall,
  InferenceLog,
  ImageInput,
  ContentBlock,
  MediaOutput,
  Provider,

  // Result types
  ValidationResult,
  TestSuiteResult,
  DryRunResult,
} from '@crystralai/sdk';
```
