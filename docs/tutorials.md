# Tutorials

A guided video curriculum for Crystal AI, organized into four tracks. Each entry below is the written companion to its video: prerequisites, full concept explanation, copy-pasteable code, and links to related reference docs.

---

## Tracks at a Glance

| Track | Audience | Videos |
|-------|----------|--------|
| [Fundamentals](#track-1--fundamentals) | New users | 5 |
| [Features Deep-Dive](#track-2--features-deep-dive) | Intermediate | 7 |
| [Integrations](#track-3--integrations) | Developers | 4 |
| [Real-World Projects](#track-4--real-world-projects) | All | 3 |

---

## Track 1 — Fundamentals

### 1.1 · What is Crystal AI?

**Duration:** ~5 min
**Prerequisites:** None

#### What You'll Learn

- The problem Crystal AI solves
- Core philosophy: YAML-first, local-first, zero cloud dependency
- High-level architecture: config → engine → providers → storage
- What you can build: chatbots, RAG pipelines, multi-agent workflows
- How Crystal compares to LangChain, CrewAI, and AutoGen

#### Concept

Most AI agent frameworks require you to write Python orchestration code that mixes prompt logic, provider SDKs, retry handling, and memory management in a single file. Crystal AI separates **what** an agent does (YAML configuration) from **how** it runs (the Core Engine). Your agent definitions are version-controllable, diffable, and readable by non-engineers.

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

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| YAML config | Human-readable, version-controlled, no code changes to tune behavior |
| SQLite + sqlite-vec | Zero infrastructure; vector search ships with the package |
| Local credentials | API keys never leave your machine |
| 5 built-in providers | Swap models without changing agent logic |
| MCP client | Dynamically extend any agent with any MCP-compatible tool server |

#### Further Reading

- [Getting Started](./getting-started.md)
- [Architecture](../ARCHITECTURE.md)

---

### 1.2 · Install & Your First Agent

**Duration:** ~10 min
**Prerequisites:** Node.js ≥18, npm or pnpm

#### What You'll Learn

- Install Crystal AI and set up a project
- Write a minimal agent YAML
- Run an agent with the SDK (single-shot and multi-turn)
- Open the Studio dashboard

#### Step 1 — Install

```bash
mkdir my-ai-project && cd my-ai-project
npm init -y
npm install @crystralai/sdk
```

#### Step 2 — Set your API key

```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

#### Step 3 — Create the project config

```yaml
# crystral.config.yaml
project: my-ai-project
default_provider: openai
default_model: gpt-4o-mini
```

#### Step 4 — Write your first agent

```yaml
# agents/assistant.yaml
name: assistant
description: A helpful general-purpose assistant
model: gpt-4o-mini
system_prompt: |
  You are a concise, helpful assistant.
  Answer questions clearly and directly.
```

#### Step 5 — Run it

```typescript
// index.ts
import { Crystral } from '@crystralai/sdk';

const crystral = new Crystral();
const agent = await crystral.getAgent('assistant');

// Single-shot
const result = await agent.run({ input: 'What is Crystal AI?' });
console.log(result.output);

// Multi-turn
const session = await agent.createSession();
await session.run({ input: 'My name is Alice.' });
const r2 = await session.run({ input: 'What is my name?' });
console.log(r2.output); // "Your name is Alice."
```

```bash
npx ts-node index.ts
```

#### What to Expect

The agent reads your YAML, resolves credentials from `.env`, sends the prompt to OpenAI, and returns a typed result. No boilerplate provider SDK code needed.

#### Further Reading

- [Agents Guide](./agents.md)
- [Providers Guide](./providers.md)
- [Studio Guide](./studio.md)

---

### 1.3 · Understanding the YAML Config

**Duration:** ~12 min
**Prerequisites:** Completed 1.2

#### What You'll Learn

- The `crystral.config.yaml` schema
- How Crystal discovers agent, tool, and workflow files
- Credential resolution order
- Configuring all 5 providers
- Switching providers with one line

#### Project Config Schema

```yaml
# crystral.config.yaml
project: my-project           # required — display name
version: "1.0"                # optional — for tracking
default_provider: openai      # which provider to use by default
default_model: gpt-4o-mini    # default model for that provider

providers:
  openai:
    api_key: ${OPENAI_API_KEY} # or hardcode for dev (not recommended)
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  groq:
    api_key: ${GROQ_API_KEY}
  google:
    api_key: ${GOOGLE_API_KEY}
  together:
    api_key: ${TOGETHER_API_KEY}

paths:
  agents: ./agents             # default
  tools: ./tools               # default
  workflows: ./workflows       # default
  collections: ./collections   # default (RAG)
```

#### File Discovery

Crystal recursively scans the configured directories for `.yaml` files and loads them by filename (without extension):

```
agents/
  assistant.yaml      → agent name: "assistant"
  code-reviewer.yaml  → agent name: "code-reviewer"
  nested/
    specialist.yaml   → agent name: "nested/specialist"
```

#### Credential Resolution Order

Crystal checks for API keys in this order (highest priority first):

1. **Process environment variable** — `OPENAI_API_KEY` already exported in the shell
2. **Project `.env` file** — `<project-root>/.env`
3. **Global credentials file** — `~/.crystalai/credentials`

```bash
# ~/.crystalai/credentials
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIza...
TOGETHER_API_KEY=...
```

#### Switching Providers

Change one line in the agent YAML to swap providers — no code changes:

```yaml
# Use OpenAI
model: gpt-4o
provider: openai

# Switch to Anthropic
model: claude-3-5-sonnet-20241022
provider: anthropic

# Switch to Groq (fast inference)
model: llama-3.1-70b-versatile
provider: groq
```

#### Further Reading

- [Configuration Guide](./configuration.md)
- [Providers Guide](./providers.md)

---

### 1.4 · Tools: Giving Agents Superpowers

**Duration:** ~15 min
**Prerequisites:** Completed 1.2

#### What You'll Learn

- The 4 tool types in Crystal AI
- Write a REST API tool, JavaScript tool, and web search tool
- Attach tools to an agent

#### The 4 Tool Types

| Type | Use Case | Runs Where |
|------|----------|------------|
| `rest` | Call any HTTP API | HTTP request |
| `javascript` | Transform data, run logic | Node.js VM sandbox |
| `web_search` | Search the web | Brave/SerpAPI |
| `agent` | Delegate to another agent | Crystal runtime |

#### REST API Tool

```yaml
# tools/weather.yaml
name: get_weather
type: rest
description: Get current weather for a city
url: https://api.open-meteo.com/v1/forecast
method: GET
parameters:
  - name: city
    type: string
    description: City name
    required: true
query_params:
  latitude: "{{city_lat}}"
  longitude: "{{city_lon}}"
  current_weather: "true"
response_path: current_weather
```

#### JavaScript Tool

```yaml
# tools/parse-date.yaml
name: parse_date
type: javascript
description: Parse a natural language date string into ISO format
parameters:
  - name: date_string
    type: string
    description: Natural language date (e.g. "next Tuesday")
    required: true
code: |
  const input = context.params.date_string;
  // Simple relative date parsing
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return { error: 'Could not parse date: ' + input };
  }
  return { iso: date.toISOString(), readable: date.toDateString() };
```

#### Web Search Tool

```yaml
# tools/search.yaml
name: web_search
type: web_search
description: Search the web for current information
parameters:
  - name: query
    type: string
    description: Search query
    required: true
provider: brave              # requires BRAVE_API_KEY
max_results: 5
```

#### Attaching Tools to an Agent

```yaml
# agents/researcher.yaml
name: researcher
model: gpt-4o
system_prompt: |
  You are a research assistant. Use your tools to find accurate,
  up-to-date information before answering.
tools:
  - web_search
  - parse_date
```

#### Further Reading

- [Tools Guide](./tools.md)
- [Agents Guide](./agents.md)

---

### 1.5 · The Studio Dashboard

**Duration:** ~8 min
**Prerequisites:** Completed 1.2

#### What You'll Learn

- Start the Studio dashboard
- Navigate the 11 dashboard sections
- Test an agent interactively
- Inspect inference logs and token usage

#### Starting Studio

```bash
npx crystral studio
# Studio running at http://localhost:4200
```

Or with a custom port:

```bash
PORT=8080 npx crystral studio
```

#### Dashboard Sections

| Section | What It Shows |
|---------|---------------|
| **Agents** | All discovered agents, edit YAML inline |
| **Tools** | All tools, test individual tool calls |
| **Workflows** | Workflow definitions and run history |
| **Sessions** | Conversation history, filterable by agent |
| **Logs** | Inference logs: tokens, latency, cost per call |
| **RAG** | Collections, document count, re-index trigger |
| **Prompts** | System prompt versions and A/B variants |
| **Tests** | Run YAML test suites, view pass/fail |
| **Validation** | Schema validation results for all config files |
| **Schedules** | Configured cron jobs for agents |
| **Providers** | Provider health checks and credential status |

#### Testing an Agent

1. Click **Agents** → select your agent
2. Click **Run** — a chat interface opens
3. Type a message; the agent responds in real-time via SSE streaming
4. Click **Logs** tab to see: model used, prompt tokens, completion tokens, latency, estimated cost

#### Further Reading

- [Studio Guide](./studio.md)
- [CLI Reference](./cli-reference.md)

---

## Track 2 — Features Deep-Dive

### 2.1 · RAG: Give Agents Your Documents

**Duration:** ~18 min
**Prerequisites:** Completed Track 1

#### What You'll Learn

- Create and index a document collection
- Configure chunk size, overlap, and match thresholds
- Attach a collection to an agent
- Query the agent and see it cite from your documents

#### What is RAG?

Retrieval-Augmented Generation lets an agent answer questions using your private documents. Instead of hallucinating, the agent:

1. Embeds your query as a vector
2. Searches the collection for the most relevant chunks
3. Injects those chunks into the prompt context
4. Answers based on retrieved content

Crystal AI stores vectors locally using `sqlite-vec` — no external vector database required.

#### Step 1 — Add Documents

```bash
mkdir -p collections/product-docs/
cp docs/*.md collections/product-docs/
cp manuals/*.pdf collections/product-docs/
```

Supported file types: `.md`, `.txt`, `.pdf`, `.docx`, `.html`, `.csv`, `.json`

#### Step 2 — Create a Collection Config

```yaml
# collections/product-docs.yaml
name: product-docs
description: Product documentation and user manuals
provider: local               # sqlite-vec, no external service needed
embedding_provider: openai
embedding_model: text-embedding-3-small
chunk_size: 512
chunk_overlap: 64
source_dir: ./collections/product-docs/
```

#### Step 3 — Index the Collection

```bash
npx crystral index product-docs
# Indexing 47 files...
# ✓ Indexed 1,203 chunks in 8.2s
```

#### Step 4 — Attach to an Agent

```yaml
# agents/support-bot.yaml
name: support-bot
model: gpt-4o-mini
system_prompt: |
  You are a product support assistant. Answer questions using only
  the documentation provided. If you don't know, say so.
rag:
  collections:
    - product-docs
  match_threshold: 0.75       # minimum similarity score (0–1)
  match_count: 5              # chunks to inject per query
```

#### Step 5 — Run It

```typescript
const agent = await crystral.getAgent('support-bot');
const result = await agent.run({
  input: 'How do I reset my password?'
});
console.log(result.output);
// "According to the user manual (section 4.2), to reset your password..."
```

#### Further Reading

- [RAG Guide](./rag.md)
- [Providers Guide](./providers.md) — embedding model options

---

### 2.2 · Multi-Agent Workflows

**Duration:** ~20 min
**Prerequisites:** Completed 2.1

#### What You'll Learn

- The virtual orchestrator pattern
- Write a workflow YAML with multiple agent steps
- Pass output between steps using `output_as`
- Use `run_if` for conditional steps
- Run a workflow from the SDK

#### The Virtual Orchestrator Pattern

Crystal workflows don't use an explicit DAG. Instead, a virtual orchestrator agent interprets the workflow YAML at runtime, delegates to specialist agents in sequence or in parallel, and assembles the final result. You get LLM-driven flexibility without hand-coding orchestration logic.

#### Workflow YAML

```yaml
# workflows/research-and-write.yaml
name: research-and-write
description: Research a topic then write a polished article

agents:
  - name: researcher
    description: Expert web researcher
    model: gpt-4o
    system_prompt: |
      Research the given topic thoroughly. Return a structured outline
      with key facts, sources, and talking points.
    tools:
      - web_search

  - name: writer
    description: Professional content writer
    model: gpt-4o
    system_prompt: |
      Write a polished 800-word article based on the research outline provided.
      Use clear, engaging prose. Include a title and subheadings.

  - name: editor
    description: Copy editor
    model: gpt-4o-mini
    system_prompt: |
      Review the article for grammar, clarity, and flow.
      Return the corrected version with a brief change summary.

steps:
  - agent: researcher
    output_as: research_outline

  - agent: writer
    input: "{{research_outline}}"
    output_as: draft_article

  - agent: editor
    input: "{{draft_article}}"
    output_as: final_article
    run_if: "{{draft_article}} != ''"
```

#### Running from the SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const crystral = new Crystral();
const workflow = await crystral.getWorkflow('research-and-write');

const result = await workflow.run({
  input: 'The impact of large language models on software development'
});

console.log(result.steps.research_outline);
console.log(result.steps.draft_article);
console.log(result.output); // final_article
```

#### Parallel Steps

```yaml
steps:
  - parallel:
    - agent: seo-analyzer
      output_as: seo_report
    - agent: readability-checker
      output_as: readability_report

  - agent: final-reviewer
    input: |
      SEO: {{seo_report}}
      Readability: {{readability_report}}
```

#### Further Reading

- [Workflows Guide](./workflows.md)
- [Agents Guide](./agents.md)

---

### 2.3 · MCP Integration

**Duration:** ~12 min
**Prerequisites:** Completed Track 1

#### What You'll Learn

- Connect a stdio MCP server to an agent
- Connect an SSE MCP server
- Understand tool naming conventions
- Authenticate MCP servers via environment variables

#### What is MCP?

The Model Context Protocol is an open standard for exposing tools to LLMs. Crystal AI implements an MCP **client** — it can connect to any MCP-compatible server and make its tools available to your agents, dynamically at runtime.

#### Stdio MCP Server (local process)

```yaml
# agents/file-manager.yaml
name: file-manager
model: gpt-4o
system_prompt: |
  You help users manage files. You can read, write, list, and search
  files in the /tmp directory.
mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
```

Crystal starts the MCP server as a subprocess, discovers its tools via the protocol, and prefixes them: `mcp_filesystem_read_file`, `mcp_filesystem_write_file`, etc.

#### SSE MCP Server (remote)

```yaml
mcp:
  - transport: sse
    name: github
    url: https://mcp.example.com/github
    headers:
      Authorization: "Bearer ${GITHUB_TOKEN}"
```

#### Multi-Server Agent

```yaml
# agents/dev-assistant.yaml
name: dev-assistant
model: gpt-4o
system_prompt: You are a development assistant with file and GitHub access.
mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
  - transport: sse
    name: github
    url: http://localhost:3001/mcp
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
```

#### Further Reading

- [MCP Guide](./mcp.md)
- [Tools Guide](./tools.md)

---

### 2.4 · Structured Output

**Duration:** ~10 min
**Prerequisites:** Completed 1.4

#### What You'll Learn

- Define a JSON schema on an agent
- Receive validated, typed output
- Use structured output in multi-agent pipelines

#### Why Structured Output?

When agents return free-form text, downstream code must parse it — fragile and error-prone. Structured output guarantees the response matches a schema every time.

#### Define the Schema

```yaml
# agents/invoice-extractor.yaml
name: invoice-extractor
model: gpt-4o
system_prompt: |
  Extract structured data from the invoice text provided.
  Return all monetary values as numbers (no currency symbols).
output:
  type: object
  properties:
    invoice_number:
      type: string
    vendor:
      type: string
    date:
      type: string
      format: date
    line_items:
      type: array
      items:
        type: object
        properties:
          description:
            type: string
          quantity:
            type: number
          unit_price:
            type: number
          total:
            type: number
        required: [description, quantity, unit_price, total]
    subtotal:
      type: number
    tax:
      type: number
    total:
      type: number
  required: [invoice_number, vendor, date, line_items, total]
```

#### Using the Output

```typescript
const agent = await crystral.getAgent('invoice-extractor');
const result = await agent.run({ input: invoiceText });

// result.output is validated against the schema
const invoice = result.output as InvoiceData;
console.log(invoice.total);           // number, always
console.log(invoice.line_items[0]);   // typed object
```

#### In a Workflow

```yaml
steps:
  - agent: invoice-extractor
    output_as: invoice_data

  - agent: accounting-validator
    input: "{{invoice_data}}"   # passes the structured JSON object
```

#### Further Reading

- [Advanced Guide](./advanced.md#structured-output)
- [Workflows Guide](./workflows.md)

---

### 2.5 · Retry, Fallback & Guardrails

**Duration:** ~12 min
**Prerequisites:** Completed Track 1

#### What You'll Learn

- Configure retry with backoff
- Set up provider fallback chains
- Add input and output guardrails

#### Retry Configuration

```yaml
# agents/production-agent.yaml
name: production-agent
model: gpt-4o
system_prompt: You are a reliable production assistant.
retry:
  attempts: 3
  backoff: exponential        # linear | exponential | fixed
  initial_delay_ms: 500
  on_errors:
    - rate_limit
    - server_error
    - timeout
```

#### Provider Fallback Chain

```yaml
retry:
  attempts: 3
  fallback_providers:
    - provider: anthropic
      model: claude-3-5-sonnet-20241022
    - provider: groq
      model: llama-3.1-70b-versatile
```

If OpenAI is unavailable or rate-limited, Crystal automatically falls back to Anthropic, then Groq — transparent to your application code.

#### Input Guardrails

```yaml
guardrails:
  input:
    max_length: 4000
    block_patterns:
      - "ignore previous instructions"
      - "you are now"
    topics:
      block: [violence, illegal_activity]
    pii:
      detect: true
      action: redact             # redact | block | warn
```

#### Output Guardrails

```yaml
guardrails:
  output:
    max_length: 2000
    block_patterns:
      - "I cannot help"          # retry if model refuses
    content_filter:
      enabled: true
      threshold: 0.8
```

#### Further Reading

- [Advanced Guide](./advanced.md#retry-and-fallback)
- [Providers Guide](./providers.md)

---

### 2.6 · Providers & Model Selection

**Duration:** ~10 min
**Prerequisites:** Completed 1.3

#### What You'll Learn

- Capabilities and best models for each provider
- Per-agent provider override
- OpenAI-compatible endpoints (Ollama, Azure)
- Multimodal support by provider

#### Provider Comparison

| Provider | Best For | Fastest Model | Most Capable Model |
|----------|----------|---------------|--------------------|
| **OpenAI** | General purpose, vision | `gpt-4o-mini` | `gpt-4o` |
| **Anthropic** | Long context, coding, reasoning | `claude-3-haiku-20240307` | `claude-3-5-sonnet-20241022` |
| **Groq** | Ultra-low latency | `llama-3.1-8b-instant` | `llama-3.1-70b-versatile` |
| **Google** | Multimodal, code | `gemini-1.5-flash` | `gemini-1.5-pro` |
| **Together AI** | Open-source models | `mistral-7b-instruct` | `mixtral-8x22b-instruct` |

#### Per-Agent Override

```yaml
# agents/fast-classifier.yaml — uses Groq for speed
name: fast-classifier
provider: groq
model: llama-3.1-8b-instant
temperature: 0.1

# agents/deep-analyst.yaml — uses Anthropic for reasoning
name: deep-analyst
provider: anthropic
model: claude-3-5-sonnet-20241022
temperature: 0.7
max_tokens: 8192
```

#### Ollama (local models)

```yaml
providers:
  openai:
    base_url: http://localhost:11434/v1
    api_key: ollama             # required but ignored by Ollama

# agents/local-agent.yaml
name: local-agent
provider: openai               # uses the Ollama-compatible endpoint
model: llama3.2
```

#### Further Reading

- [Providers Guide](./providers.md)
- [Configuration Guide](./configuration.md)

---

### 2.7 · Multimodal: Images, Audio & Vision

**Duration:** ~13 min
**Prerequisites:** Completed 2.6

#### What You'll Learn

- Send images to vision models
- Analyze documents with vision
- Handle audio transcription
- Generate images via tool

#### Vision: Analyze an Image

```typescript
import { Crystral } from '@crystralai/sdk';
import * as fs from 'fs';

const crystral = new Crystral();
const agent = await crystral.getAgent('vision-analyst');

const imageBuffer = fs.readFileSync('./receipt.jpg');

const result = await agent.run({
  input: 'Extract all line items from this receipt',
  images: [
    {
      data: imageBuffer.toString('base64'),
      media_type: 'image/jpeg'
    }
  ]
});

console.log(result.output);
```

#### Vision Agent Config

```yaml
# agents/vision-analyst.yaml
name: vision-analyst
provider: openai
model: gpt-4o             # vision-capable model
system_prompt: |
  You analyze images precisely. Extract all text and structured data
  visible in the image.
capabilities:
  vision: true
```

#### Multimodal Support Matrix

| Provider | Vision | Documents | Audio |
|----------|--------|-----------|-------|
| OpenAI | ✓ gpt-4o, gpt-4-turbo | ✓ | ✓ whisper |
| Anthropic | ✓ claude-3-* | ✓ | — |
| Google | ✓ gemini-1.5-* | ✓ | ✓ |
| Groq | — | — | ✓ whisper |
| Together AI | — | — | — |

#### Further Reading

- [Providers Guide](./providers.md#multimodal-support)
- [Advanced Guide](./advanced.md#multimodal)

---

## Track 3 — Integrations

### 3.1 · Server-Side SDK (@crystralai/sdk)

**Duration:** ~15 min
**Prerequisites:** Completed Track 1

#### What You'll Learn

- Full `Crystral`, `Agent`, and `Workflow` API
- Streaming with async iterators
- Session management
- Express.js integration with SSE streaming
- Typed error handling

#### Core Classes

```typescript
import { Crystral, Agent, Workflow, CrystalError } from '@crystralai/sdk';

const crystral = new Crystral({
  configPath: './crystral.config.yaml', // optional, auto-discovered
  env: 'production'
});

// Get an agent
const agent: Agent = await crystral.getAgent('assistant');

// Get a workflow
const workflow: Workflow = await crystral.getWorkflow('research-pipeline');
```

#### Single-Shot Run

```typescript
const result = await agent.run({
  input: 'Summarize the following text...',
  variables: { tone: 'professional' }
});

console.log(result.output);        // string
console.log(result.usage.tokens);  // { prompt: 120, completion: 340 }
console.log(result.latency_ms);    // 1240
```

#### Streaming

```typescript
const stream = await agent.stream({ input: 'Write a haiku about Node.js' });

for await (const chunk of stream) {
  process.stdout.write(chunk.delta); // incremental text
}

const final = await stream.result();
console.log(final.usage);
```

#### Express.js with SSE Streaming

```typescript
import express from 'express';
import { Crystral } from '@crystralai/sdk';

const app = express();
const crystral = new Crystral();
app.use(express.json());

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const agent = await crystral.getAgent('assistant');
  const session = await agent.getSession(sessionId);
  const stream = await session.stream({ input: message });

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ delta: chunk.delta })}\n\n`);
  }

  const result = await stream.result();
  res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\n\n`);
  res.end();
});

app.listen(3000);
```

#### Error Handling

```typescript
import { CrystalError, ProviderError, ValidationError } from '@crystralai/sdk';

try {
  const result = await agent.run({ input: userInput });
} catch (err) {
  if (err instanceof ProviderError) {
    console.error('Provider failed:', err.provider, err.code);
  } else if (err instanceof ValidationError) {
    console.error('Config invalid:', err.field, err.message);
  } else if (err instanceof CrystalError) {
    console.error('Crystal error:', err.message);
  }
}
```

#### Further Reading

- [SDK Guide](./sdk.md)
- [Workflows Guide](./workflows.md)

---

### 3.2 · Browser SDK (@crystralai/client) — BYOK

**Duration:** ~12 min
**Prerequisites:** JavaScript/React basics

#### What You'll Learn

- The BYOK (Bring Your Own Key) model
- Zero-dependency browser SDK
- Streaming in the browser
- React integration
- Security considerations

#### What is BYOK?

BYOK means the user supplies their own LLM provider API key, which the browser sends directly to the provider — bypassing your server entirely. This eliminates server-side LLM costs and removes the need for a backend at all, at the cost of exposing the API key in the browser.

> **Warning:** Only use BYOK when users can reasonably be trusted with their own keys (e.g., internal tools, developer dashboards). For public-facing apps, proxy through your server using `@crystralai/sdk` instead.

#### Install

```bash
npm install @crystralai/client
```

#### Basic Usage

```typescript
import { CrystalClient } from '@crystralai/client';

const client = new CrystalClient({
  provider: 'openai',
  apiKey: userSuppliedKey,   // from a settings form, for example
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.'
});

const result = await client.run({ input: 'Hello!' });
console.log(result.output);
```

#### Streaming in React

```tsx
import { useState } from 'react';
import { CrystalClient } from '@crystralai/client';

function Chat({ apiKey }: { apiKey: string }) {
  const [output, setOutput] = useState('');

  const client = new CrystalClient({
    provider: 'openai',
    apiKey,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.'
  });

  async function send(message: string) {
    setOutput('');
    const stream = await client.stream({ input: message });
    for await (const chunk of stream) {
      setOutput(prev => prev + chunk.delta);
    }
  }

  return (
    <div>
      <button onClick={() => send('What is React?')}>Ask</button>
      <p>{output}</p>
    </div>
  );
}
```

#### Session Persistence

```typescript
import { CrystalClient, LocalStorageAdapter } from '@crystralai/client';

const client = new CrystalClient({
  provider: 'anthropic',
  apiKey: userKey,
  model: 'claude-3-haiku-20240307',
  storage: new LocalStorageAdapter('chat-session') // persists across reloads
});
```

#### Further Reading

- [Client Guide](./client.md)
- [SDK Guide](./sdk.md) — for server-side alternative

---

### 3.3 · React Chat App from Scratch

**Duration:** ~15 min
**Prerequisites:** Completed 3.1

#### What You'll Learn

- Clone and run the `react-chat` example
- Express backend with streaming endpoint
- React frontend consuming the SSE stream
- Adding a tool and seeing it in the chat UI
- Deployment

#### Project Structure

```
examples/react-chat/
├── server/
│   ├── src/
│   │   ├── index.ts          # Express server
│   │   └── agents/
│   │       └── chat.yaml     # Agent config
│   └── package.json
└── client/
    ├── src/
    │   ├── App.tsx           # Root component
    │   ├── hooks/useChat.ts  # Streaming hook
    │   └── components/
    │       ├── ChatWindow.tsx
    │       └── MessageBubble.tsx
    └── package.json
```

#### Run It

```bash
cd examples/react-chat

# Server
cd server && npm install
echo "OPENAI_API_KEY=sk-..." >> .env
npm run dev   # http://localhost:3000

# Client (new terminal)
cd client && npm install
npm run dev   # http://localhost:5173
```

#### The Streaming Hook

```typescript
// client/src/hooks/useChat.ts
export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

  async function send(input: string) {
    setStreaming(true);
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, sessionId })
    });

    const reader = response.body!.getReader();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      // parse SSE and update messages...
    }
    setStreaming(false);
  }

  return { messages, send, streaming };
}
```

#### Further Reading

- [SDK Guide](./sdk.md)
- [Examples Guide](./examples.md#react-chat)

---

### 3.4 · CLI Workflows & Automation

**Duration:** ~8 min
**Prerequisites:** Completed Track 1

#### What You'll Learn

- Run agents from npm scripts and shell pipelines
- Use agents in GitHub Actions
- Scheduled agent runs with cron
- Dry-run and validation

#### npm Script Runner

```json
// package.json
{
  "scripts": {
    "review": "ts-node scripts/review.ts",
    "summarize": "ts-node scripts/summarize.ts",
    "validate": "ts-node scripts/validate-config.ts"
  }
}
```

```typescript
// scripts/review.ts
import { Crystral } from '@crystralai/sdk';
import { readFileSync } from 'fs';

const crystral = new Crystral();
const agent = await crystral.getAgent('code-reviewer');
const code = readFileSync(process.argv[2], 'utf-8');
const result = await agent.run({ input: code });
console.log(result.output);
process.exit(0);
```

```bash
npm run review -- src/index.ts
```

#### GitHub Actions

```yaml
# .github/workflows/review.yml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm run review -- ${{ github.event.pull_request.changed_files }}
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

#### Scheduled Agents

```typescript
// scripts/daily-digest.ts — run via system cron or GitHub Actions schedule
import { Crystral } from '@crystralai/sdk';

const crystral = new Crystral();
const workflow = await crystral.getWorkflow('daily-digest');
const result = await workflow.run({ input: new Date().toDateString() });

// Send result to Slack, email, etc.
await sendSlackMessage(result.output);
```

#### Dry Run

```typescript
const result = await agent.run({
  input: 'Hello',
  dry_run: true     // validates config and prompt, does not call provider
});
console.log(result.prompt);  // see the full assembled prompt
```

#### Further Reading

- [CLI Reference](./cli-reference.md)
- [SDK Guide](./sdk.md)

---

## Track 4 — Real-World Projects

### 4.1 · Build a Code Review Bot

**Duration:** ~20 min
**Prerequisites:** Completed Tracks 1–3

#### What You'll Learn

- 4-agent pipeline: security, performance, style, report
- Structured JSON output for each review section
- GitHub Actions integration on every PR
- Reading source files with a JavaScript tool

#### Architecture

```
Pull Request
     │
     ▼
┌─────────────────────────────────────────┐
│           code-review workflow           │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │ security │  │   perf   │  (parallel) │
│  │ auditor  │  │ analyzer │             │
│  └────┬─────┘  └────┬─────┘             │
│       │              │                  │
│  ┌────▼─────┐  ┌─────▼────┐             │
│  │  style   │  │  report  │ (sequential)│
│  │ checker  │  │  writer  │             │
│  └──────────┘  └──────────┘             │
└─────────────────────────────────────────┘
```

#### Code Reader Tool

```yaml
# tools/read-file.yaml
name: read_file
type: javascript
description: Read a source file from the repository
parameters:
  - name: path
    type: string
    required: true
code: |
  const fs = require('fs');
  const path = require('path');
  const safePath = path.resolve(process.cwd(), context.params.path);
  if (!safePath.startsWith(process.cwd())) {
    return { error: 'Path traversal not allowed' };
  }
  return { content: fs.readFileSync(safePath, 'utf-8') };
```

#### Workflow

```yaml
# workflows/code-review.yaml
name: code-review
steps:
  - parallel:
    - agent: security-auditor
      output_as: security_findings
    - agent: perf-analyzer
      output_as: perf_findings
    - agent: style-checker
      output_as: style_findings

  - agent: report-writer
    input: |
      Security: {{security_findings}}
      Performance: {{perf_findings}}
      Style: {{style_findings}}
    output_as: review_report
```

#### Run in CI

```typescript
// scripts/review-pr.ts
import { Crystral } from '@crystralai/sdk';

const crystral = new Crystral();
const workflow = await crystral.getWorkflow('code-review');

const changedFiles = process.env.CHANGED_FILES!.split('\n');
const result = await workflow.run({
  input: `Review these files: ${changedFiles.join(', ')}`
});

console.log(result.output);  // Post to PR as a comment
```

#### Further Reading

- [Examples Guide](./examples.md#code-review)
- [Workflows Guide](./workflows.md)
- [Tools Guide](./tools.md)

---

### 4.2 · Build an Ad Creative Generator

**Duration:** ~20 min
**Prerequisites:** Completed 2.2, 2.4

#### What You'll Learn

- Multi-agent creative pipeline
- Structured output for ad variants
- Vision: brand image analysis
- Response caching for cost control
- NestJS backend + Next.js frontend

#### Architecture

```
User Input (brand brief)
        │
        ▼
┌───────────────┐
│  Strategist   │  → target audience, key messages, tone
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Copywriter   │  → 3 ad variants (headline + body + CTA)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Designer    │  → layout specs, color palette (vision-based)
└───────────────┘
```

#### Structured Output for Ad Variants

```yaml
# agents/copywriter.yaml
name: copywriter
model: gpt-4o
output:
  type: object
  properties:
    variants:
      type: array
      minItems: 3
      maxItems: 3
      items:
        type: object
        properties:
          headline: { type: string, maxLength: 60 }
          body: { type: string, maxLength: 150 }
          cta: { type: string, maxLength: 25 }
          tone: { type: string, enum: [professional, playful, urgent, inspirational] }
        required: [headline, body, cta, tone]
```

#### Response Caching

```yaml
# agents/strategist.yaml
name: strategist
model: gpt-4o
cache:
  enabled: true
  ttl_seconds: 3600    # cache identical prompts for 1 hour
  key_fields: [input]  # cache key based on input only
```

#### Full Example

```bash
cd examples/ad-template-generator
cp .env.example .env  # add your API keys

# Backend
cd server && npm install && npm run start:dev

# Frontend
cd client && npm install && npm run dev
```

#### Further Reading

- [Examples Guide](./examples.md#ad-template-generator)
- [Advanced Guide](./advanced.md#response-caching)
- [Workflows Guide](./workflows.md)

---

### 4.3 · Build a RAG-Powered Knowledge Base

**Duration:** ~20 min
**Prerequisites:** Completed 2.1, 3.1

#### What You'll Learn

- Index large document collections with external vector stores
- Multi-collection agent (docs + code + runbooks)
- Citation mode: responses include source document and chunk
- Slack bot integration

#### External Vector Store (Pinecone)

For large corpora (>50k chunks), use an external vector store:

```yaml
# collections/company-docs.yaml
name: company-docs
provider: pinecone
pinecone:
  api_key: ${PINECONE_API_KEY}
  environment: us-east-1-aws
  index: company-knowledge
embedding_provider: openai
embedding_model: text-embedding-3-large
chunk_size: 1024
chunk_overlap: 128
source_dir: ./docs/
```

#### Multi-Collection Agent

```yaml
# agents/knowledge-base.yaml
name: knowledge-base
model: gpt-4o
system_prompt: |
  You are an internal knowledge base assistant. Answer questions
  using the documentation, code, and runbooks available.
  Always cite your sources with the document name and section.
rag:
  collections:
    - company-docs
    - codebase-index
    - runbooks
  match_count: 8
  match_threshold: 0.72
```

#### Index All Collections

```bash
npx crystral index company-docs   # ~5,000 documents
npx crystral index codebase-index # ~3,000 source files
npx crystral index runbooks       # ~200 runbook pages
```

#### Slack Bot Integration

```typescript
// slack-bot.ts
import { App } from '@slack/bolt';
import { Crystral } from '@crystralai/sdk';

const app = new App({ token: process.env.SLACK_BOT_TOKEN! });
const crystral = new Crystral();

app.message(async ({ message, say }) => {
  const agent = await crystral.getAgent('knowledge-base');
  const session = await agent.getSession(`slack-${message.user}`);
  const result = await session.run({ input: (message as any).text });
  await say(result.output);
});

app.start(3000);
```

#### Further Reading

- [RAG Guide](./rag.md)
- [Examples Guide](./examples.md)
- [SDK Guide](./sdk.md)

---

## Release Schedule

| Phase | Videos | When |
|-------|--------|------|
| **Launch** | 1.1, 1.2, 1.4, 3.3 | Day 0 |
| **Month 1** | 1.3, 1.5, 2.1, 2.2, 3.1 | Weeks 2–4 |
| **Month 2** | 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 3.4 | Weeks 5–8 |
| **Month 3** | 4.1, 4.2, 4.3 | Weeks 9–12 |

---

## Video Format

Every video follows the same structure:

1. **Hook** (30 sec) — problem + what you'll build
2. **Concept** (1–2 min) — diagram or mental model
3. **Live Coding** (bulk) — terminal + editor side by side
4. **Result Demo** (1–2 min) — working end-to-end output
5. **Summary** (30 sec) — recap + link to next video

**Tools:** JetBrains Mono font, dark terminal theme (high contrast), chapter markers, source code linked in description.
