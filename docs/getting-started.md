# Getting Started

This guide walks you through installing Crystral, creating your first AI agent, running it, and adding tools. By the end, you will have a working agent that can answer questions and call external APIs.

---

## Prerequisites

Before you begin, make sure you have the following:

- **Node.js 18 or later** -- Crystral uses ESM modules and requires Node.js 18+. Check your version with `node --version`.
- **npm, pnpm, or yarn** -- any package manager works. This guide uses npm in examples.
- **An LLM provider API key** -- you need at least one key from a supported provider (OpenAI, Anthropic, Groq, Google, or Together AI).

> **Tip:** If you do not have an API key yet, OpenAI and Groq both offer free-tier access that works well for getting started.

---

## Installation

Install the SDK package in your project:

```bash
# npm
npm install @crystralai/sdk

# pnpm
pnpm add @crystralai/sdk

# yarn
yarn add @crystralai/sdk
```

The `@crystralai/sdk` package depends on `@crystralai/core`, which includes the runtime engine, LLM providers, SQLite storage, and all tool executors. Both packages are installed automatically.

> **Note:** If you are building a browser or React Native application, use `@crystralai/client` instead. See the [client package README](../packages/client/README.md) for details.

---

## Project Structure

Crystral uses a file-based convention. Create the following directory structure in your project root:

```
my-project/
├── crystral.config.yaml       # project configuration (required)
├── agents/                    # agent YAML definitions
│   └── assistant.yaml
├── tools/                     # tool YAML definitions (optional)
├── workflows/                 # workflow YAML definitions (optional)
├── rag/                       # RAG document collections (optional)
│   └── my-docs/
│       └── guide.md
├── .crystalai/                # auto-generated local state (add to .gitignore)
│   ├── agents.db              # SQLite database for sessions, logs, vectors
│   └── rag/
│       └── my-docs.index      # vector index files
├── .env                       # project-level API keys
└── .gitignore
```

### Create the project config

Every Crystral project requires a `crystral.config.yaml` file at its root. This is how the SDK locates your project:

```yaml
version: 1
project: my-project
```

The `version` field is required and must be `1`. The `project` field is a human-readable label used in Studio and logs. It must contain only letters, numbers, hyphens, and underscores.

### Create the directories

```bash
mkdir -p agents tools workflows rag
```

### Set up your API key

Create a `.env` file in your project root:

```bash
OPENAI_API_KEY=sk-your-key-here
```

Crystral resolves API keys in this order:

1. Environment variables already set in the process
2. Project `.env` file
3. Global credentials file at `~/.crystalai/credentials`

You can use whichever method you prefer. For local development, the `.env` file is the simplest option.

> **Warning:** Never commit your `.env` file to version control. Add it to your `.gitignore`.

### Update .gitignore

Add the following entries to your `.gitignore`:

```
.crystalai/
.env
```

The `.crystalai/` directory contains the SQLite database and vector indexes. These are generated locally and should not be committed.

---

## Creating Your First Agent

Create a file at `agents/assistant.yaml` with the following content:

```yaml
version: 1
name: assistant
description: A helpful general-purpose assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful assistant. Answer questions clearly and concisely.
  If you are unsure about something, say so honestly.
temperature: 0.7
max_tokens: 4096
```

Here is what each field does:

| Field | Purpose |
|-------|---------|
| `version` | Schema version. Always `1` for now. Required in every config file. |
| `name` | Agent identifier. Must match the filename without the `.yaml` extension. |
| `description` | Human-readable description. Optional but recommended for documentation. |
| `provider` | Which LLM provider to use. Valid values: `openai`, `anthropic`, `groq`, `google`, `together`. |
| `model` | The model identifier passed to the provider API (e.g. `gpt-4o`, `claude-sonnet-4-20250514`, `llama-3.3-70b-versatile`). |
| `system_prompt` | Instructions prepended to every conversation. Use the YAML `\|` block scalar for multiline text. Supports `{variable}` template syntax. |
| `temperature` | Controls response randomness. Range: `0.0` to `2.0`. Lower values are more deterministic. Default: `1.0`. |
| `max_tokens` | Maximum number of tokens in the response. Range: `1` to `1000000`. Default: `4096`. |

> **Tip:** The `name` field must exactly match the filename. An agent at `agents/assistant.yaml` must have `name: assistant`. A mismatch causes a validation error.

---

## Running the Agent

Create a file called `index.ts` (or `index.js`) in your project root:

```typescript
import { Crystral } from '@crystralai/sdk';

async function main() {
  const client = new Crystral();

  // Single-shot: send a message and get a response
  const result = await client.run('assistant', 'What is the capital of France?');

  console.log(result.content);
  console.log(`Tokens used: ${result.usage.total}`);
  console.log(`Duration: ${result.durationMs}ms`);
}

main();
```

Run it:

```bash
npx tsx index.ts
```

You should see output like:

```
The capital of France is Paris.
Tokens used: 42
Duration: 823ms
```

### Multi-turn conversations

Crystral automatically persists conversation history in a local SQLite database. Pass the `sessionId` from one response into the next call to continue the conversation:

```typescript
const r1 = await client.run('assistant', 'My name is Alice.');
console.log(r1.content);

const r2 = await client.run('assistant', 'What is my name?', {
  sessionId: r1.sessionId,
});
console.log(r2.content); // "Your name is Alice."
```

### Streaming

For real-time token output, enable streaming:

```typescript
const result = await client.run('assistant', 'Write a haiku about programming.', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});

process.stdout.write('\n');
```

---

## Adding a Tool

Tools give your agent the ability to take actions -- call APIs, run computations, or search the web. Create a tool definition at `tools/calculate.yaml`:

```yaml
version: 1
name: calculate
description: Evaluate a mathematical expression and return the result
type: javascript
timeout_ms: 5000
parameters:
  - name: expression
    type: string
    required: true
    description: A mathematical expression to evaluate (e.g. "2 + 2", "Math.sqrt(144)")
code: |
  const result = new Function('return ' + args.expression)();
  return { result: Number(result) };
```

Now attach the tool to your agent by adding a `tools` field to `agents/assistant.yaml`:

```yaml
version: 1
name: assistant
description: A helpful general-purpose assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful assistant. Answer questions clearly and concisely.
  If you are unsure about something, say so honestly.
  You have access to a calculator for math questions.
temperature: 0.7
max_tokens: 4096
tools:
  - calculate
```

Run it again:

```typescript
const result = await client.run('assistant', 'What is 847 * 293?', {
  onToolCall: (name, args) => {
    console.log(`[tool call] ${name}(${JSON.stringify(args)})`);
  },
  onToolResult: (name, res) => {
    console.log(`[tool result] ${name} -> ${JSON.stringify(res)}`);
  },
});

console.log(result.content);
```

You should see output like:

```
[tool call] calculate({"expression":"847 * 293"})
[tool result] calculate -> {"result":248171}
847 multiplied by 293 is 248,171.
```

The LLM decides when to use the tool based on the tool description and the user's message. You do not need to write any routing logic.

### REST API tools

For calling external APIs, use the `rest_api` tool type:

```yaml
version: 1
name: get-weather
description: Get the current weather for a city
type: rest_api
endpoint: https://wttr.in/{city}?format=j1
method: GET
response_path: current_condition.0
parameters:
  - name: city
    type: string
    required: true
    description: City name (e.g. "London", "New York")
```

Then add `get-weather` to your agent's `tools` list.

### Tool types

Crystral supports four tool types:

| Type | Description | Use case |
|------|-------------|----------|
| `rest_api` | Call any HTTP endpoint with configurable auth, headers, and response extraction | External APIs, webhooks |
| `javascript` | Run sandboxed JavaScript with timeout protection | Calculations, data transforms, string manipulation |
| `web_search` | Search the web via Brave Search API | Real-time information, current events |
| `agent` | Delegate a task to another agent | Specialist sub-agents, divide-and-conquer workflows |

See the [Configuration Guide](./configuration.md) for the full tool schema reference.

---

## Using Different Providers

Switching providers is a one-line change in your agent YAML. Here are examples for each supported provider:

**Anthropic:**

```yaml
provider: anthropic
model: claude-sonnet-4-20250514
```

**Groq (fast inference):**

```yaml
provider: groq
model: llama-3.3-70b-versatile
```

**Google:**

```yaml
provider: google
model: gemini-1.5-pro
```

**Together AI:**

```yaml
provider: together
model: meta-llama/Llama-3.3-70B-Instruct-Turbo
```

Set the corresponding environment variable in your `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIzaSy...
TOGETHER_API_KEY=...
```

---

## Next Steps

Now that you have a working agent with tools, here are some things to explore:

| Topic | Guide |
|-------|-------|
| Project config, file discovery, credentials | [Configuration](./configuration.md) |
| Full agent YAML specification | [Agents Guide](./agents.md) |
| Tool types: REST, JS, web search, agent | [Tools Guide](./tools.md) |
| Multi-agent orchestration | [Workflows Guide](./workflows.md) |
| Document collections and vector search | [RAG Guide](./rag.md) |
| MCP server integration | [MCP Guide](./mcp.md) |
| LLM providers and model selection | [Providers Guide](./providers.md) |
| Server-side TypeScript SDK | [SDK Guide](./sdk.md) |
| Browser SDK (BYOK) | [Client Guide](./client.md) |
| Local dashboard | [Studio Guide](./studio.md) |
| CLI commands and flags | [CLI Reference](./cli-reference.md) |
| Example projects | [Examples](./examples.md) |
| Structured output, retry, guardrails | [Advanced Guide](./advanced.md) |

### Adding RAG

To give your agent access to a document collection:

1. Create a directory under `rag/` with your documents:

   ```bash
   mkdir -p rag/product-docs
   cp docs/*.md rag/product-docs/
   ```

2. Add the RAG configuration to your agent:

   ```yaml
   rag:
     collections:
       - product-docs
     embedding_provider: openai
     embedding_model: text-embedding-3-small
     match_threshold: 0.7
     match_count: 5
   ```

3. The collection will be indexed automatically on first use.

### Creating a workflow

Workflows let you orchestrate multiple specialist agents. See the [SDK README](../packages/sdk/README.md#workflows) for workflow YAML syntax and SDK usage.

### Connecting MCP servers

Agents can discover tools dynamically from MCP servers. Add an `mcp` section to your agent YAML:

```yaml
mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
```

MCP tools are discovered at runtime and made available to the agent alongside any statically defined tools.
