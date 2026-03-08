# Examples

Crystal AI ships with several example projects that demonstrate different integration patterns. Each example is a self-contained application you can run locally.

All examples live in the `examples/` directory at the root of the monorepo.

| Example | What It Demonstrates | Stack |
|---------|---------------------|-------|
| [React Chat](#react-chat) | SDK integration, Express backend, React frontend | Vite + React + Express + `@crystralai/sdk` |
| [Ad Template Generator](#ad-template-generator) | Multi-agent pipeline, structured output, Google provider | Next.js + NestJS + `@crystralai/core` |
| [Code Review](#code-review) | CLI-based multi-agent pipeline, `runAgent` API | TypeScript CLI + `@crystralai/core` |

---

## React Chat

**Path:** `examples/react-chat/`

A minimal full-stack chat application that connects a React frontend to a Crystal AI agent through an Express API server. This is the best starting point for understanding how to integrate Crystal AI into a web application.

### What It Demonstrates

- Using `@crystralai/sdk` to load and run agents from a Node.js server
- Session management (conversation history persists across messages)
- Inference log retrieval via `client.getLogs()`
- A clean React chat UI with real-time token usage display

### Prerequisites

- Node.js 18+
- pnpm
- An OpenAI API key

### Setup

1. **Install dependencies** from the monorepo root:

    ```bash
    pnpm install
    ```

2. **Build the core and SDK packages** (the example depends on workspace packages):

    ```bash
    pnpm build:core
    pnpm build:sdk
    ```

3. **Configure your API key.** Create a `.env` file in the example directory:

    ```bash
    cp examples/react-chat/.env.example examples/react-chat/.env
    ```

    Edit `examples/react-chat/.env` and set your OpenAI API key:

    ```
    OPENAI_API_KEY=sk-...
    ```

4. **Start the development servers:**

    ```bash
    cd examples/react-chat
    pnpm dev
    ```

    This runs both the Express API server (port 3001) and the Vite dev server concurrently.

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Key Files

#### Agent Configuration -- `agents/assistant.yaml`

```yaml
version: 1
name: assistant
provider: openai
model: gpt-4o-mini
system_prompt: |
  You are a helpful assistant. Be concise and friendly.
  Your task is to answer questions and help with tasks.
temperature: 0.7
max_tokens: 1024
```

This is a minimal agent config. It uses OpenAI's `gpt-4o-mini` model with a simple system prompt. No tools, no RAG -- just a conversational agent.

#### Server -- `server/index.ts`

The Express server initializes the Crystal AI SDK and exposes two endpoints:

- `POST /api/chat` -- Sends a message to the agent and returns the response with session ID and token usage.
- `GET /api/logs` -- Retrieves recent inference logs for the logs panel.

Key SDK usage:

```typescript
import Crystral from '@crystralai/sdk';

const client = new Crystral({ cwd: path.join(__dirname, '..') });

// Run the agent with session support
const result = await client.run('assistant', message, { sessionId });
```

#### Frontend -- `src/App.tsx`

A React component that manages chat state, sends messages to the API, displays responses, and shows a logs panel with per-request token counts, costs, and latency.

### Expected Behavior

- Type a message and press Enter to chat with the assistant
- Each response shows token usage (input/output/total) in the footer
- Click "Logs" to view inference logs with model, tokens, cost, and latency
- Click "New Chat" to start a fresh session

> **Tip:** Try changing the `model` in `agents/assistant.yaml` to `gpt-4o` or switching the `provider` to `anthropic` with `claude-sonnet-4-20250514` to see how easy it is to swap models.

---

## Ad Template Generator

**Path:** `examples/ad-template-generator/`

A production-grade application that generates social media ad templates using a multi-agent pipeline. This example showcases advanced Crystal AI features including structured JSON output, retry configuration, vision capabilities, caching, and multi-provider orchestration.

### What It Demonstrates

- Multi-agent pipeline: strategist, copywriter, and designer agents run sequentially
- `runAgent` function from `@crystralai/core` for direct agent execution
- Structured output with JSON schema validation
- Retry with exponential backoff
- Vision capabilities for reference image input
- Response caching
- `GoogleProvider` for Gemini API integration
- `Logger` from `@crystralai/core` for structured logging
- Multi-provider setup (Together AI for strategy, Google for design)

### Prerequisites

- Node.js 18+
- pnpm
- A Google AI (Gemini) API key
- A Together AI API key (for the strategist agent)

### Setup

1. **Install dependencies** from the monorepo root:

    ```bash
    pnpm install
    pnpm build:core
    ```

2. **Configure your API keys:**

    ```bash
    cp examples/ad-template-generator/.env.example examples/ad-template-generator/server/.env
    ```

    Edit `server/.env` and set your keys:

    ```
    GEMINI_API_KEY=your_gemini_api_key_here
    GOOGLE_API_KEY=your_gemini_api_key_here
    PORT=3001
    ```

    Also create a `.env` file at the monorepo root with your provider keys:

    ```
    GOOGLE_API_KEY=your_gemini_api_key_here
    TOGETHER_API_KEY=your_together_api_key_here
    ```

3. **Start the server:**

    ```bash
    cd examples/ad-template-generator/server
    pnpm dev
    ```

4. **Start the client** (in a new terminal):

    ```bash
    cd examples/ad-template-generator/client
    pnpm dev
    ```

5. Open [http://localhost:3000](http://localhost:3000).

### Key Files

#### Agent Configurations

The ad template generator uses four agents defined at the monorepo root in `agents/`:

| Agent | File | Provider/Model | Purpose |
|-------|------|----------------|---------|
| `ad-strategist` | `agents/ad-strategist.yaml` | Together / Llama 3.1 8B | Analyzes the brief and produces a creative strategy |
| `ad-copywriter` | `agents/ad-copywriter.yaml` | Together / Llama 3.1 8B | Writes ad copy based on the strategy |
| `ad-creative-director` | `agents/ad-creative-director.yaml` | -- | Reviews and refines creative output |
| `ad-template-generator` | `agents/ad-template-generator.yaml` | Google / Gemini 2.5 Flash | Generates HTML/Tailwind templates with structured JSON output |

The `ad-template-generator` agent is the most feature-rich example in the project. It uses:

```yaml
output:
  format: json
  strict: true
  schema:
    type: object
    required: [templates]
    properties:
      templates:
        type: array
        items:
          type: object
          required: [name, description, tags, colorPalette, previewHtml, reactCode]
          # ... full JSON schema for template structure

retry:
  max_attempts: 3
  backoff: exponential

capabilities:
  vision: true

cache:
  enabled: true
  ttl: 3600
```

#### Server -- `server/src/generation/generation.service.ts`

The NestJS service orchestrates the multi-agent pipeline:

1. **Strategist** -- Takes the user's brief and produces a creative strategy (target audience, tone, visual direction)
2. **Copywriter** -- Receives the brief + strategy and writes ad copy for each template
3. **Designer** -- Receives the brief + strategy + copy and generates structured HTML/Tailwind templates

Each step uses `runAgent()` from `@crystralai/core`:

```typescript
import { runAgent, GoogleProvider, Logger } from '@crystralai/core';

const strategyResult = await runAgent('ad-strategist', brief);
const copyResult = await runAgent('ad-copywriter', copyTask);
const designResult = await runAgent('ad-template-generator', designTask);
```

#### Client -- Next.js 15 + Tailwind CSS

The client provides a UI for entering ad briefs, viewing generated templates, editing text and colors in real-time, applying brand kits, and exporting templates as PNG/JPG/WebP images or MP4/WebM videos.

### Expected Behavior

- Enter an ad brief (product description, target audience, desired style)
- Optionally provide product context (name, tagline, audience, pricing)
- The pipeline generates multiple visually distinct ad templates
- Each template includes preview HTML, React code, color palette, and tags
- Templates can be edited live and exported as images or videos

---

## Code Review

**Path:** `examples/code-review/`

A CLI tool that performs automated code reviews using a four-agent pipeline. Point it at any codebase or file and it generates a comprehensive security, performance, and style review.

### What It Demonstrates

- Using `runAgent` directly from `@crystralai/core` (no SDK wrapper)
- Multi-agent sequential pipeline (four specialized reviewers)
- Running agents against arbitrary codebases (not just Crystal AI projects)
- Structured markdown report generation
- Configurable logging per agent

### Prerequisites

- Node.js 18+
- pnpm
- A Google AI (Gemini) API key (agents use the `google` provider)

### Setup

1. **Install dependencies** from the monorepo root:

    ```bash
    pnpm install
    pnpm build:core
    ```

2. **Configure your API key.** Create a `.env` file at the monorepo root:

    ```
    GOOGLE_API_KEY=your_gemini_api_key_here
    ```

3. **Run a review** from any project directory:

    ```bash
    cd examples/code-review
    pnpm review                    # Reviews the current directory
    ```

    Or point it at a specific path:

    ```bash
    npx tsx review.ts ../react-chat/src/    # Review a specific directory
    npx tsx review.ts path/to/file.ts       # Review a single file
    ```

### Key Files

#### Agent Configurations

The pipeline uses four agents defined at the monorepo root in `agents/`:

| Agent | File | Role |
|-------|------|------|
| `code-security-auditor` | `agents/code-security-auditor.yaml` | OWASP Top 10 vulnerabilities, injection, auth, secrets |
| `code-perf-analyzer` | `agents/code-perf-analyzer.yaml` | Complexity, N+1 queries, memory leaks, hot paths |
| `code-style-checker` | `agents/code-style-checker.yaml` | Naming, error handling, patterns, readability |
| `code-report-writer` | `agents/code-report-writer.yaml` | Synthesizes all reviews into a prioritized report |

All four agents use `google/gemini-2.5-flash` with low temperature (0.1-0.2) for consistent, precise analysis. The report writer has a higher `max_tokens: 8192` to accommodate the full synthesized report.

Example agent configuration (`agents/code-security-auditor.yaml`):

```yaml
version: 1
name: code-security-auditor
description: Audits code for security vulnerabilities.
provider: google
model: gemini-2.5-flash
temperature: 0.1
max_tokens: 4096
system_prompt: |
  You are a senior application security engineer
  specializing in OWASP Top 10 vulnerabilities.
  ...
logging:
  level: info
  trace: false
  export: stdout
```

#### Pipeline Script -- `review.ts`

The script:

1. Collects source files from the target path (supports `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.java`, `.rb`, `.rs`)
2. Bundles them into a single code block (truncates at ~60k characters to fit context limits)
3. Runs each specialist agent sequentially
4. Passes all three reviews to the report writer
5. Saves the final report as `code-review-report.md`

```typescript
import { runAgent } from '@crystralai/core';

const securityResult = await runAgent('code-security-auditor', codeBlock);
const perfResult = await runAgent('code-perf-analyzer', codeBlock);
const styleResult = await runAgent('code-style-checker', codeBlock);
const reportResult = await runAgent('code-report-writer', allReviews);
```

### Expected Output

The CLI displays a progress spinner for each step and outputs a summary:

```
  ╔════════════════════════════════════════════╗
  ║   Crystal AI -- Code Review Pipeline        ║
  ╚════════════════════════════════════════════╝

  Target  : .
  Files   : 5
  Size    : 12.3k chars

  Security audit      -- 2450 tokens
  Performance analysis -- 1890 tokens
  Style & quality      -- 2100 tokens
  Report written       -- 3200 tokens

  9.2s   |   9640 tokens
  Saved -> code-review-report.md
```

The generated `code-review-report.md` contains prioritized findings organized by severity: Security Critical, Quality Critical, Improvements, Nice-to-haves, and Positive Observations.

---

## Building Your Own Project

These examples demonstrate three integration patterns. Choose the one that fits your use case:

### Pattern 1: SDK Integration (React Chat)

Best for web applications. Use `@crystralai/sdk` for a clean, high-level API:

```typescript
import Crystral from '@crystralai/sdk';

const client = new Crystral();
const result = await client.run('my-agent', 'Hello!');
```

### Pattern 2: Core Library (Ad Template Generator)

Best for applications that need direct access to providers, logging, and utilities:

```typescript
import { runAgent, GoogleProvider, Logger } from '@crystralai/core';

const result = await runAgent('my-agent', 'Generate something');
```

### Pattern 3: CLI Pipeline (Code Review)

Best for developer tools and CI/CD integrations. Chain multiple `runAgent` calls:

```typescript
import { runAgent } from '@crystralai/core';

const step1 = await runAgent('analyzer', input);
const step2 = await runAgent('writer', step1.content);
```

### Tips for New Projects

1. **Start with a simple agent.** Create `agents/my-agent.yaml` with just `version`, `name`, `provider`, `model`, and `system_prompt`. Add tools and RAG later.

2. **Use `crystral.config.yaml`** at your project root. Crystal AI discovers agents relative to this file:

    ```yaml
    version: 1
    project: my-project
    ```

3. **Store API keys in `.env`**, not in YAML files. Crystal AI reads them automatically via the credential resolver.

4. **Use Studio for rapid iteration.** Run `crystral studio` to test agents interactively, view logs, and edit configs through the web UI.

5. **Add structured output** when you need predictable response formats. See the [ad-template-generator](#ad-template-generator) example for a comprehensive schema.

6. **Use multi-agent pipelines** for complex tasks. Break work into specialized agents (like the code review example) rather than asking one agent to do everything.

### Further Reading

- [Advanced Configuration](./advanced.md) -- Structured output, retry, guardrails, caching
- [Tools Guide](./tools.md) -- REST API, JavaScript, web search, and agent delegation tools
- [Architecture](../ARCHITECTURE.md) -- Deep dive into Crystal AI internals
- [Configuration Spec](../CONFIG_SPEC.md) -- Complete YAML schema reference
