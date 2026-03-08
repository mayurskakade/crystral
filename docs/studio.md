# Crystal Studio

Crystal Studio is a local development dashboard for Crystral that provides a visual interface for interacting with agents, browsing conversation sessions, inspecting tools, viewing inference logs, and managing your project configuration. It ships as the `@crystralai/studio` package and runs entirely on your machine -- no cloud services required.

---

## Installation

```bash
# npm
npm install @crystralai/studio

# pnpm
pnpm add @crystralai/studio
```

**Requirements:**

- Node.js 18 or later
- A Crystral project with an `agents/` directory and a `crystral.config.yaml` file

---

## Starting the Studio

### Programmatic usage

```typescript
import { startStudio } from '@crystralai/studio';

await startStudio({
  port: 4000,
  cwd: process.cwd(),
  openBrowser: true,
});
```

### Quick launch script

Create a `studio.mjs` file at your project root:

```javascript
import { startStudio } from '@crystralai/studio';

startStudio({ port: 4000, openBrowser: true, cwd: process.cwd() });
```

Then run:

```bash
node studio.mjs
```

The studio will start and print a banner:

```
  Crystral Studio
  Local:   http://127.0.0.1:4000
  Project: /path/to/your/project
```

### `StudioOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4000` | Port to listen on. |
| `host` | `string` | `'127.0.0.1'` | Host to bind to. |
| `cwd` | `string` | `process.cwd()` | Working directory for config resolution (must contain `agents/`). |
| `openBrowser` | `boolean` | `false` | Automatically open the dashboard in the default browser on start. |

---

## Architecture

Crystal Studio is built with [Hono](https://hono.dev), a lightweight web framework. It serves a single-file HTML/CSS/JS dashboard (no frontend build step required) along with a REST API backed by `@crystralai/core`.

```
Browser (dashboard UI)
  |
  v
Hono HTTP Server (port 4000)
  ├── GET  /              -> Dashboard HTML
  ├── GET  /api/health    -> Health check
  ├── /api/agents/*       -> Agent CRUD + run/stream
  ├── /api/tools/*        -> Tool inspection
  ├── /api/workflows/*    -> Workflow listing
  ├── /api/sessions/*     -> Session browsing
  ├── /api/logs/*         -> Inference log queries
  ├── /api/rag/*          -> RAG collection stats
  ├── /api/providers/*    -> Provider information
  ├── /api/prompts/*      -> Prompt template management
  ├── /api/tests/*        -> Test suite execution
  ├── /api/validate/*     -> YAML validation
  └── /api/schedules/*    -> Schedule management
```

---

## Dashboard Sections

The Studio dashboard features a dark-themed sidebar navigation with the following sections:

### Agents

The primary section of the dashboard. Lists all agents discovered in your `agents/` directory with their provider, model, and tool count.

**Capabilities:**

- View agent configuration details (provider, model, system prompt, tools, RAG settings)
- Create new agents with a visual form (name, provider, model, system prompt, temperature, tools)
- Edit existing agent configuration
- Delete agents
- Run agents interactively with a chat interface
- Stream responses in real time via Server-Sent Events (SSE)
- View tool call details inline during conversation

### Tools

Lists all tools defined in your `tools/` directory.

**Capabilities:**

- View tool name, type (`rest_api`, `javascript`, `web_search`, `agent`), and description
- Inspect full tool configuration including parameters

### Workflows

Lists all workflows defined in your `workflows/` directory.

**Capabilities:**

- View workflow name, description, and orchestrator configuration
- Inspect agent references and delegation structure

### Sessions

Browse all conversation sessions stored in the local SQLite database.

**Capabilities:**

- List sessions with optional agent name filter
- View full message history for any session (system, user, assistant, tool messages)
- Delete sessions

### Logs

View inference logs for all agent runs.

**Capabilities:**

- Filter logs by agent name
- Set a time window with the `since` parameter
- Limit the number of returned entries
- View token usage, duration, and model information per run

### RAG

Browse RAG collections in your project.

**Capabilities:**

- List all collections with embedding provider, model, and chunk size
- View collection statistics (chunk count, document count, last indexed timestamp)

### Prompts

Manage reusable prompt templates.

**Capabilities:**

- List all prompt templates from `prompts/` directory
- View and inspect template configuration

### Tests

Run and view test suites.

**Capabilities:**

- List test suites from `tests/` directory
- Execute test suites against their target agents
- View pass/fail results

### Validation

Validate your project configuration.

**Capabilities:**

- Run schema validation across all YAML files (agents, tools, workflows, prompts, tests, schedules)
- View per-file validation results with error details

### Schedules

View configured schedules.

**Capabilities:**

- List all schedules from `schedules/` directory
- Inspect schedule configuration

### Providers

View information about configured LLM providers.

---

## REST API Reference

The Studio exposes a REST API that the dashboard UI consumes. You can also call these endpoints directly for automation or integration.

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents with summary info. |
| `GET` | `/api/agents/:name` | Get full agent config. |
| `POST` | `/api/agents` | Create a new agent (JSON body with name, provider, model, etc.). |
| `PUT` | `/api/agents/:name` | Update an existing agent. |
| `DELETE` | `/api/agents/:name` | Delete an agent YAML file. |
| `POST` | `/api/agents/:name/run` | Run an agent (JSON body: `{message, sessionId?, variables?}`). |
| `POST` | `/api/agents/:name/stream` | Run with SSE streaming (same body as run). |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tools` | List all tools with type and description. |
| `GET` | `/api/tools/:name` | Get full tool config. |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/workflows` | List all workflows. |
| `GET` | `/api/workflows/:name` | Get full workflow config. |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sessions?agent=name` | List sessions, optionally filtered by agent. |
| `GET` | `/api/sessions/:id/messages` | Get session details and message history. |
| `DELETE` | `/api/sessions/:id` | Delete a session. |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/logs?agent=name&limit=50&since=ISO` | Query inference logs with optional filters. |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (returns `{status: 'ok', cwd}`). |
| `GET` | `/api/rag` | List RAG collections. |
| `GET` | `/api/providers` | List provider information. |
| `GET` | `/api/prompts` | List prompt templates. |
| `POST` | `/api/tests/:name/run` | Run a test suite. |
| `POST` | `/api/validate` | Validate all project YAML files. |
| `GET` | `/api/schedules` | List schedules. |

---

## Embedding in an Existing Server

If you already have an HTTP server, you can embed the Studio Hono app without starting a separate process:

```typescript
import { createStudioServer } from '@crystralai/studio';

const studioApp = createStudioServer({ cwd: '/path/to/project' });

// Mount studioApp.fetch in your existing server
// Example with Node.js http:
import { serve } from '@hono/node-server';
serve({ fetch: studioApp.fetch, port: 4000 });
```

### `createStudioServer(options?)`

Returns the Hono app instance without starting the server. Accepts the same options as `startStudio` (except `openBrowser` has no effect).

---

## Configuration

Studio settings can be configured in your `crystral.config.yaml`:

```yaml
version: 1
project: my-project
studio:
  port: 4000
  open_browser: true
```

---

## Development Mode

For contributing to the Studio or customizing the dashboard:

```bash
# From the monorepo root
pnpm --filter @crystralai/studio build

# Then launch
node studio.mjs
```

The dashboard UI is a single TypeScript file at `packages/studio/src/ui/dashboard.ts` that returns a complete HTML string. Changes require rebuilding the studio package.

> **Tip:** The Studio uses CORS headers configured for `localhost:4000` and `127.0.0.1:4000`. If you change the port, the CORS configuration in `packages/studio/src/server.ts` may need updating.

---

## SSE Streaming Protocol

When using the `/api/agents/:name/stream` endpoint, the Studio uses Server-Sent Events with the following event types:

| Event | Data Shape | Description |
|-------|-----------|-------------|
| `chunk` | `{type: 'chunk', content: string}` | A token from the model's response. |
| `tool_call` | `{type: 'tool_call', name: string, args: object}` | A tool is about to be executed. |
| `tool_result` | `{type: 'tool_result', name: string, result: object}` | A tool has finished executing. |
| `done` | `{type: 'done', content, sessionId, usage, durationMs}` | The run is complete. |

Example client-side consumption:

```typescript
const response = await fetch('/api/agents/assistant/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  // Parse SSE events from text
}
```
