# @crystralai/sdk

[![npm version](https://img.shields.io/npm/v/@crystralai/sdk?style=flat-square)](https://www.npmjs.com/package/@crystralai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js: ≥18](https://img.shields.io/badge/Node.js-%E2%89%A518-brightgreen?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-blue?style=flat-square)](https://www.typescriptlang.org)

**TypeScript SDK for [Crystral](https://github.com/mayurskakade/crystral)** — a local-first AI agent framework that lets you define agents in YAML, connect them to any LLM provider, equip them with tools, and chat with them in code.

**Key differentiators:**
- **File-based agents** — define agents in YAML, not code
- **Provider-agnostic** — OpenAI, Anthropic, Groq, Google, Together AI out of the box
- **Persistent sessions** — SQLite-backed multi-turn conversations that survive restarts
- **Built-in RAG** — attach a document collection to any agent with two YAML fields
- **Multi-agent workflows** — orchestrate multiple agents with YAML-defined workflows
- **Agent delegation** — agents can call other agents as tools
- **MCP client** — connect agents to MCP servers for dynamic tool discovery
- **Full TypeScript** — comprehensive types and TSDoc on every export

---

## Table of Contents

1. [Installation](#installation)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Core Concepts](#core-concepts)
5. [API Reference](#api-reference)
6. [RunOptions](#runoptions)
7. [RunResult](#runresult)
8. [Sessions](#sessions)
9. [Streaming](#streaming)
10. [Workflows](#workflows)
11. [Agent Delegation](#agent-delegation)
12. [Inference Logs](#inference-logs)
13. [Supported Providers](#supported-providers)
14. [Error Handling](#error-handling)
15. [Agent YAML Reference](#agent-yaml-reference)
16. [Guides](#guides)
17. [License](#license)

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

---

## Prerequisites

- **Node.js 18+** (ESM and CommonJS both supported)
- An `agents/` directory in your project root containing agent YAML files
- At least one provider API key (see [Supported Providers](#supported-providers))

```
my-project/
├── agents/
│   └── assistant.yaml   ← your agent definition
├── .env                 ← OPENAI_API_KEY=sk-...
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

## Core Concepts

Crystral follows a simple layered model:

```
Crystral (client)
  ├── loadAgent(name) → Agent (instance)
  │     └── run(message, options) → RunResult
  └── loadWorkflow(name) → Workflow (instance)
        └── run(task, options) → SDKWorkflowRunResult
```

1. **`Crystral`** — the client; reads config from disk, manages the SQLite store
2. **`Agent`** — a configured agent loaded from YAML; holds conversation state in memory
3. **`Workflow`** — a multi-agent workflow loaded from YAML; orchestrates multiple agents
4. **`RunResult`** — the structured response from a single turn, including session ID, token usage, tool calls, and RAG context

---

## API Reference

### `Crystral` Client

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `new Crystral(options?: CrystralOptions)` | Create a client. `options.cwd` defaults to `process.cwd()`. |
| `loadAgent` | `(name: string) → Agent` | Load an agent by name from `agents/<name>.yaml`. |
| `run` | `(name: string, message: string, options?: RunOptions) → Promise<RunResult>` | One-shot: load agent and run in a single call. |
| `loadWorkflow` | `(name: string) → Workflow` | Load a workflow by name from `workflows/<name>.yaml`. |
| `runWorkflow` | `(name: string, task: string, options?: SDKWorkflowRunOptions) → Promise<SDKWorkflowRunResult>` | One-shot: load workflow and run in a single call. |
| `getLogs` | `(filter?: GetLogsFilter) → InferenceLog[]` | Query persisted inference logs from SQLite. |

### `Agent` Instance

| Member | Signature | Description |
|--------|-----------|-------------|
| `name` | `string` (getter) | Agent name from YAML. |
| `provider` | `string` (getter) | LLM provider (e.g. `"openai"`). |
| `model` | `string` (getter) | Model identifier (e.g. `"gpt-4o"`). |
| `run` | `(message: string, options?: RunOptions) → Promise<RunResult>` | Send a message, get a response. |
| `getHistory` | `() → Message[]` | In-memory conversation history for this agent. |
| `clearSession` | `() → void` | Reset in-memory history and start a new session. |

---

## RunOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sessionId` | `string` | auto | Resume an existing session. Omit to start a new one. |
| `variables` | `Record<string, string>` | `{}` | Key/value pairs substituted in tool URL/body templates. |
| `maxToolIterations` | `number` | `10` | Maximum tool-call cycles per run to prevent infinite loops. |
| `stream` | `boolean` | `false` | Deliver tokens via `onToken` as the model generates them. |
| `onToken` | `(token: string) → void` | — | Streaming callback; called once per token when `stream: true`. |
| `onToolCall` | `(name, args) → void` | — | Called before each tool is executed. |
| `onToolResult` | `(name, result) → void` | — | Called after each tool finishes. `result.success` is `false` on error. |
| `onAgentDelegation` | `(parent, target, task) → void` | — | Called when an agent delegates to another agent. |
| `onAgentDelegationResult` | `(parent, target, result, success) → void` | — | Called when a delegation completes. |

---

## RunResult

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | The agent's final text response. |
| `sessionId` | `string` | Pass to `RunOptions.sessionId` to continue the conversation. |
| `messages` | `Message[]` | Full conversation history including this turn. |
| `toolCalls` | `Array<{name, args, result}>` | Tool invocations made during this run. |
| `ragContext` | `string \| undefined` | RAG context injected into the prompt (if any). |
| `usage.input` | `number` | Prompt tokens consumed. |
| `usage.output` | `number` | Completion tokens generated. |
| `usage.total` | `number` | Sum of input and output tokens. |
| `durationMs` | `number` | Total wall-clock time for this run in milliseconds. |

---

## Sessions

Sessions are persisted to a local SQLite database and survive process restarts.
Pass `sessionId` from one result into the next call to continue the conversation.

```typescript
const client = new Crystral();

// Turn 1 — new session created automatically
const r1 = await client.run('support-bot', 'My order arrived damaged.');
console.log('Session:', r1.sessionId);

// Turn 2 — continue the same session
const r2 = await client.run('support-bot', 'Order #98765', {
  sessionId: r1.sessionId,
});

// Turn 3
const r3 = await client.run('support-bot', 'Yes, please proceed with the replacement.', {
  sessionId: r1.sessionId,
});
```

See [docs/guides/sessions.md](docs/guides/sessions.md) for the full guide.

---

## Streaming

Enable token-by-token streaming with `stream: true` and the `onToken` callback:

```typescript
const result = await client.run('assistant', 'Write a short poem about the ocean.', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
  onToolCall: (name, args) => console.error(`\n[tool] ${name}(${JSON.stringify(args)})`),
  onToolResult: (name, res) => console.error(`[tool] ${name} → ${res.success ? 'ok' : 'error'}`),
});

process.stdout.write('\n');
console.log('Tokens used:', result.usage.total);
```

See [docs/guides/streaming.md](docs/guides/streaming.md) for details.

---

## Workflows

Workflows orchestrate multiple agents to accomplish complex tasks. Define a workflow in YAML and run it with the SDK:

```typescript
const client = new Crystral();

// Load and run a workflow
const workflow = client.loadWorkflow('content-pipeline');
const result = await workflow.run('Write an article about renewable energy');

console.log(result.content);        // Final synthesized output
console.log(result.agentResults);   // Per-agent call counts
console.log(result.usage.total);    // Total tokens across all agents
console.log(result.durationMs);     // Total execution time
```

### One-shot convenience

```typescript
const result = await client.runWorkflow('content-pipeline', 'Write about AI');
```

### Workflow callbacks

Monitor agent delegation in real time:

```typescript
const result = await workflow.run('Research and write about quantum computing', {
  onToken: (token) => process.stdout.write(token),
  onAgentDelegation: (parent, target, task) => {
    console.log(`\n[delegation] ${parent} → ${target}: ${task}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    console.log(`[result] ${target}: ${success ? 'ok' : 'failed'}`);
  },
});
```

### Workflow YAML

```yaml
# workflows/content-pipeline.yaml
version: 1
name: content-pipeline
description: Research, analyze, and produce content

orchestrator:
  provider: openai
  model: gpt-4o
  system_prompt: |
    You orchestrate content production.
  strategy: auto
  max_iterations: 20
  temperature: 0.7

agents:
  - name: researcher
    agent: research-agent
    description: Gathers information from the web
  - name: writer
    agent: writing-agent
    description: Writes polished final content

context:
  shared_memory: true
  max_context_tokens: 8000
```

### `SDKWorkflowRunResult`

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Final response from the orchestrator. |
| `sessionId` | `string` | Session ID of the orchestrator. |
| `agentResults` | `Array<{name, calls, lastResult?}>` | Per-agent call statistics. |
| `usage.input` | `number` | Total input tokens across all agents. |
| `usage.output` | `number` | Total output tokens across all agents. |
| `usage.total` | `number` | Sum of input and output. |
| `durationMs` | `number` | Total wall-clock execution time. |

---

## Agent Delegation

Agents can delegate tasks to other agents using the `agent` tool type. The LLM sees delegations as regular tool calls — it decides when to delegate based on the tool description.

### Agent tool YAML

```yaml
# tools/delegate-research.yaml
version: 1
name: delegate-research
description: Delegates research tasks to the research specialist
type: agent
agent_name: researcher
pass_context: true
timeout_ms: 120000
max_iterations: 10
parameters:
  - name: task
    type: string
    required: true
    description: The research task to perform
```

### Monitoring delegations

```typescript
const result = await client.run('orchestrator', 'Analyze this dataset', {
  onAgentDelegation: (parent, target, task) => {
    console.log(`${parent} delegating to ${target}: ${task}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    console.log(`${target} returned (${success ? 'success' : 'failure'})`);
  },
});
```

### Circular delegation protection

CrystalAI tracks the agent call stack and throws `CircularDelegationError` if a delegation would create a cycle (e.g. A → B → A):

```typescript
import { CircularDelegationError } from '@crystralai/sdk';

try {
  await client.run('agent-a', 'Do something');
} catch (err) {
  if (err instanceof CircularDelegationError) {
    console.error(`Circular call: ${err.callStack.join(' → ')}`);
  }
}
```

---

## Inference Logs

Every agent run is automatically logged to a local SQLite database.
Retrieve logs with `getLogs()`:

```typescript
// All logs
const allLogs = client.getLogs();

// Filter by agent, time window, and count
const recentLogs = client.getLogs({
  agentName: 'support-bot',
  since: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24 h
  limit: 50,
});

recentLogs.forEach(log => {
  console.log(`${log.agentName} | ${log.durationMs}ms | ${log.usage?.totalTokens} tokens`);
});
```

---

## Supported Providers

| Provider | Value | Default Model | Environment Variable |
|----------|-------|---------------|----------------------|
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| Groq | `groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Google | `google` | `gemini-1.5-pro` | `GOOGLE_API_KEY` |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |

Set the relevant environment variable in your `.env` file or shell:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

See [docs/guides/providers.md](docs/guides/providers.md) for credential resolution order and provider-specific notes.

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
} from '@crystralai/sdk';

try {
  const result = await client.run('my-agent', 'Hello');
} catch (err) {
  if (err instanceof AgentNotFoundError) {
    console.error('Agent YAML not found — check your agents/ directory.');
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
    console.error(`Circular delegation: ${err.callStack.join(' → ')}`);
  } else if (err instanceof ValidationError) {
    console.error(`Agent YAML invalid: ${err.message}`);
  } else if (err instanceof CrystralError) {
    console.error(`Crystral error [${err.code}]: ${err.message}`);
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

See [docs/guides/error-handling.md](docs/guides/error-handling.md) for the full error reference.

---

## Agent YAML Reference

```yaml
version: "1"          # Required. Must be "1".
name: my-agent        # Required. Must match the file name (without .yaml).
provider: openai      # Required. See Supported Providers table above.
model: gpt-4o         # Required. Provider-specific model identifier.

system_prompt: |      # Optional. Sets the agent's persona and instructions.
  You are a helpful assistant.

temperature: 0.7      # Optional. 0.0–2.0. Defaults to provider default.

tools:                # Optional. List of tool names (references tools/*.yaml).
  - search
  - delegate-research  # agent-type tools work the same way

rag:                  # Optional. Attach a RAG collection.
  collection: my-docs
  match_threshold: 0.75
  match_count: 5

mcp:                  # Optional. MCP servers for dynamic tool discovery.
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
  - transport: sse
    name: github
    url: http://localhost:3000/mcp
```

**Full field reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `string` | Yes | Schema version. Always `"1"`. |
| `name` | `string` | Yes | Agent identifier. Must match file name. |
| `provider` | `string` | Yes | LLM provider key (see providers table). |
| `model` | `string` | Yes | Model identifier for the chosen provider. |
| `system_prompt` | `string` | No | Instructions prepended to every conversation. |
| `temperature` | `number` | No | Sampling temperature (0.0–2.0). |
| `tools` | `string[]` | No | Tool names referencing `tools/<name>.yaml` (rest_api, javascript, web_search, agent). |
| `rag.collection` | `string` | No | Name of the RAG collection directory under `rag/`. |
| `rag.match_threshold` | `number` | No | Minimum similarity score (0.0–1.0). Default: `0.7`. |
| `rag.match_count` | `number` | No | Maximum chunks to inject. Default: `5`. |
| `mcp` | `MCPServerConfig[]` | No | MCP servers for dynamic tool discovery (stdio or SSE). |

---

## Guides

Detailed how-to guides are in [`docs/guides/`](docs/guides/):

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/guides/getting-started.md) | Install the SDK, create your first agent, run your first query |
| [Sessions](docs/guides/sessions.md) | Multi-turn conversations, session persistence, forking |
| [Streaming](docs/guides/streaming.md) | Token streaming, tool lifecycle callbacks |
| [Tools](docs/guides/tools.md) | Tool types (rest_api, javascript, web_search, agent), YAML reference |
| [Workflows](docs/guides/workflows.md) | Multi-agent orchestration, workflow YAML, delegation callbacks |
| [RAG](docs/guides/rag.md) | Set up document retrieval for an agent |
| [Error Handling](docs/guides/error-handling.md) | All error classes, codes, and recovery patterns |
| [Providers](docs/guides/providers.md) | Credential setup, embedding providers, provider-specific notes |

The generated **HTML API reference** lives in `docs/api/` (not committed). Regenerate it with:

```bash
pnpm run docs
```

---

## License

MIT © [Mayur Kakade](https://github.com/mayurskakade)
