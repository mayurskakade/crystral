# CrystalAI — Architecture

This document covers the internal design of the CrystalAI monorepo: how packages are structured, how data flows through the system, and the key design decisions made along the way.

---

## Table of Contents

1. [Monorepo Layout](#1-monorepo-layout)
2. [Package Dependency Graph](#2-package-dependency-graph)
3. [Core Package (`@crystalai/core`)](#3-core-package-crystalaicore)
4. [CLI Package (`@crystalai/cli`)](#4-cli-package-crystalaicli)
5. [Studio Package (`@crystalai/studio`)](#5-studio-package-crystalaistudio)
6. [SDK Package (`@crystalai/sdk`)](#6-sdk-package-crystalaisdk)
7. [Python Package (`crystalai`)](#7-python-package-crystalai)
8. [Config Schema & YAML Format](#8-config-schema--yaml-format)
9. [Credential Resolution](#9-credential-resolution)
10. [Agent Execution Flow](#10-agent-execution-flow)
11. [Tool Execution](#11-tool-execution)
12. [Agent Delegation (Agent-as-Tool)](#12-agent-delegation-agent-as-tool)
13. [Workflow Engine](#13-workflow-engine)
14. [MCP Client](#14-mcp-client)
15. [RAG Pipeline](#15-rag-pipeline)
16. [Local Storage (SQLite)](#16-local-storage-sqlite)
17. [Studio REST API](#17-studio-rest-api)
18. [Design Decisions](#18-design-decisions)
19. [Source Porting Map](#19-source-porting-map)

---

## 1. Monorepo Layout

```
crystalai/
├── package.json                   # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json             # shared TS config
├── packages/
│   ├── core/                      # @crystalai/core
│   │   └── src/
│   │       ├── types/             # shared TypeScript interfaces
│   │       ├── config/            # YAML parser + Zod schema validation
│   │       ├── credentials/       # key resolver
│   │       ├── providers/         # OpenAI, Anthropic, Groq, Google, Together AI
│   │       ├── storage/           # SQLite + sqlite-vec adapter
│   │       ├── rag/               # chunker, embedder, indexer, searcher
│   │       ├── tools/             # REST, JS function, web search, agent executors
│   │       ├── agent/             # agent runner (tool loop, RAG injection, streaming)
│   │       ├── workflow/          # multi-agent workflow engine
│   │       └── mcp/              # MCP client (stdio + SSE transports)
│   │
│   ├── cli/                       # @crystalai/cli
│   │   └── src/
│   │       ├── commands/          # init, auth, create, run, rag, studio, list, logs
│   │       └── server/            # Express REST API for Studio
│   │           └── routes/        # /api/agents, /api/tools, /api/rag, /api/sessions, /api/logs
│   │
│   ├── studio/                    # @crystalai/studio (React app)
│   │   └── src/
│   │       ├── pages/             # Chat, Agents, Tools, RAG, Logs
│   │       └── components/        # ChatGPTStyle/* (ported from source)
│   │
│   └── sdk/                       # @crystalai/sdk (public TypeScript API)
│       └── src/
│           └── index.ts           # Agent, Tool, RAGCollection classes
│
└── python/                        # crystalai (Python package)
    ├── crystalai/
    │   ├── agent.py
    │   ├── tool.py
    │   ├── rag.py
    │   └── providers/
    └── pyproject.toml
```

**Build tooling:** `tsup` for all TypeScript packages (tree-shaken ESM + CJS dual output). `pnpm` for dependency management and task running.

---

## 2. Package Dependency Graph

```
@crystalai/sdk
      │
      ▼
@crystalai/core          ← runtime engine (no UI, no HTTP server)
      ▲
      │
@crystalai/cli           ← depends on core for agent execution
      │
      ▼
@crystalai/studio        ← built separately, served as static files by cli/server

crystalai (Python)       ← independent; reimplements core logic in Python
```

`@crystalai/core` has **no dependency** on cli, studio, or sdk. It is the pure runtime engine.

`@crystalai/studio` is a standard Vite React app. It is built to static files and bundled inside `@crystalai/cli`, which serves it via Express.

---

## 3. Core Package (`@crystalai/core`)

### 3.1 Types (`src/types/`)

```typescript
// src/types/config.ts
interface ProjectConfig {
  version: number
  project: string
  studio?: { port: number; open_browser: boolean }
}

interface AgentConfig {
  name: string
  description?: string
  provider: string           // matches ~/.crystalai/credentials key
  model: string
  system_prompt?: string
  temperature?: number
  max_tokens?: number
  tools?: string[]           // references tools/*.yaml by name
  rag?: string[]             // references rag/*/ by name
  mcp?: MCPServerConfig[]    // MCP servers for dynamic tool discovery
}

interface MCPServerConfig {
  name: string
  transport: 'stdio' | 'sse'
  // stdio fields
  command?: string
  args?: string[]
  env?: Record<string, string>
  // sse fields
  url?: string
}

interface ToolConfig {
  name: string
  description: string
  type: 'rest_api' | 'javascript' | 'web_search' | 'agent'
  // rest_api fields
  endpoint?: string
  method?: string
  auth?: { type: 'bearer' | 'basic' | 'header'; token_env?: string }
  parameters?: ToolParameter[]
  // javascript fields
  code?: string
  // agent fields (agent-as-tool delegation)
  agent_name?: string
  pass_context?: boolean
  timeout_ms?: number
  max_iterations?: number
}

interface RAGCollectionConfig {
  name: string
  description?: string
  embedding_provider: string
  embedding_model: string
  chunk_size?: number
  chunk_overlap?: number
}

// src/types/runtime.ts
interface Message {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  tokens_used?: number
  cost_usd?: number
  created_at: string
}

interface Session {
  id: string
  agent_name: string
  title?: string
  created_at: string
}

interface AgentResponse {
  content: string
  tool_calls_made: number
  tokens_used: { input: number; output: number }
  cost_usd: number
  latency_ms: number
}

interface RAGResult {
  chunk_id: string
  content: string
  document_path: string
  similarity: number
}

interface InferenceLog {
  id: string
  session_id?: string
  agent_name: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
  created_at: string
}
```

### 3.2 Config Loader (`src/config/`)

Reads YAML files and validates them with Zod schemas.

```typescript
// src/config/loader.ts
async function loadProjectConfig(cwd?: string): Promise<ProjectConfig>
async function loadAgentConfig(name: string, cwd?: string): Promise<AgentConfig>
async function loadToolConfig(name: string, cwd?: string): Promise<ToolConfig>
async function listAgents(cwd?: string): Promise<string[]>        // scans agents/*.yaml
async function listTools(cwd?: string): Promise<string[]>         // scans tools/*.yaml
async function listRAGCollections(cwd?: string): Promise<string[]> // scans rag/*/
```

File resolution order:
1. `<cwd>/agents/<name>.yaml`
2. `<cwd>/agents/<name>.yml`

Zod schemas enforce all required fields and valid enum values at load time. Validation errors surface friendly messages (e.g. "agents/support.yaml: `provider` is required").

### 3.3 Credential Resolver (`src/credentials/`)

```typescript
// src/credentials/resolver.ts
type Provider = 'openai' | 'anthropic' | 'groq' | 'google' | 'together'

async function resolveApiKey(provider: Provider, cwd?: string): Promise<string>
async function saveGlobalCredential(provider: Provider, key: string): Promise<void>
async function listGlobalCredentials(): Promise<Record<Provider, string>> // masked
async function removeGlobalCredential(provider: Provider): Promise<void>
```

**Resolution priority (first wins):**
1. `process.env.OPENAI_API_KEY` (or provider-specific env var name)
2. `<cwd>/.env` parsed with dotenv
3. `~/.crystalai/credentials` (INI-style file)

```ini
# ~/.crystalai/credentials
[openai]
api_key = sk-...

[anthropic]
api_key = sk-ant-...

[groq]
api_key = gsk_...
```

### 3.4 Provider Clients (`src/providers/`)

All providers implement `ProviderClient`:

```typescript
// src/providers/base.ts
interface CompletionOptions {
  temperature?: number
  max_tokens?: number
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'none' | { name: string }
}

interface CompletionResult {
  content: string
  tool_calls?: ToolCall[]
  input_tokens: number
  output_tokens: number
  finish_reason: 'stop' | 'tool_calls' | 'length'
}

interface ProviderClient {
  complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult>
  stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string>
  embed(text: string, model: string): Promise<number[]>
}
```

Provider implementations:

| File | Provider | Notes |
|------|----------|-------|
| `openai.ts` | OpenAI | Uses official `openai` npm package |
| `anthropic.ts` | Anthropic | Uses `@anthropic-ai/sdk` |
| `groq.ts` | Groq | Uses OpenAI-compatible REST API |
| `google.ts` | Google | Uses Gemini REST API |
| `together.ts` | Together AI | Uses OpenAI-compatible REST API |

A `createProvider(provider: string, apiKey: string): ProviderClient` factory function selects the correct implementation.

### 3.5 SQLite Storage (`src/storage/`)

Uses `better-sqlite3` (synchronous, no event loop overhead) and `sqlite-vec` for vector similarity search.

```typescript
// src/storage/adapter.ts
interface StorageAdapter {
  // Sessions
  createSession(agentName: string, title?: string): Session
  getSession(id: string): Session | null
  listSessions(agentName?: string): Session[]
  deleteSession(id: string): void

  // Messages
  addMessage(sessionId: string, msg: Omit<Message, 'id' | 'created_at'>): Message
  getMessages(sessionId: string): Message[]

  // RAG chunks + embeddings
  storeChunks(collection: string, chunks: Chunk[]): void
  storeEmbedding(chunkId: string, embedding: number[]): void
  searchRAG(collection: string, queryEmbedding: number[], limit: number, threshold?: number): RAGResult[]
  clearCollection(collection: string): void
  getCollectionStats(collection: string): { chunks: number; documents: string[] }

  // Logs
  logInference(log: Omit<InferenceLog, 'id' | 'created_at'>): void
  getLogs(filter?: { agentName?: string; limit?: number; since?: Date }): InferenceLog[]

  close(): void
}
```

**DB file location:** `<project-root>/.crystalai/agents.db`

The database is opened lazily on first access and closed when the process exits. Schema is applied with `CREATE TABLE IF NOT EXISTS` on open, so no migration tooling is needed.

**sqlite-vec usage:** Vector search uses a virtual table `rag_embeddings` backed by sqlite-vec's `vec0` module. Cosine similarity is used for ranking.

### 3.6 Agent Runner (`src/agent/`)

```typescript
// src/agent/runner.ts
interface RunOptions {
  sessionId?: string          // loads history if provided
  variables?: Record<string, string>
  ragThreshold?: number       // default 0.7
  ragMatchCount?: number      // default 5
  cwd?: string
}

async function runAgent(
  agentName: string,
  userMessage: string,
  opts?: RunOptions
): Promise<AgentResponse>

async function* streamAgent(
  agentName: string,
  userMessage: string,
  opts?: RunOptions
): AsyncIterable<string>
```

**Execution flow** (see [Section 10](#10-agent-execution-flow) for full details).

---

## 4. CLI Package (`@crystalai/cli`)

Built with `commander.js`. The package produces a single `crystalai` binary.

### Command Structure

```
packages/cli/src/
├── bin.ts                  # entry point — sets up commander, registers all commands
└── commands/
    ├── init.ts             # crystalai init
    ├── auth.ts             # crystalai auth add/list/remove
    ├── create.ts           # crystalai create agent/tool/rag
    ├── run.ts              # crystalai run <agent> [message]
    ├── rag.ts              # crystalai rag index/search
    ├── studio.ts           # crystalai studio
    ├── list.ts             # crystalai list
    └── logs.ts             # crystalai logs
```

### Studio Server (`src/server/`)

When `crystalai studio` is invoked, an Express 5 server starts and:
1. Serves the static Studio React app (bundled into the CLI package at build time)
2. Exposes a REST + SSE API on the same port

```
packages/cli/src/server/
├── index.ts                # creates Express app, mounts routes, serves static files
└── routes/
    ├── agents.ts           # GET /api/agents, GET/PUT /api/agents/:name, POST /api/agents/:name/run, POST /api/agents/:name/stream
    ├── tools.ts            # GET /api/tools, GET/PUT /api/tools/:name
    ├── rag.ts              # GET /api/rag, POST /api/rag/:name/index, POST /api/rag/:name/search
    ├── sessions.ts         # GET /api/sessions, GET /api/sessions/:id/messages, DELETE /api/sessions/:id
    ├── logs.ts             # GET /api/logs
    └── providers.ts        # GET /api/providers (masked keys)
```

All route handlers call into `@crystalai/core` — the server is a thin HTTP adapter, no business logic lives here.

Streaming agent responses use **Server-Sent Events (SSE)**:
```
POST /api/agents/:name/stream
Response: text/event-stream
  data: {"type":"chunk","content":"Hello"}
  data: {"type":"done","tokens":{"input":10,"output":25},"cost":0.0001}
```

---

## 5. Studio Package (`@crystalai/studio`)

Standard Vite + React 18 + TypeScript + Tailwind CSS app. Built to static files included inside `@crystalai/cli`.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Chat | `/` | Select agent, send messages, stream responses |
| Agents | `/agents` | List agents, edit YAML config via form |
| Tools | `/tools` | List tools, create new tool |
| RAG | `/rag` | List collections, trigger indexing, test search |
| Logs | `/logs` | Browse inference logs with filtering |

### Chat Page — Data Flow

```
User types message
      ↓
POST /api/agents/:name/stream
      ↓
SSE stream → parse chunks → append to message state
      ↓
Message appears token-by-token in ChatMessageList
```

### Reused Components

The following components are ported as-is from `Inference_Provider_V2/src/components/ChatGPTStyle/`:

| Component | Purpose |
|-----------|---------|
| `ChatMessageList.tsx` | Renders message thread with markdown, code highlighting, actions |
| `ChatInput.tsx` | Multi-line input, submit on Enter |
| `ChatSidebarExact.tsx` | Session list sidebar |
| `ChatTopBarExact.tsx` | Agent selector + top bar |
| `ChatDetailsPanel.tsx` | Collapsible details/timeline panel |

**Dependency changes when porting:** Remove the `HorizontalAuditTrail` import (Supabase-bound). The timeline data is replaced with tool call display from the local API response.

---

## 6. SDK Package (`@crystalai/sdk`)

Thin wrapper around `@crystalai/core` that exposes a clean, stable public API. All heavy lifting is in core.

```typescript
// packages/sdk/src/index.ts

export class Crystral {
  constructor(options?: CrystralOptions)
  loadAgent(name: string): Agent
  run(name: string, message: string, options?: RunOptions): Promise<RunResult>
  loadWorkflow(name: string): Workflow
  runWorkflow(name: string, task: string, options?: SDKWorkflowRunOptions): Promise<SDKWorkflowRunResult>
  getLogs(filter?: GetLogsFilter): InferenceLog[]
}

export class Agent {
  readonly name: string
  readonly provider: string
  readonly model: string
  run(message: string, options?: RunOptions): Promise<RunResult>
  getHistory(): Message[]
  clearSession(): void
}

export class Workflow {
  readonly name: string
  readonly description: string | undefined
  readonly strategy: string
  readonly agents: Array<{ name: string; agent: string; description: string }>
  run(task: string, options?: SDKWorkflowRunOptions): Promise<SDKWorkflowRunResult>
}

// Re-exports from @crystralai/core
export type {
  AgentConfig, ToolConfig, AgentToolConfig, MCPServerConfig, WorkflowConfig,
  RAGCollectionConfig, Message, Session, InferenceLog,
  AgentDelegationEvent, AgentDelegationResultEvent,
} from '@crystralai/core'

export {
  CrystralError, AgentNotFoundError, ToolNotFoundError, ToolExecutionError,
  ProviderError, RateLimitError, CredentialNotFoundError, ValidationError,
  CircularDelegationError,
} from '@crystralai/core'
```

---

## 7. Python Package (`crystalai`)

Independent Python reimplementation of the same concepts. Not a binding to the TypeScript core — it calls AI provider APIs directly using `httpx` / provider SDKs.

### Structure

```
python/
├── crystalai/
│   ├── __init__.py           # exports: Agent, Tool, RAGCollection
│   ├── agent.py              # Agent class (sync + async)
│   ├── tool.py               # Tool class
│   ├── rag.py                # RAGCollection class
│   ├── config.py             # YAML loader + Pydantic schemas
│   ├── credentials.py        # key resolver (same priority order)
│   ├── storage.py            # SQLite adapter (sqlite3 + sqlite-vec Python bindings)
│   └── providers/
│       ├── base.py           # ProviderClient ABC
│       ├── openai.py
│       ├── anthropic.py
│       ├── groq.py
│       ├── google.py
│       └── together.py
├── pyproject.toml
└── README.md
```

### CLI Entry Point

The Python package also ships a `crystalai` CLI command (registered via `pyproject.toml` `[project.scripts]`). It mirrors the TypeScript CLI API completely using `click`.

### Async Support

All public methods have both sync and async variants:

```python
# Sync
response = agent.run('Hello!')

# Async (uses asyncio)
response = await agent.run_async('Hello!')

# Streaming (sync generator)
for chunk in agent.stream('Hello!'):
    print(chunk, end='', flush=True)

# Streaming (async generator)
async for chunk in agent.stream_async('Hello!'):
    print(chunk, end='', flush=True)
```

---

## 8. Config Schema & YAML Format

### `crystalai.config.yaml`

```yaml
version: 1
project: my-project
studio:
  port: 4000
  open_browser: true
```

### `agents/<name>.yaml`

```yaml
name: support-agent
description: Customer support agent
provider: openai              # key in ~/.crystalai/credentials
model: gpt-4o
system_prompt: |
  You are a helpful support agent.
temperature: 0.7
max_tokens: 4096
tools:
  - get-ticket                # references tools/get-ticket.yaml
rag:
  - product-docs              # references rag/product-docs/
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_threshold: 0.7
  match_count: 5
```

### `tools/<name>.yaml`

```yaml
name: get-ticket
description: Fetch a support ticket by ID
type: rest_api
endpoint: https://api.example.com/tickets/{ticket_id}
method: GET
auth:
  type: bearer
  token_env: SUPPORT_API_KEY    # resolved from env at runtime
parameters:
  - name: ticket_id
    type: string
    required: true
    description: The ticket ID to fetch
```

**Tool types:**

| Type | Description |
|------|-------------|
| `rest_api` | HTTP call with path/query/body params, auth |
| `javascript` | Inline JS function executed in Node.js vm sandbox |
| `web_search` | Uses Brave Search API (requires `BRAVE_API_KEY`) |
| `agent` | Delegate a task to another agent (see [Section 12](#12-agent-delegation-agent-as-tool)) |

### `tools/<name>.yaml` — Agent Tool (Delegation)

```yaml
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

### `workflows/<name>.yaml`

```yaml
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

### `rag/<name>/` directory

No config file required. CrystalAI discovers and chunks all `.md`, `.txt`, and `.pdf` files in the directory. Optional `rag/<name>/.crystalai-rag.yaml` overrides defaults:

```yaml
embedding_provider: openai
embedding_model: text-embedding-3-small
chunk_size: 512
chunk_overlap: 64
```

---

## 9. Credential Resolution

```
┌─────────────────────────────────────────┐
│  resolveApiKey('openai', cwd)           │
│                                         │
│  1. process.env.OPENAI_API_KEY  ──────► return
│                                         │
│  2. parse <cwd>/.env                    │
│     OPENAI_API_KEY=...  ─────────────► return
│                                         │
│  3. parse ~/.crystalai/credentials      │
│     [openai]                            │
│     api_key = ...  ──────────────────► return
│                                         │
│  4. throw CredentialNotFoundError       │
└─────────────────────────────────────────┘
```

**Provider → env var name mapping:**

| Provider | Env var |
|----------|---------|
| openai | `OPENAI_API_KEY` |
| anthropic | `ANTHROPIC_API_KEY` |
| groq | `GROQ_API_KEY` |
| google | `GOOGLE_API_KEY` |
| together | `TOGETHER_API_KEY` |

---

## 10. Agent Execution Flow

```
runAgent('support-agent', 'My order is missing', opts)
│
├─ 1. loadAgentConfig('support-agent')     → AgentConfig
├─ 2. resolveApiKey(config.provider)       → string
├─ 3. createProvider(config.provider, key) → ProviderClient
├─ 4. storage.createSession() or loadSession(opts.sessionId)
├─ 5. storage.getMessages(sessionId)       → history
│
├─ 6. RAG injection (if config.rag)
│      for each collection:
│        a. resolveApiKey(embeddingProvider)
│        b. createProvider(embeddingProvider, key)
│        c. provider.embed(userMessage)           → number[]
│        d. storage.searchRAG(collection, vector) → RAGResult[]
│        e. format results → ragContext string
│
├─ 7. Build messages array:
│      [system (+ ragContext), ...history, user]
│
├─ 8. loadTools(config.tools)              → ToolConfig[]
│      formatToolsForProvider(tools)        → ToolDefinition[]
│
└─ 9. Tool calling loop (max 10 iterations):
       a. provider.complete(messages, model, { tools })
       b. if finish_reason === 'stop' → return response
       c. if finish_reason === 'tool_calls':
            for each tool_call:
              result = executeTool(tool_call.name, tool_call.arguments)
              append tool result to messages
          → go to (a)
       d. storage.addMessage(sessionId, assistantMsg)
       e. storage.logInference(log)
```

**Streaming** follows the same flow but `provider.stream()` is used in step 9a. Tool call detection requires buffering the stream until `finish_reason` is known, then executing tools and streaming the final response.

---

## 11. Tool Execution

```typescript
// src/tools/executor.ts
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  cwd?: string
): Promise<string>   // always returns a string to inject into messages
```

### REST API Tool

1. Load `tools/<name>.yaml`
2. Replace path params: `endpoint.replace('{ticket_id}', args.ticket_id)`
3. Resolve auth token from `process.env[tool.auth.token_env]`
4. Execute `fetch(url, { method, headers, body })`
5. Return `JSON.stringify(response.json())`

### JavaScript Tool

1. Load `tools/<name>.yaml`
2. Execute `tool.code` in a Node.js `vm.runInNewContext` sandbox
3. The function receives `args` and can use `fetch` (injected)
4. Return `JSON.stringify(result)`

### Web Search Tool

1. Call Brave Search API with `args.query`
2. Return formatted list of title + snippet + url

### Agent Tool

1. Check `ToolContext.agentCallStack` for circular delegation (A → B → A)
2. If circular, throw `CircularDelegationError`
3. Load target agent config via `loadAgentConfig(config.agent_name)`
4. If `pass_context`, prepend a summary of the parent conversation to the task
5. Create a new `AgentRunner` for the target agent
6. Call `runner.run(task, { agentCallStack: [...currentStack, targetName] })`
7. Return `{ content: result.content, success: true }`

---

## 12. Agent Delegation (Agent-as-Tool)

The `agent` tool type enables one agent to delegate tasks to another. This is the foundational building block for multi-agent orchestration.

```
┌─────────────────────────────┐
│  Parent Agent (orchestrator) │
│  tools: [delegate-research]  │
│                              │
│  LLM decides to call tool ──┼──► executeAgentTool()
│                              │        │
│  ◄── tool result ────────────┼────────┘
│                              │        │
│  continues generating        │   ┌────▼──────────────────┐
└──────────────────────────────┘   │  Child Agent (researcher) │
                                   │  Runs as a full AgentRunner  │
                                   │  with its own tool loop       │
                                   └───────────────────────────────┘
```

**Circular delegation prevention:** Each agent call pushes the agent name onto a call stack passed through `ToolContext`. Before executing an agent tool, `executeAgentTool()` checks whether the target agent is already in the stack. If so, it throws `CircularDelegationError` with the full chain (e.g. `orchestrator → researcher → orchestrator`).

**Context passing:** When `pass_context: true`, the parent agent's recent conversation is summarised and prepended to the delegated task, giving the child agent awareness of the broader conversation.

**Implementation:** `packages/core/src/tools/agent.ts` uses dynamic `import()` to load the `AgentRunner` module, avoiding circular dependencies between `tools/` and `agent/`.

---

## 13. Workflow Engine

The workflow engine orchestrates multi-agent workflows defined in YAML. It builds on the agent-as-tool pattern: the engine creates a virtual orchestrator agent with auto-generated `agent` tools for each sub-agent.

```
┌────────────────────────────────────────────────────────────────┐
│  WorkflowEngine.run(task)                                      │
│                                                                │
│  1. Build virtual orchestrator AgentConfig                     │
│     - system_prompt includes agent descriptions                │
│     - model/provider from orchestrator config                  │
│                                                                │
│  2. Create AgentToolConfig for each sub-agent                  │
│     - delegate_researcher → research-agent                     │
│     - delegate_writer → writing-agent                          │
│                                                                │
│  3. Create AgentRunner + injectToolConfigs(agentTools)         │
│                                                                │
│  4. runner.run(task) ── the LLM decides which agents to call   │
│     ├── calls delegate_researcher("gather data on X")          │
│     │   └── spawns research-agent AgentRunner                  │
│     ├── calls delegate_writer("write article using findings")  │
│     │   └── spawns writing-agent AgentRunner                   │
│     └── synthesizes final response                             │
│                                                                │
│  5. Return WorkflowRunResult with per-agent stats              │
└────────────────────────────────────────────────────────────────┘
```

**Key design choice:** No new execution model. The `WorkflowEngine` creates a virtual `AgentConfig` and uses the existing `AgentRunner` tool loop. The orchestrator LLM decides which agents to call and in what order — the engine does not impose sequential or parallel execution.

**Implementation:** `packages/core/src/workflow/engine.ts`

---

## 14. MCP Client

Agents can connect to [Model Context Protocol](https://modelcontextprotocol.io/) servers to dynamically discover and use tools at runtime.

```
┌──────────────────────────────────────────────────────────────┐
│  AgentRunner                                                  │
│                                                               │
│  loadTools()                                                  │
│  ├── Load file-based tools (tools/*.yaml)                    │
│  └── mcpManager.connectAll(config.mcp)                       │
│      ├── StdioMCPConnection("filesystem")                    │
│      │   spawn → initialize → tools/list                     │
│      └── SSEMCPConnection("github")                          │
│          POST → initialize → tools/list                      │
│                                                               │
│  mcpManager.getAllTools()                                     │
│  → ToolDefinition[] (prefixed: mcp_filesystem_read_file)     │
│                                                               │
│  Tool loop:                                                   │
│  if mcpManager.isMCPTool(name):                              │
│    mcpManager.callTool(name, args) → ToolResult              │
│  else:                                                        │
│    executeTool(config, args, context) → ToolResult            │
└──────────────────────────────────────────────────────────────┘
```

### Transport: stdio

`StdioMCPConnection` (`packages/core/src/mcp/stdio.ts`):
- Spawns MCP server as a child process via `child_process.spawn()`
- Communicates over stdin/stdout with Content-Length framed JSON-RPC 2.0
- Sends `initialize` request + `notifications/initialized` notification on connect
- Manages request/response matching via pending request Map

### Transport: SSE

`SSEMCPConnection` (`packages/core/src/mcp/sse.ts`):
- Sends JSON-RPC requests via HTTP POST using native `fetch`
- Parses SSE-style or plain JSON responses
- Tracks session ID via `Mcp-Session-Id` header

### Tool prefixing

MCP tools are exposed with the naming convention `mcp_{serverName}_{toolName}`. This prevents name collisions between multiple MCP servers and between MCP tools and file-based tools.

### Lifecycle

MCP connections are opened in `loadTools()` and closed at the end of `AgentRunner.run()`. Zero external dependencies — uses only Node.js built-ins (`child_process`, `fetch`, `events`).

---

## 15. RAG Pipeline

### Indexing (`crystalai rag index <collection>`)

```
rag/product-docs/
├── api-reference.md
└── getting-started.md
          │
          ▼
1. File Discovery
   glob('rag/<name>/**/*.{md,txt,pdf}')

          │
          ▼
2. Document Loading
   md/txt → readFile
   pdf    → pdf-parse

          │
          ▼
3. Text Chunking
   chunk_size = 512 tokens (configurable)
   chunk_overlap = 64 tokens
   strategy: recursive character splitter

          │
          ▼
4. Embedding Generation
   for each chunk:
     provider.embed(chunk.content, model)  → number[1536]

          │
          ▼
5. Storage
   storage.storeChunks(collection, chunks)
   storage.storeEmbedding(chunkId, vector)
   → written to .crystalai/agents.db
```

### Searching

```
query: "how do I reset my password?"
          │
          ▼
provider.embed(query)         → number[1536]
          │
          ▼
storage.searchRAG(collection, vector, limit=5, threshold=0.7)
  → SELECT via sqlite-vec cosine similarity
          │
          ▼
RAGResult[]
  { chunk_id, content, document_path, similarity }
          │
          ▼
Injected into system prompt:
  "Relevant Knowledge Base Information:
   [Source 1: api-reference.md]
   <chunk content>
   ..."
```

---

## 16. Local Storage (SQLite)

**File:** `<project-root>/.crystalai/agents.db`

**Schema:**

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  agent_name  TEXT NOT NULL,
  title       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
  content       TEXT NOT NULL,
  tool_calls    TEXT,          -- JSON
  tool_call_id  TEXT,
  tokens_used   INTEGER,
  cost_usd      REAL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rag_chunks (
  id            TEXT PRIMARY KEY,
  collection    TEXT NOT NULL,
  document_path TEXT NOT NULL,
  content       TEXT NOT NULL,
  chunk_index   INTEGER,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE rag_embeddings USING vec0(
  chunk_id   TEXT PRIMARY KEY,
  embedding  float[1536]        -- dimension determined at index time
);

CREATE TABLE inference_logs (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  agent_name    TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      REAL,
  latency_ms    INTEGER,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Notes:**
- `rag_embeddings` uses `vec0` from the sqlite-vec extension. The dimension (`float[1536]`) is fixed at index creation time per collection. Different collections may use different dimensions; the table is partitioned by `chunk_id` prefix.
- `better-sqlite3` is used for synchronous access — no async DB calls, which simplifies the tool loop.
- The `.crystalai/` directory is gitignored by the generated `.gitignore` from `crystalai init`.

---

## 17. Studio REST API

Served by `@crystalai/cli` on port 4000 (configurable in `crystalai.config.yaml`).

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents (reads YAML files) |
| GET | `/api/agents/:name` | Get agent config |
| PUT | `/api/agents/:name` | Update agent config (writes YAML) |
| POST | `/api/agents/:name/run` | Run agent, return full response |
| POST | `/api/agents/:name/stream` | Stream agent response (SSE) |

### Tools

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tools` | List all tools |
| GET | `/api/tools/:name` | Get tool config |
| PUT | `/api/tools/:name` | Update tool config (writes YAML) |

### RAG

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rag` | List collections |
| GET | `/api/rag/:name` | Get collection stats |
| POST | `/api/rag/:name/index` | Trigger document indexing |
| POST | `/api/rag/:name/search` | Semantic search |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List sessions (filter by agent) |
| GET | `/api/sessions/:id/messages` | Get messages for session |
| DELETE | `/api/sessions/:id` | Delete session |

### Logs & Providers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs` | Get inference logs (filter: agent, limit, since) |
| GET | `/api/providers` | List configured providers with masked keys |

### SSE Streaming Format

```
POST /api/agents/:name/stream
Content-Type: application/json
Body: { "message": "Hello", "session_id": "optional" }

Response: text/event-stream
data: {"type":"chunk","content":"Hello"}
data: {"type":"chunk","content":", how"}
data: {"type":"chunk","content":" can I help?"}
data: {"type":"tool_call","name":"get-ticket","args":{"ticket_id":"123"}}
data: {"type":"tool_result","name":"get-ticket","result":"{...}"}
data: {"type":"done","session_id":"abc123","tokens":{"input":45,"output":20},"cost_usd":0.0003}
```

---

## 18. Design Decisions

### Why YAML over code-based config?

YAML files are version-controllable, diffable, and editable by non-developers. They can be used by both the TypeScript and Python SDKs without a language barrier. Code-based config (like `defineAgent(...)`) was considered but adds a compilation step and makes the Python SDK harder to implement.

### Why SQLite instead of a file per session?

SQLite provides atomic writes, efficient querying (filter logs by agent, date range), and a standard format that sqlite-vec extends for vector search. A single `.crystalai/agents.db` file is easy to backup, inspect with standard tools, and gitignore.

### Why `better-sqlite3` (sync) instead of async?

The tool-calling loop is inherently sequential: complete → execute tools → complete again. Synchronous SQLite reads/writes simplify this loop significantly and avoid callback/promise chains where they add no value. `better-sqlite3` is battle-tested and fast.

### Why not embed the vector index in a separate file?

Using sqlite-vec keeps everything in one database file. This simplifies backup, copying, and cleanup. The performance trade-off is acceptable for local development use cases (thousands to low millions of vectors).

### Why Express for the Studio server?

Express 5 is stable, widely understood, and minimal. The Studio server is not a public API — it binds to `127.0.0.1` only. No authentication is needed because local access to port 4000 is equivalent to local file system access.

### Why agent-as-tool instead of a new execution model?

The existing `AgentRunner` already implements a complete tool loop with error handling, token tracking, and streaming. By making agents a new tool type, multi-agent orchestration requires zero changes to the core execution model. The orchestrator LLM decides which agents to call — the same way it decides which REST API or JavaScript tool to call. This keeps the system simple and predictable.

### Why a virtual orchestrator instead of explicit step definitions?

Workflow engines like LangGraph or CrewAI define explicit step graphs. CrystalAI takes a different approach: the workflow YAML defines *which agents are available*, and the orchestrator LLM decides the execution order. This is more flexible (the LLM can call agents in any order, skip agents, or call them multiple times) and requires less configuration.

### Why build MCP from scratch instead of using the official SDK?

The official MCP TypeScript SDK (`@modelcontextprotocol/sdk`) adds external dependencies and complexity. CrystalAI's MCP client uses only Node.js built-ins (`child_process`, `fetch`, `events`) and implements the subset of JSON-RPC 2.0 needed for tool discovery and execution. This keeps the dependency footprint at zero and gives full control over connection lifecycle.

### Why dynamic imports in agent tool executor?

`tools/agent.ts` uses `await import('../agent/runner.js')` instead of a static import to avoid circular module dependencies. The `tools/` module is imported by `agent/runner.ts` (for tool execution), and the agent tool needs to import `agent/runner.ts` (to run sub-agents). Dynamic import breaks this cycle.

### Why a Python reimplementation vs. bindings?

Node.js FFI into native modules from Python is fragile. A clean Python reimplementation using the same YAML config format gives Python developers a first-class experience with familiar tooling (`httpx`, `sqlite3`, `asyncio`). The two implementations are coupled only through the YAML schema, not code.

---

## 19. Source Porting Map

Logic ported from `Inference_Provider_V2/` to this monorepo:

| Source | Destination | Notes |
|--------|-------------|-------|
| `supabase/functions/agent-inference/index.ts` | `packages/core/src/agent/runner.ts` | Strip auth, Supabase DB calls, subscription checks; keep tool loop + RAG injection |
| `supabase/functions/execute-tool/index.ts` | `packages/core/src/tools/executor.ts` | Strip Supabase; keep REST/JS/search logic |
| `supabase/functions/rag-search-provider/index.ts` | `packages/core/src/rag/searcher.ts` | Replace pgvector RPC with sqlite-vec query |
| `supabase/functions/rag-embeddings-provider/index.ts` | `packages/core/src/rag/embedder.ts` | Strip Supabase; keep provider routing logic |
| `supabase/functions/ai-inference/index.ts` | `packages/core/src/providers/*.ts` | Split into per-provider files |
| `src/types/tools.ts`, `src/types/assistant.ts` | `packages/core/src/types/` | Adapt: remove Supabase-specific fields |
| `src/components/ChatGPTStyle/*.tsx` (5 files) | `packages/studio/src/components/` | Copy as-is; replace `HorizontalAuditTrail` import |
| `src/pages/AgentTestPageExact.tsx` | `packages/studio/src/pages/Chat.tsx` | Rebuild data layer: replace Supabase hooks with local API fetch |

### What is discarded

- All marketplace, billing, Stripe/Razorpay, subscription, publisher code
- All admin pages and admin service
- All SaaS auth pages (Login, Signup, OAuth flows)
- All Supabase migrations (replaced by SQLite schema)
- All edge functions (logic ported to `@crystalai/core` as plain TypeScript)
- MCP server edge function (future: `crystalai mcp` command in roadmap)

### New modules (not ported — built from scratch)

| Module | Description |
|--------|-------------|
| `packages/core/src/tools/agent.ts` | Agent-as-tool executor with circular delegation prevention |
| `packages/core/src/workflow/engine.ts` | Workflow engine — virtual orchestrator + auto-generated agent tools |
| `packages/core/src/mcp/client.ts` | MCP client manager — connects to multiple MCP servers |
| `packages/core/src/mcp/stdio.ts` | MCP stdio transport — child_process + Content-Length JSON-RPC |
| `packages/core/src/mcp/sse.ts` | MCP SSE transport — HTTP POST + SSE response parsing |
| `packages/core/src/mcp/jsonrpc.ts` | JSON-RPC 2.0 types and utilities |
