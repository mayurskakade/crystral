# CrystalAI — API Reference

Complete reference for the CLI, TypeScript SDK, Python SDK, and Studio REST API.

---

## Table of Contents

1. [CLI Commands](#1-cli-commands)
2. [TypeScript SDK](#2-typescript-sdk)
3. [Python SDK](#3-python-sdk)
4. [Studio REST API](#4-studio-rest-api)
5. [YAML Schemas](#5-yaml-schemas)
6. [Error Reference](#6-error-reference)

---

## 1. CLI Commands

### `crystalai init`

Scaffold a new CrystalAI project in the current directory.

```bash
crystalai init [--name <project-name>]
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | current directory name | Project name written to `crystalai.config.yaml` |
| `--port` | `4000` | Studio port written to config |

**Creates:**

```
./crystalai.config.yaml
./agents/               (empty, with .gitkeep)
./tools/                (empty, with .gitkeep)
./rag/                  (empty, with .gitkeep)
./.gitignore            (adds .crystalai/ and .env)
```

---

### `crystalai auth add <provider>`

Save an API key to `~/.crystalai/credentials`.

```bash
crystalai auth add openai
crystalai auth add anthropic
crystalai auth add groq
crystalai auth add google
crystalai auth add together
```

Prompts for the API key interactively (input is hidden). The key is written to the global credentials file immediately.

**Supported providers:** `openai`, `anthropic`, `groq`, `google`, `together`

---

### `crystalai auth list`

Show all configured providers and masked keys.

```bash
crystalai auth list
```

**Output:**

```
Configured providers:
  openai      sk-...****************************XYZ  (set via credentials)
  anthropic   sk-ant-...**********************ABC  (set via credentials)
  groq        gsk_...****DEF  (set via env: GROQ_API_KEY)
```

Keys resolved from environment variables are labelled `(set via env: ...)`. Keys from the credentials file are labelled `(set via credentials)`. Project `.env` keys are labelled `(set via .env)`.

---

### `crystalai auth remove <provider>`

Remove a provider's key from `~/.crystalai/credentials`.

```bash
crystalai auth remove openai
```

Only removes from the credentials file. Does not unset environment variables.

---

### `crystalai create agent <name>`

Write a new agent YAML template to `agents/<name>.yaml`.

```bash
crystalai create agent support-bot
crystalai create agent --provider anthropic --model claude-sonnet-4-6 summarizer
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--provider` | `openai` | Provider key |
| `--model` | `gpt-4o` | Model name |
| `--description` | — | Agent description |

**Writes:** `agents/<name>.yaml` with template content. Errors if file already exists (use `--force` to overwrite).

---

### `crystalai create tool <name>`

Write a new tool YAML template to `tools/<name>.yaml`.

```bash
crystalai create tool get-ticket
crystalai create tool --type javascript calculate-price
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--type` | `rest_api` | Tool type: `rest_api`, `javascript`, `web_search` |

---

### `crystalai create rag <name>`

Create a new RAG collection directory.

```bash
crystalai create rag product-docs
```

**Creates:**

```
rag/product-docs/
└── .crystalai-rag.yaml    (optional config, with defaults)
```

---

### `crystalai run <agent> [message]`

Run an agent.

```bash
# Interactive REPL (multi-turn)
crystalai run support-bot

# Single-shot (print response and exit)
crystalai run support-bot "What is your return policy?"

# With session ID (loads chat history)
crystalai run support-bot --session my-session

# JSON output
crystalai run support-bot "Hello" --json
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--session <id>` | new session | Load and continue a named session |
| `--json` | false | Output raw JSON response instead of formatted text |
| `--no-stream` | false | Disable streaming, wait for full response |

**REPL commands** (interactive mode only):

| Command | Description |
|---------|-------------|
| `/exit` or `Ctrl+C` | Exit the REPL |
| `/clear` | Clear current session history |
| `/session <id>` | Switch to a different session |
| `/sessions` | List available sessions |
| `/info` | Show current agent config |

---

### `crystalai rag index <collection>`

Chunk and embed all documents in `rag/<collection>/`.

```bash
crystalai rag index product-docs
crystalai rag index product-docs --force   # re-index even if up to date
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--force` | false | Re-index all documents even if unchanged |
| `--chunk-size` | 512 | Tokens per chunk (overrides collection config) |
| `--chunk-overlap` | 64 | Token overlap between chunks |

**Output:**

```
Indexing product-docs...
  Found 3 documents (api-reference.md, getting-started.md, faq.md)
  Chunking... 47 chunks created
  Embedding... 47/47 [████████████████] 100%
  Stored in .crystalai/agents.db
Done in 4.2s
```

---

### `crystalai rag search <collection> <query>`

Test semantic search on an indexed collection.

```bash
crystalai rag search product-docs "how do I reset my password"
crystalai rag search product-docs "billing" --limit 3 --threshold 0.8
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | 5 | Number of results |
| `--threshold` | 0.7 | Minimum similarity score (0–1) |
| `--json` | false | Output raw JSON |

**Output:**

```
Top 3 results for "how do I reset my password":

[1] Similarity: 0.94 — getting-started.md
    "To reset your password, navigate to Settings > Account > Reset Password..."

[2] Similarity: 0.88 — faq.md
    "Forgot your password? Click 'Forgot Password' on the login page..."

[3] Similarity: 0.81 — api-reference.md
    "POST /auth/reset-password — Sends a password reset email..."
```

---

### `crystalai list`

List all agents, tools, and RAG collections in the current project.

```bash
crystalai list
crystalai list --agents
crystalai list --tools
crystalai list --rag
```

**Output:**

```
Agents (2):
  support-bot     openai / gpt-4o       tools: get-ticket  rag: product-docs
  summarizer      anthropic / claude-sonnet-4-6

Tools (1):
  get-ticket      rest_api

RAG Collections (1):
  product-docs    47 chunks  3 documents  last indexed: 2h ago
```

---

### `crystalai logs`

View recent inference logs.

```bash
crystalai logs
crystalai logs --agent support-bot
crystalai logs --limit 50
crystalai logs --since 1h
crystalai logs --json
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--agent <name>` | all agents | Filter by agent name |
| `--limit` | 20 | Max number of log entries |
| `--since <duration>` | — | Filter: `1h`, `24h`, `7d`, `30d` |
| `--json` | false | Output raw JSON |

**Output:**

```
Recent inference logs:

2024-01-15 14:32:01  support-bot  openai/gpt-4o  in:245 out:183  $0.0012  312ms
2024-01-15 14:30:45  support-bot  openai/gpt-4o  in:198 out:67   $0.0007  201ms
2024-01-15 14:28:12  summarizer   anthropic/...   in:1204 out:89  $0.0043  891ms
```

---

### `crystalai studio`

Start the local Studio dashboard.

```bash
crystalai studio
crystalai studio --port 3000
crystalai studio --no-open      # don't auto-open browser
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `4000` (or from config) | HTTP port |
| `--no-open` | false | Don't open browser automatically |
| `--host` | `127.0.0.1` | Bind address |

**Output:**

```
CrystalAI Studio
  Local:    http://localhost:4000
  Network:  http://127.0.0.1:4000

  Agents:   2 loaded
  Tools:    1 loaded
  RAG:      1 collection (47 chunks)

Press Ctrl+C to stop
```

---

## 2. TypeScript SDK

Install:

```bash
npm install @crystalai/sdk
```

### `Agent`

```typescript
import { Agent } from '@crystalai/sdk'
```

#### `new Agent(name, opts?)`

```typescript
const agent = new Agent('support-agent')
const agent = new Agent('support-agent', { cwd: '/path/to/project' })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Agent name (matches `agents/<name>.yaml`) |
| `opts.cwd` | `string` | Project root directory. Defaults to `process.cwd()` |

#### `agent.run(message, opts?): Promise<AgentResponse>`

Run the agent with a single message.

```typescript
const response = await agent.run('Hello!')

// With options
const response = await agent.run('Hello!', {
  sessionId: 'my-session',
  variables: { customer_name: 'Alice' },
  ragThreshold: 0.8,
  ragMatchCount: 3,
})
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | `string` | required | User message |
| `opts.sessionId` | `string` | new session | Load history from this session |
| `opts.variables` | `Record<string,string>` | `{}` | Template variables for system prompt |
| `opts.ragThreshold` | `number` | `0.7` | Minimum RAG similarity |
| `opts.ragMatchCount` | `number` | `5` | Max RAG results |

**Returns:** `AgentResponse`

```typescript
interface AgentResponse {
  content: string
  sessionId: string
  toolCallsMade: number
  tokens: { input: number; output: number; total: number }
  costUsd: number
  latencyMs: number
}
```

#### `agent.stream(message, opts?): AsyncIterable<string>`

Stream the agent response token by token.

```typescript
for await (const chunk of agent.stream('Hello!')) {
  process.stdout.write(chunk)
}
```

Same options as `agent.run()`. Yields string chunks. After the loop, access full response metadata via `agent.lastResponse`.

#### `agent.session(sessionId): AgentSession`

Create or load a named session.

```typescript
const session = agent.session('customer-alice')
await session.send('I need help with my order')
await session.send('Order number 12345')
```

---

### `AgentSession`

```typescript
const session = agent.session('my-session')
```

#### `session.send(message, opts?): Promise<AgentResponse>`

Send a message in this session (history is automatically loaded and saved).

```typescript
const response = await session.send('What did I say before?')
```

#### `session.stream(message, opts?): AsyncIterable<string>`

Stream a response in this session.

```typescript
for await (const chunk of session.stream('Tell me more')) {
  process.stdout.write(chunk)
}
```

#### `session.getHistory(): Promise<Message[]>`

Get all messages in this session.

```typescript
const history = await session.getHistory()
// [{ id, role, content, created_at }, ...]
```

#### `session.clear(): Promise<void>`

Delete all messages in this session (keeps the session ID).

```typescript
await session.clear()
```

---

### `RAGCollection`

```typescript
import { RAGCollection } from '@crystalai/sdk'
```

#### `new RAGCollection(name, opts?)`

```typescript
const docs = new RAGCollection('product-docs')
const docs = new RAGCollection('product-docs', { cwd: '/path/to/project' })
```

#### `docs.index(opts?): Promise<IndexResult>`

Chunk and embed all documents in `rag/<name>/`.

```typescript
const result = await docs.index()
// { chunks: 47, documents: 3, skipped: 0, durationMs: 4200 }

// Force re-index even unchanged docs
await docs.index({ force: true })
```

**Returns:**

```typescript
interface IndexResult {
  chunks: number
  documents: number
  skipped: number        // unchanged docs skipped (content hash check)
  durationMs: number
}
```

#### `docs.search(query, opts?): Promise<RAGResult[]>`

Semantic search on the indexed collection.

```typescript
const results = await docs.search('how to reset password')
const results = await docs.search('billing', { limit: 3, threshold: 0.85 })
```

**Returns:**

```typescript
interface RAGResult {
  chunkId: string
  content: string
  documentPath: string
  similarity: number     // 0–1
}
```

#### `docs.getStats(): Promise<CollectionStats>`

```typescript
const stats = await docs.getStats()
// { chunks: 47, documents: ['api-reference.md', ...], lastIndexed: Date }
```

#### `docs.clear(): Promise<void>`

Delete all chunks and embeddings for this collection.

```typescript
await docs.clear()
```

---

### `Tool`

```typescript
import { Tool } from '@crystalai/sdk'
```

#### `new Tool(name, opts?)`

```typescript
const tool = new Tool('get-ticket')
```

#### `tool.execute(params): Promise<unknown>`

Execute the tool with the given parameters.

```typescript
const result = await tool.execute({ ticket_id: '12345' })
// Returns parsed JSON response from the endpoint
```

#### `tool.getConfig(): Promise<ToolConfig>`

Read and return the tool's YAML config.

---

### Type Exports

```typescript
import type {
  AgentConfig,
  ToolConfig,
  AgentResponse,
  Message,
  Session,
  RAGResult,
  InferenceLog,
} from '@crystalai/sdk'
```

---

## 3. Python SDK

Install:

```bash
pip install crystalai
```

### `Agent`

```python
from crystalai import Agent
```

#### `Agent(name, cwd=None)`

```python
agent = Agent('support-agent')
agent = Agent('support-agent', cwd='/path/to/project')
```

#### `agent.run(message, **opts) -> AgentResponse`

```python
response = agent.run('Hello!')
print(response.content)
print(f"Cost: ${response.cost_usd:.4f}")
```

**Keyword arguments:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `session_id` | `str` | new session | Load history from this session |
| `variables` | `dict` | `{}` | Template variables |
| `rag_threshold` | `float` | `0.7` | Minimum RAG similarity |
| `rag_match_count` | `int` | `5` | Max RAG results |

**Returns:** `AgentResponse`

```python
@dataclass
class AgentResponse:
    content: str
    session_id: str
    tool_calls_made: int
    tokens: TokenUsage        # .input, .output, .total
    cost_usd: float
    latency_ms: int
```

#### `agent.run_async(message, **opts) -> Coroutine[AgentResponse]`

```python
import asyncio

async def main():
    response = await agent.run_async('Hello!')
    print(response.content)

asyncio.run(main())
```

#### `agent.stream(message, **opts) -> Generator[str, None, None]`

```python
for chunk in agent.stream('Hello!'):
    print(chunk, end='', flush=True)
print()  # newline after streaming
```

#### `agent.stream_async(message, **opts) -> AsyncGenerator[str, None]`

```python
async def main():
    async for chunk in agent.stream_async('Hello!'):
        print(chunk, end='', flush=True)
```

#### `agent.session(session_id) -> AgentSession`

```python
session = agent.session('customer-alice')
response = session.send('I need help')
response = session.send('Order 12345')
```

---

### `AgentSession`

#### `session.send(message, **opts) -> AgentResponse`

#### `session.stream(message, **opts) -> Generator[str, None, None]`

#### `session.get_history() -> List[Message]`

```python
history = session.get_history()
for msg in history:
    print(f"{msg.role}: {msg.content[:80]}")
```

#### `session.clear() -> None`

---

### `RAGCollection`

```python
from crystalai import RAGCollection

docs = RAGCollection('product-docs')
```

#### `docs.index(force=False) -> IndexResult`

```python
result = docs.index()
print(f"Indexed {result.chunks} chunks from {result.documents} documents")
print(f"Done in {result.duration_ms}ms")
```

#### `docs.index_async(force=False) -> Coroutine[IndexResult]`

```python
result = await docs.index_async()
```

#### `docs.search(query, limit=5, threshold=0.7) -> List[RAGResult]`

```python
results = docs.search('how to reset password', limit=3)
for r in results:
    print(f"[{r.similarity:.2f}] {r.document_path}: {r.content[:100]}")
```

**Returns:** `List[RAGResult]`

```python
@dataclass
class RAGResult:
    chunk_id: str
    content: str
    document_path: str
    similarity: float
```

#### `docs.get_stats() -> CollectionStats`

```python
stats = docs.get_stats()
print(f"Chunks: {stats.chunks}, Documents: {stats.documents}")
```

#### `docs.clear() -> None`

---

### `Tool`

```python
from crystalai import Tool

tool = Tool('get-ticket')
```

#### `tool.execute(params) -> Any`

```python
result = tool.execute({'ticket_id': '12345'})
print(result)  # parsed JSON from endpoint
```

#### `tool.execute_async(params) -> Coroutine[Any]`

```python
result = await tool.execute_async({'ticket_id': '12345'})
```

---

### Python CLI

The Python package also installs a `crystalai` command that mirrors the TypeScript CLI:

```bash
pip install crystalai
crystalai init
crystalai auth add openai
crystalai run support-agent "Hello"
crystalai studio
```

All CLI commands and flags are identical to the TypeScript CLI.

---

## 4. Studio REST API

The Studio API is served at `http://localhost:4000` (or custom port) when `crystalai studio` is running.

### Authentication

None. The server binds to `127.0.0.1` only. Access is equivalent to local file system access.

### Agents

#### `GET /api/agents`

List all agents.

**Response:**
```json
[
  {
    "name": "support-agent",
    "description": "Customer support agent",
    "provider": "openai",
    "model": "gpt-4o",
    "tools": ["get-ticket"],
    "rag": ["product-docs"]
  }
]
```

#### `GET /api/agents/:name`

Get a single agent's full config.

**Response:** Full `AgentConfig` object.

#### `PUT /api/agents/:name`

Update agent config (writes YAML to `agents/<name>.yaml`).

**Body:** Partial or full `AgentConfig` object.

**Response:** Updated `AgentConfig`.

#### `POST /api/agents/:name/run`

Run an agent and return the full response.

**Body:**
```json
{
  "message": "Hello!",
  "session_id": "optional-session-id",
  "variables": {}
}
```

**Response:**
```json
{
  "content": "Hello! How can I help you today?",
  "session_id": "abc123",
  "tool_calls_made": 0,
  "tokens": { "input": 45, "output": 22, "total": 67 },
  "cost_usd": 0.0002,
  "latency_ms": 312
}
```

#### `POST /api/agents/:name/stream`

Stream an agent response via Server-Sent Events.

**Body:** Same as `/run`.

**Response headers:** `Content-Type: text/event-stream`

**Event format:**
```
data: {"type":"chunk","content":"Hello"}
data: {"type":"chunk","content":"!"}
data: {"type":"tool_call","name":"get-ticket","args":{"ticket_id":"123"}}
data: {"type":"tool_result","name":"get-ticket","result":"{\"id\":\"123\",...}"}
data: {"type":"done","session_id":"abc123","tokens":{"input":45,"output":22,"total":67},"cost_usd":0.0002}
```

---

### Tools

#### `GET /api/tools`

List all tool configs.

**Response:** Array of `ToolConfig` objects.

#### `GET /api/tools/:name`

Get a single tool's config.

#### `PUT /api/tools/:name`

Update a tool's config (writes YAML).

---

### RAG

#### `GET /api/rag`

List all RAG collections with stats.

**Response:**
```json
[
  {
    "name": "product-docs",
    "chunks": 47,
    "documents": ["api-reference.md", "getting-started.md"],
    "last_indexed": "2024-01-15T12:30:00Z"
  }
]
```

#### `GET /api/rag/:name`

Get collection stats for a single collection.

#### `POST /api/rag/:name/index`

Trigger document indexing (runs `crystalai rag index` logic).

**Body:**
```json
{ "force": false }
```

**Response:**
```json
{
  "chunks": 47,
  "documents": 3,
  "skipped": 0,
  "duration_ms": 4200
}
```

#### `POST /api/rag/:name/search`

Semantic search.

**Body:**
```json
{
  "query": "how to reset password",
  "limit": 5,
  "threshold": 0.7
}
```

**Response:** Array of `RAGResult` objects.

---

### Sessions

#### `GET /api/sessions`

List all chat sessions.

**Query params:** `?agent=support-agent` (filter by agent)

**Response:**
```json
[
  {
    "id": "abc123",
    "agent_name": "support-agent",
    "title": "My order is missing",
    "created_at": "2024-01-15T12:30:00Z",
    "message_count": 6
  }
]
```

#### `GET /api/sessions/:id/messages`

Get all messages in a session.

**Response:** Array of `Message` objects.

#### `DELETE /api/sessions/:id`

Delete a session and all its messages.

**Response:** `{ "deleted": true }`

---

### Logs

#### `GET /api/logs`

Get inference logs.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `agent` | string | Filter by agent name |
| `limit` | number | Max results (default: 50) |
| `since` | ISO date | Filter by date |

**Response:**
```json
[
  {
    "id": "log_abc123",
    "session_id": "sess_xyz",
    "agent_name": "support-agent",
    "provider": "openai",
    "model": "gpt-4o",
    "input_tokens": 245,
    "output_tokens": 183,
    "cost_usd": 0.0012,
    "latency_ms": 312,
    "created_at": "2024-01-15T14:32:01Z"
  }
]
```

---

### Providers

#### `GET /api/providers`

List configured providers with masked API keys.

**Response:**
```json
[
  {
    "name": "openai",
    "configured": true,
    "source": "credentials",
    "masked_key": "sk-...****XYZ"
  },
  {
    "name": "anthropic",
    "configured": false,
    "source": null,
    "masked_key": null
  }
]
```

---

## 5. YAML Schemas

### `crystalai.config.yaml`

```yaml
version: 1                   # required, must be 1
project: my-project          # required
studio:
  port: 4000                 # optional, default: 4000
  open_browser: true         # optional, default: true
```

### `agents/<name>.yaml`

```yaml
name: support-agent          # required, must match filename
description: string          # optional
provider: openai             # required — openai | anthropic | groq | google | together
model: gpt-4o                # required
system_prompt: |             # optional
  You are a helpful agent.
temperature: 0.7             # optional, 0.0–2.0, default: 1.0
max_tokens: 4096             # optional, default: 4096
tools:                       # optional, list of tool names
  - tool-name
rag:                         # optional
  collections:
    - product-docs           # collection names
  embedding_provider: openai # required if rag is set
  embedding_model: text-embedding-3-small  # required if rag is set
  match_threshold: 0.7       # optional, default: 0.7
  match_count: 5             # optional, default: 5
```

### `tools/<name>.yaml` — REST API

```yaml
name: get-ticket             # required, must match filename
description: string          # required (used as tool description for AI)
type: rest_api               # required
endpoint: https://api.example.com/tickets/{ticket_id}  # required
method: GET                  # optional, default: GET — GET | POST | PUT | PATCH | DELETE
headers:                     # optional
  Content-Type: application/json
auth:                        # optional
  type: bearer               # bearer | basic | header
  token_env: SUPPORT_API_KEY # env var name containing the token
  header_name: X-API-Key     # only for type: header
body_template: |             # optional, for POST/PUT — supports {param} interpolation
  {"field": "{value}"}
parameters:                  # required — used to generate AI tool schema
  - name: ticket_id
    type: string             # string | number | boolean | array | object
    required: true
    description: The ticket ID to fetch
    enum:                    # optional — restrict to specific values
      - open
      - closed
```

### `tools/<name>.yaml` — JavaScript

```yaml
name: calculate-price
description: Calculate the final price with tax
type: javascript
parameters:
  - name: price
    type: number
    required: true
  - name: tax_rate
    type: number
    required: false
    description: Tax rate as decimal (e.g. 0.08 for 8%)
code: |
  const taxRate = args.tax_rate ?? 0.08;
  const total = args.price * (1 + taxRate);
  return { price: args.price, tax: args.price * taxRate, total };
```

### `tools/<name>.yaml` — Web Search

```yaml
name: web-search
description: Search the web for current information
type: web_search
parameters:
  - name: query
    type: string
    required: true
    description: Search query
  - name: count
    type: number
    required: false
    description: Number of results (default 5)
```

Requires `BRAVE_API_KEY` in environment.

### `rag/<name>/.crystalai-rag.yaml` (optional)

```yaml
embedding_provider: openai            # default: openai
embedding_model: text-embedding-3-small  # default: text-embedding-3-small
chunk_size: 512                        # tokens per chunk, default: 512
chunk_overlap: 64                      # token overlap, default: 64
include:                               # optional glob patterns
  - "**/*.md"
  - "**/*.txt"
exclude:                               # optional
  - "**/node_modules/**"
```

---

## 6. Error Reference

### CLI Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CredentialNotFoundError` | No API key found for provider | Run `crystalai auth add <provider>` or set env var |
| `AgentNotFoundError` | `agents/<name>.yaml` doesn't exist | Run `crystalai create agent <name>` |
| `ToolNotFoundError` | Tool listed in agent YAML not found | Create `tools/<name>.yaml` |
| `CollectionNotIndexedError` | RAG collection used but not indexed | Run `crystalai rag index <collection>` |
| `ValidationError` | Invalid YAML schema | Check YAML against schema, error message shows the field |
| `ProviderError` | Provider API returned error | Check API key, model name, and provider status |
| `RateLimitError` | Provider rate limit hit | Retry after delay or upgrade provider plan |

### SDK Errors

All SDK errors extend `CrystalAIError`:

```typescript
import { CrystalAIError, CredentialNotFoundError, AgentNotFoundError } from '@crystalai/sdk'

try {
  await agent.run('Hello')
} catch (err) {
  if (err instanceof CredentialNotFoundError) {
    console.error('Missing API key:', err.provider)
  } else if (err instanceof CrystalAIError) {
    console.error('CrystalAI error:', err.message, err.code)
  }
}
```

**Error classes:**

| Class | Code | Description |
|-------|------|-------------|
| `CredentialNotFoundError` | `CREDENTIAL_NOT_FOUND` | API key not found for provider |
| `AgentNotFoundError` | `AGENT_NOT_FOUND` | Agent YAML file not found |
| `ToolNotFoundError` | `TOOL_NOT_FOUND` | Tool YAML file not found |
| `ValidationError` | `VALIDATION_ERROR` | Invalid YAML config |
| `ProviderError` | `PROVIDER_ERROR` | AI provider API error |
| `RateLimitError` | `RATE_LIMIT` | Provider rate limit exceeded |
| `StorageError` | `STORAGE_ERROR` | SQLite read/write error |

### Python Errors

```python
from crystalai.errors import (
    CrystalAIError,
    CredentialNotFoundError,
    AgentNotFoundError,
    ValidationError,
    ProviderError,
)

try:
    response = agent.run('Hello')
except CredentialNotFoundError as e:
    print(f"Missing API key for: {e.provider}")
except CrystalAIError as e:
    print(f"Error [{e.code}]: {e.message}")
```

### Studio API Error Responses

All API errors return:

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent 'support-agent' not found. Create it with: crystalai create agent support-agent",
    "details": {}
  }
}
```

HTTP status codes:
- `400` — Invalid request body or YAML validation error
- `404` — Agent / tool / collection not found
- `409` — Conflict (e.g. agent already exists)
- `500` — Internal error (provider error, storage error)
- `503` — Provider unavailable
