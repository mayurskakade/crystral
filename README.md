# CrystalAI

**Local-first AI agent framework for developers.**

Define agents as YAML files, version-control them, run them in the terminal, and inspect them in a local dashboard — with zero cloud dependency.

```bash
npm install -g @crystalai/cli

crystalai init
crystalai auth add openai
crystalai create agent support
crystalai run support "Hello!"
crystalai studio               # opens http://localhost:4000
```

---

## What It Is

CrystalAI is a developer tool — closer to Prisma or Drizzle than to a SaaS platform. You define AI agents as plain YAML files, check them into git, and run them anywhere. API keys live on your machine. Inference calls go directly from your machine to AI providers. Nothing is stored in the cloud.

| Feature | Description |
|---------|-------------|
| **YAML agents** | Define agents, tools, and RAG collections as version-controllable config files |
| **Zero cloud** | Direct calls from your machine to OpenAI, Anthropic, Groq, Google, Together AI |
| **Local storage** | SQLite + sqlite-vec for chat history, logs, and vector embeddings |
| **Multi-agent workflows** | Orchestrate multiple agents with YAML-defined workflows |
| **Agent-as-tool** | Agents can delegate tasks to other agents via the `agent` tool type |
| **MCP client** | Connect agents to MCP servers for dynamic tool discovery (stdio + SSE) |
| **CLI** | Interactive REPL, single-shot runs, RAG indexing, credential management |
| **Studio** | React dashboard served locally at `localhost:4000` |
| **TypeScript SDK** | `new Agent('name').run('message')` |
| **Python SDK** | `Agent('name').run('message')` |

---

## Installation

### CLI (global)

```bash
npm install -g @crystalai/cli
# or
pnpm add -g @crystalai/cli
```

### TypeScript SDK (project)

```bash
npm install @crystalai/sdk
```

### Python SDK

```bash
pip install crystalai
```

---

## Quick Start

### 1. Initialize a project

```bash
mkdir my-project && cd my-project
crystalai init
```

Creates:

```
my-project/
├── crystalai.config.yaml
├── agents/
├── tools/
└── rag/
```

### 2. Add your API key

```bash
crystalai auth add openai
# > Enter your OpenAI API key: sk-...
# Saved to ~/.crystalai/credentials
```

### 3. Create and run an agent

```bash
crystalai create agent assistant
# Writes agents/assistant.yaml

crystalai run assistant "What is the capital of France?"
# > Paris is the capital of France.
```

### 4. Open the Studio

```bash
crystalai studio
# Serving CrystalAI Studio at http://localhost:4000
```

---

## Project Layout

```
my-project/
├── crystalai.config.yaml       # project config
├── agents/
│   └── support-agent.yaml      # agent definitions
├── tools/
│   └── get-ticket.yaml         # tool definitions
├── workflows/
│   └── content-pipeline.yaml   # multi-agent workflow definitions
├── rag/
│   └── product-docs/           # source documents (md, txt, pdf)
│       └── api-reference.md
├── .crystalai/                 # gitignore — local state
│   ├── agents.db               # SQLite: chat history, logs
│   └── rag/
│       └── product-docs.index  # sqlite-vec vector index
└── .env                        # project-level API key overrides
```

Global credentials: `~/.crystalai/credentials`

---

## Agent Definition

```yaml
# agents/support-agent.yaml
name: support-agent
description: Customer support agent
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful support agent.
temperature: 0.7
max_tokens: 4096
tools:
  - get-ticket
rag:
  - product-docs
```

## Tool Definition

```yaml
# tools/get-ticket.yaml
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
```

## Agent Tool (Delegation)

Agents can delegate tasks to other agents using the `agent` tool type:

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

## Workflow Definition

Orchestrate multiple agents with a single YAML file:

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
  - name: analyst
    agent: analysis-agent
    description: Analyzes data and extracts insights
  - name: writer
    agent: writing-agent
    description: Writes polished final content

context:
  shared_memory: true
  max_context_tokens: 8000
```

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

## TypeScript SDK

```typescript
import { Crystral } from '@crystral/sdk'

const client = new Crystral()

// Single-shot
const result = await client.run('support-agent', 'Hello!')

// Streaming
const result2 = await client.run('support-agent', 'Hello!', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
})

// Sessions (persistent history)
const r1 = await client.run('support-agent', 'First message')
const r2 = await client.run('support-agent', 'Follow-up', {
  sessionId: r1.sessionId,
})

// Agent delegation callbacks
const r3 = await client.run('orchestrator', 'Analyze this data', {
  onAgentDelegation: (parent, target, task) => {
    console.log(`${parent} → ${target}: ${task}`)
  },
})

// Workflows
const workflow = client.loadWorkflow('content-pipeline')
const result3 = await workflow.run('Write an article about AI')
console.log(result3.content)
console.log(result3.agentResults) // per-agent call stats
```

## Python SDK

```python
from crystalai import Agent, RAGCollection, Tool

# Single-shot
agent = Agent('support-agent')
response = agent.run('Hello!')

# Async
response = await agent.run_async('Hello!')

# Streaming
for chunk in agent.stream('Hello!'):
    print(chunk, end='', flush=True)

# RAG
docs = RAGCollection('product-docs')
docs.index()
results = docs.search('how to reset password')
```

---

## Supported Providers

| Provider | Chat | Embeddings |
|----------|------|------------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | text-embedding-3-small/large |
| Anthropic | claude-opus-4, claude-sonnet-4, claude-haiku | — |
| Groq | llama-3, mixtral, gemma | — |
| Google | gemini-1.5-pro, gemini-1.5-flash | text-embedding-004 |
| Together AI | llama-3, mistral, qwen | — |

---

## CLI Reference

```bash
# Setup
crystalai init                         # scaffold project
crystalai auth add <provider>          # save API key globally
crystalai auth list                    # show configured providers
crystalai auth remove <provider>       # remove a credential

# Create
crystalai create agent <name>          # write agents/<name>.yaml
crystalai create tool <name>           # write tools/<name>.yaml
crystalai create rag <name>            # create rag/<name>/ directory

# Run
crystalai run <agent>                  # interactive REPL
crystalai run <agent> "message"        # single-shot

# RAG
crystalai rag index <collection>       # embed documents
crystalai rag search <collection> <q>  # test semantic search

# Inspect
crystalai list                         # show all agents, tools, collections
crystalai logs                         # recent inference logs
crystalai logs --agent <name>          # filter by agent

# Studio
crystalai studio                       # open dashboard at localhost:4000
crystalai studio --port 3000           # custom port
```

---

## Monorepo Structure

```
crystalai/
├── packages/
│   ├── core/     @crystalai/core   — runtime engine (providers, storage, agent runner, RAG, tools)
│   ├── cli/      @crystalai/cli    — CLI commands + local HTTP server for Studio
│   ├── studio/   @crystalai/studio — React dashboard (served by CLI)
│   └── sdk/      @crystalai/sdk    — public TypeScript SDK
└── python/       crystalai         — Python package + CLI
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for deep technical details.

---

## Credentials Priority

API keys are resolved in this order (highest priority first):

1. `process.env` — environment variable already set (e.g. `OPENAI_API_KEY`)
2. Project `.env` — `<project-root>/.env`
3. Global credentials — `~/.crystalai/credentials`

```bash
# These are all equivalent:
export OPENAI_API_KEY=sk-...
echo "OPENAI_API_KEY=sk-..." >> .env
crystalai auth add openai
```

---

## Roadmap

- [x] Agent-to-agent delegation — agents can call other agents as tools
- [x] Multi-agent workflows — YAML-defined orchestration with specialist agents
- [x] MCP client — dynamic tool discovery from MCP servers (stdio + SSE)
- [ ] MCP server mode (`crystalai mcp`) — expose agents via MCP to Cursor/Claude Desktop
- [ ] Web UI agent builder
- [ ] Docker image
- [ ] npm `create crystalai` scaffolding command

---

## License

MIT
