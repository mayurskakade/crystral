# Crystral

[![npm version](https://img.shields.io/npm/v/@crystralai/core?style=flat-square&label=%40crystralai%2Fcore)](https://www.npmjs.com/package/@crystralai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js: >=18](https://img.shields.io/badge/Node.js-%E2%89%A518-brightgreen?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-blue?style=flat-square)](https://www.typescriptlang.org)

**Local-first AI agent framework for developers.**

Define agents as YAML files, version-control them, run them in the terminal, and inspect them in a local dashboard. API keys stay on your machine, inference calls go directly to providers, and nothing is stored in the cloud. Think of it as Prisma for AI agents.

---

## Architecture

```
                          crystral.config.yaml
                                  |
                                  v
                    +----------------------------+
                    |        Core Engine          |
                    |  (config, credentials, DB)  |
                    +----------------------------+
                       /     |       |       \
                      v      v       v        v
                 +------+ +-----+ +-----+ +----------+
                 |Agents| |Tools| | RAG | |Workflows |
                 +------+ +-----+ +-----+ +----------+
                      \      |       |        /
                       v     v       v       v
                    +----------------------------+
                    |       LLM Providers         |
                    | OpenAI  Anthropic  Groq     |
                    | Google  Together AI         |
                    +----------------------------+
                                  |
                                  v
                    +----------------------------+
                    |      Local Storage          |
                    |   SQLite + sqlite-vec       |
                    | (sessions, logs, vectors)   |
                    +----------------------------+
```

---

## Features

| Category | Capability | Description |
|----------|-----------|-------------|
| **Agents** | YAML-defined | Define agents as version-controllable config files |
| **Agents** | System prompts | Multiline prompts with `{variable}` template support |
| **Agents** | Multi-turn sessions | SQLite-backed conversations that survive restarts |
| **Providers** | 5 built-in | OpenAI, Anthropic, Groq, Google, Together AI |
| **Providers** | OpenAI-compatible | Point any agent at a custom base URL (Ollama, vLLM, LM Studio) |
| **Tools** | REST API | Call any HTTP endpoint with auth, path params, and response extraction |
| **Tools** | JavaScript | Run sandboxed JS functions with timeout protection |
| **Tools** | Web Search | Brave Search integration for real-time web results |
| **Tools** | Agent delegation | Agents can call other agents as tools |
| **RAG** | Document retrieval | Chunk, embed, and search local documents (md, txt, pdf, html) |
| **RAG** | Vector search | sqlite-vec for fast local vector similarity search |
| **Workflows** | Multi-agent | Orchestrate specialist agents with a single YAML file |
| **Workflows** | LLM-driven | No explicit graphs -- the orchestrator LLM decides task routing |
| **MCP** | Client support | Connect to MCP servers via stdio or SSE for dynamic tool discovery |
| **Storage** | Fully local | SQLite for chat history, inference logs, and vector embeddings |
| **Studio** | Dashboard | React-based local dashboard at `localhost:4000` |

---

## Quick Start

### 1. Install

```bash
npm install @crystralai/core
```

### 2. Create project structure

```
my-project/
├── crystral.config.yaml
├── agents/
│   └── assistant.yaml
├── tools/
└── .env
```

**`crystral.config.yaml`:**

```yaml
version: 1
project: my-project
```

**`agents/assistant.yaml`:**

```yaml
version: 1
name: assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful assistant. Be concise and accurate.
temperature: 0.7
max_tokens: 4096
```

**`.env`:**

```bash
OPENAI_API_KEY=sk-your-key-here
```

### 3. Run with the SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const result = await client.run('assistant', 'What is the capital of France?');
console.log(result.content); // "Paris"
```

---

## Agent Definition

```yaml
# agents/support-agent.yaml
version: 1
name: support-agent
description: Customer support agent
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful support agent for {company_name}.
temperature: 0.3
max_tokens: 2048
tools:
  - get-ticket
  - send-email
rag:
  collections:
    - product-docs
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_threshold: 0.75
  match_count: 5
```

## Tool Definition

```yaml
# tools/get-ticket.yaml
version: 1
name: get-ticket
description: Fetch a support ticket by ID
type: rest_api
endpoint: https://api.example.com/tickets/{ticket_id}
method: GET
auth:
  type: bearer
  token_env: SUPPORT_API_KEY
parameters:
  - name: ticket_id
    type: string
    required: true
    description: The ticket ID to fetch
```

## Workflow Definition

```yaml
# workflows/content-pipeline.yaml
version: 1
name: content-pipeline
description: Research, analyze, and produce content

orchestrator:
  provider: openai
  model: gpt-4o
  system_prompt: |
    You orchestrate content production. Delegate tasks
    to specialist agents and synthesize their outputs.
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

---

## TypeScript SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();

// Single-shot
const result = await client.run('support-agent', 'Hello!');

// Streaming
const result2 = await client.run('support-agent', 'Hello!', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});

// Sessions (persistent history)
const r1 = await client.run('support-agent', 'First message');
const r2 = await client.run('support-agent', 'Follow-up', {
  sessionId: r1.sessionId,
});

// Workflows
const workflow = client.loadWorkflow('content-pipeline');
const result3 = await workflow.run('Write an article about AI');
console.log(result3.content);
console.log(result3.agentResults);
```

## Browser / Edge Client

For frontend applications, React Native, or edge runtimes, use `@crystralai/client` -- a zero-dependency package that works anywhere `fetch` does:

```typescript
import { CrystralClient } from '@crystralai/client';

const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: userProvidedKey,
  systemPrompt: 'You are a helpful assistant.',
});

const result = await client.run('What is the capital of France?');
```

---

## Supported Providers

| Provider | Chat | Embeddings | Environment Variable |
|----------|------|------------|----------------------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | text-embedding-3-small/large | `OPENAI_API_KEY` |
| Anthropic | claude-opus-4, claude-sonnet-4, claude-haiku | -- | `ANTHROPIC_API_KEY` |
| Groq | llama-3, mixtral, gemma | -- | `GROQ_API_KEY` |
| Google | gemini-1.5-pro, gemini-1.5-flash | text-embedding-004 | `GOOGLE_API_KEY` |
| Together AI | llama-3, mistral, qwen | -- | `TOGETHER_API_KEY` |

---

## MCP Servers

Agents can connect to [Model Context Protocol](https://modelcontextprotocol.io/) servers for dynamic tool discovery:

```yaml
# agents/dev-assistant.yaml
version: 1
name: dev-assistant
provider: anthropic
model: claude-sonnet-4-20250514
tools:
  - web-search
mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
  - transport: sse
    name: github
    url: http://localhost:3000/mcp
```

MCP tools are automatically discovered at runtime and prefixed with `mcp_{server}_{tool}`.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, first agent, first run |
| [Configuration](docs/configuration.md) | Project config, file discovery, credentials, directory conventions |
| [Agents](docs/agents.md) | Full agent YAML specification, all fields, examples |
| [Tools](docs/tools.md) | REST API, JavaScript, web search, and agent tool types |
| [Workflows](docs/workflows.md) | Multi-agent orchestration and strategies |
| [RAG](docs/rag.md) | Collections, document indexing, vector search |
| [MCP](docs/mcp.md) | MCP client, stdio/SSE transports, tool discovery |
| [Providers](docs/providers.md) | LLM providers, credentials, model selection |
| [SDK](docs/sdk.md) | Server-side TypeScript SDK (`@crystralai/sdk`) |
| [Client](docs/client.md) | Browser SDK with BYOK, zero dependencies |
| [Studio](docs/studio.md) | Local React dashboard for testing and inspection |
| [CLI Reference](docs/cli-reference.md) | All CLI commands and flags |
| [Examples](docs/examples.md) | Walkthroughs for react-chat, code-review, ad-generator |
| [Advanced](docs/advanced.md) | Structured output, retry, guardrails, caching |

| [Tutorials](docs/tutorials.md) | Video curriculum: 19 guided tutorials across 4 tracks |

**Technical references:** [Architecture](ARCHITECTURE.md) | [Config Specification](CONFIG_SPEC.md)

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@crystralai/core`](packages/core) | Runtime engine -- providers, storage, agent runner, RAG, tools | [![npm](https://img.shields.io/npm/v/@crystralai/core?style=flat-square)](https://www.npmjs.com/package/@crystralai/core) |
| [`@crystralai/sdk`](packages/sdk) | TypeScript SDK for server-side applications | [![npm](https://img.shields.io/npm/v/@crystralai/sdk?style=flat-square)](https://www.npmjs.com/package/@crystralai/sdk) |
| [`@crystralai/client`](packages/client) | Universal client for browsers, React Native, and edge runtimes | [![npm](https://img.shields.io/npm/v/@crystralai/client?style=flat-square)](https://www.npmjs.com/package/@crystralai/client) |
| [`@crystralai/studio`](packages/studio) | React dashboard served locally by the CLI | -- |

---

## Monorepo Structure

```
crystral/
├── packages/
│   ├── core/      @crystralai/core    -- runtime engine
│   ├── sdk/       @crystralai/sdk     -- TypeScript SDK
│   ├── client/    @crystralai/client   -- universal browser/edge client
│   └── studio/    @crystralai/studio  -- React dashboard
├── docs/                              -- documentation
├── ARCHITECTURE.md                    -- technical deep-dive
└── CONFIG_SPEC.md                     -- YAML schema specification
```

---

## Credentials Priority

API keys are resolved in this order (highest priority first):

1. **Environment variable** -- e.g. `OPENAI_API_KEY` already set in the process
2. **Project `.env` file** -- `<project-root>/.env`
3. **Global credentials** -- `~/.crystalai/credentials`

```bash
# These are all equivalent:
export OPENAI_API_KEY=sk-...
echo "OPENAI_API_KEY=sk-..." >> .env
```

---

## Roadmap

- [x] Agent-to-agent delegation -- agents can call other agents as tools
- [x] Multi-agent workflows -- YAML-defined orchestration with specialist agents
- [x] MCP client -- dynamic tool discovery from MCP servers (stdio + SSE)
- [x] Universal browser client -- `@crystralai/client` with zero dependencies
- [x] Multimodal support -- vision inputs for compatible models
- [ ] MCP server mode -- expose agents via MCP to Cursor/Claude Desktop
- [ ] Web UI agent builder
- [ ] Docker image

---

## License

MIT
