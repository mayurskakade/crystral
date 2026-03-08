# Configuration

Crystral uses YAML as its configuration language for all resource definitions. YAML was chosen because it produces meaningful diffs in git, is language-agnostic, is human-editable without a build step, and supports inline comments with `#`.

This guide covers project configuration, file discovery, credentials, provider setup, environment variables, and directory conventions. For the full canonical schema specification, see [CONFIG_SPEC.md](../CONFIG_SPEC.md).

---

## Project Config

Every Crystral project requires a `crystral.config.yaml` file at its root. The SDK locates the project root by walking up directories from the current working directory until it finds this file.

```yaml
version: 1
project: my-project
studio:
  port: 4000
  open_browser: true
  host: 127.0.0.1
```

### Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | Yes | -- | Schema version. Must be `1`. |
| `project` | string | Yes | -- | Project name. 1-64 characters, `[a-zA-Z0-9_-]` only. Used in Studio and logs. |
| `studio.port` | integer | No | `4000` | Port for the Studio HTTP server. Range: 1024-65535. |
| `studio.open_browser` | boolean | No | `true` | Whether the Studio command opens the browser automatically. |
| `studio.host` | string | No | `127.0.0.1` | Host binding for the Studio server. Use `0.0.0.0` to expose to the network. |

> **Warning:** Setting `studio.host` to `0.0.0.0` exposes the Studio dashboard to all network interfaces. Only use this in trusted networks.

### Minimal config

The only required fields are `version` and `project`:

```yaml
version: 1
project: my-project
```

---

## File Discovery

Crystral uses convention-based file discovery. Each resource type has a dedicated directory, and the SDK scans these directories automatically.

### Project root detection

The SDK walks up directories from the current working directory until it finds `crystral.config.yaml`. This is the project root. If the file is not found, the current directory is used as root with a warning.

```
/home/user/my-project/
├── crystral.config.yaml   <-- project root
├── agents/
│   └── support.yaml
└── src/
    └── app.ts             <-- SDK called from here
                               walks up, finds crystral.config.yaml
                               project root = /home/user/my-project/
```

### Agent discovery

All `.yaml` and `.yml` files in `<project-root>/agents/` are treated as agent definitions.

- Subdirectories are **not** scanned recursively
- Dot files (starting with `.`) are skipped
- Files that fail YAML parsing produce a warning during list operations, but raise an error when loaded by name

### Tool discovery

Same rules as agent discovery, applied to `<project-root>/tools/`.

### Workflow discovery

Same rules as agent discovery, applied to `<project-root>/workflows/`.

### RAG collection discovery

All **directories** inside `<project-root>/rag/` are treated as RAG collections. The collection name is the directory name. Files placed directly inside `rag/` (not in a subdirectory) are ignored.

### Name-to-file resolution

When you load a resource by name (e.g. `client.run('support-bot', ...)`), the SDK resolves it by trying:

1. `<project-root>/agents/support-bot.yaml`
2. `<project-root>/agents/support-bot.yml`
3. Raises `AgentNotFoundError`

> **Note:** The `name` field inside the YAML file must match the filename without extension. An agent at `agents/support-bot.yaml` must have `name: support-bot`. A mismatch produces a `ValidationError`.

---

## Credentials and API Keys

Crystral supports three methods for providing API keys, resolved in priority order (first match wins):

### Resolution order

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | Process environment variable | `export OPENAI_API_KEY=sk-...` |
| 2 | Project `.env` file | `OPENAI_API_KEY=sk-...` in `<project-root>/.env` |
| 3 (lowest) | Global credentials file | `~/.crystalai/credentials` |

### Environment variables

Set the API key as an environment variable in your shell or CI/CD pipeline:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

### Project .env file

Create a `.env` file in your project root. The SDK uses dotenv-compatible parsing:

```bash
# .env
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
GROQ_API_KEY=gsk_your-key-here
GOOGLE_API_KEY=AIzaSy-your-key-here
TOGETHER_API_KEY=your-key-here
BRAVE_API_KEY=BSA-your-key-here
```

> **Warning:** Never commit your `.env` file to version control. Add it to `.gitignore`.

### Global credentials file

The global credentials file at `~/.crystalai/credentials` uses INI format:

```ini
[openai]
api_key = sk-your-key-here

[anthropic]
api_key = sk-ant-your-key-here

[groq]
api_key = gsk_your-key-here

[google]
api_key = AIzaSy-your-key-here

[together]
api_key = your-key-here

[brave]
api_key = BSA-your-key-here
```

This file is created with mode `0600` (owner read/write only). On Unix systems, the SDK refuses to read it if permissions are wider than `0600`.

### Environment variable names

Each provider maps to a specific environment variable name:

| Provider | Environment Variable |
|----------|---------------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `google` | `GOOGLE_API_KEY` |
| `together` | `TOGETHER_API_KEY` |
| `brave` (web search) | `BRAVE_API_KEY` |

### Missing credentials error

If no credential is found at any priority level, the SDK produces a detailed error:

```
No API key found for provider 'openai'.

Tried:
  1. Environment variable OPENAI_API_KEY -- not set
  2. Project .env file -- not found or key not in file
  3. ~/.crystalai/credentials -- provider section not found

To fix, run one of:
  export OPENAI_API_KEY=your-key
  echo "OPENAI_API_KEY=your-key" >> .env
```

---

## Provider Configuration

### Supported providers

| Provider | Value | Chat Models | Embedding Models |
|----------|-------|-------------|------------------|
| OpenAI | `openai` | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | text-embedding-3-small, text-embedding-3-large |
| Anthropic | `anthropic` | claude-opus-4, claude-sonnet-4, claude-haiku | -- |
| Groq | `groq` | llama-3, mixtral, gemma | -- |
| Google | `google` | gemini-1.5-pro, gemini-1.5-flash | text-embedding-004 |
| Together AI | `together` | llama-3, mistral, qwen | -- |

### Setting a provider in agent YAML

The `provider` field is a lowercase string enum. The `model` field is a free-form string passed directly to the provider API:

```yaml
provider: openai
model: gpt-4o
```

> **Tip:** The `model` field is not validated against a list of known models, since providers add new models frequently. If you specify an invalid model name, the provider API will return an error at runtime.

### OpenAI-compatible servers

To use an OpenAI-compatible server (Ollama, vLLM, LM Studio), set the `openai` provider with a custom base URL via the extension field:

```yaml
version: 1
name: local-agent
provider: openai
model: llama3
x-provider-base-url: http://localhost:11434/v1
system_prompt: You are a helpful assistant.
```

> **Note:** The `x-provider-base-url` field is a v1 extension. In v2, this will become a first-class `provider.base_url` field.

---

## Agent Configuration

### Full schema

```yaml
version: 1                          # integer, required
name: support-agent                 # string, required, must match filename
description: Customer support agent # string, optional

provider: openai                    # string, required (openai|anthropic|groq|google|together)
model: gpt-4o                       # string, required

system_prompt: |                    # string, optional, multiline
  You are a helpful support agent.
  Customer tier: {customer_tier}

temperature: 0.7                    # number, optional, default 1.0, range 0.0-2.0
max_tokens: 4096                    # integer, optional, default 4096, range 1-1000000
top_p: 1.0                          # number, optional, default 1.0, range 0.0-1.0
presence_penalty: 0.0               # number, optional, default 0.0, range -2.0-2.0
frequency_penalty: 0.0              # number, optional, default 0.0, range -2.0-2.0
stop_sequences:                     # list of strings, optional
  - "END"

tools:                              # list of strings, optional
  - get-ticket
  - calculate-price

rag:                                # object, optional
  collections:                      # list of strings, required if rag is set
    - product-docs
  embedding_provider: openai        # string, required if rag is set
  embedding_model: text-embedding-3-small  # string, required if rag is set
  match_threshold: 0.7              # number, optional, default 0.7, range 0.0-1.0
  match_count: 5                    # integer, optional, default 5, range 1-50

mcp:                                # list of MCP server configs, optional
  - transport: stdio
    name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
  - transport: sse
    name: github
    url: http://localhost:3000/mcp
```

### System prompt variables

The `system_prompt` field supports `{variable_name}` template syntax. Variables are substituted at runtime from the `variables` option passed to `agent.run()`:

```typescript
const result = await client.run('support-agent', 'Help me with my order', {
  variables: { customer_tier: 'premium' },
});
```

Unknown variables are left as-is (no error is raised).

### Tool references

The `tools` list contains tool names. Each name must correspond to a file at `tools/<name>.yaml`. Tools are verified when the agent runs, not when the config is parsed:

- In default mode, a missing tool produces a warning
- With `CRYSTALAI_STRICT=1` or the `x-strict-tools: true` extension, a missing tool raises an error

### RAG configuration

The `rag` section attaches document collections to the agent. When set, all three fields (`collections`, `embedding_provider`, `embedding_model`) are required:

```yaml
rag:
  collections:
    - product-docs
    - support-runbooks
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_threshold: 0.75
  match_count: 4
```

---

## Tool Configuration

Tools are defined in `tools/<name>.yaml`. All tools share a common set of fields, with additional fields specific to each type.

### Common fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | Yes | Schema version. Must be `1`. |
| `name` | string | Yes | Tool name. Must match filename. |
| `description` | string | Yes | Tool description shown to the LLM. Max 512 characters. Write as a short imperative sentence. |
| `type` | string | Yes | Tool type: `rest_api`, `javascript`, `web_search`, or `agent`. |
| `parameters` | list | Yes | Parameter definitions. Use `[]` for tools with no parameters. |

### Parameter schema

Each parameter entry supports the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Parameter name. Must match `[a-zA-Z_][a-zA-Z0-9_]*`. |
| `type` | string | Yes | Data type: `string`, `number`, `integer`, `boolean`, `array`, `object`. |
| `required` | boolean | No | Whether the parameter is required. Default: `false`. |
| `description` | string | No | Parameter description shown to the LLM. Recommended. |
| `default` | any | No | Default value. Must match the declared type. |
| `enum` | list | No | Restrict to specific values. |
| `minimum` | number | No | Minimum value (number/integer types only). |
| `maximum` | number | No | Maximum value (number/integer types only). |
| `pattern` | string | No | Regex pattern (string types only). |

### REST API tools

```yaml
version: 1
name: get-ticket
description: Fetch a support ticket by ID
type: rest_api
endpoint: https://api.example.com/tickets/{ticket_id}
method: GET
auth:
  type: bearer
  token_env: SUPPORT_API_KEY
headers:
  Accept: application/json
response_path: data.ticket
timeout_ms: 10000
parameters:
  - name: ticket_id
    type: string
    required: true
    description: The ticket ID to fetch
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `endpoint` | string | Yes | -- | URL with `{param}` placeholders. Must be HTTPS (HTTP triggers a warning). |
| `method` | string | No | `GET` | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`. |
| `auth.type` | string | No | `none` | Auth type: `bearer`, `basic`, `header`, `none`. |
| `auth.token_env` | string | Conditional | -- | Environment variable for the token. Required for `bearer` and `header` auth. |
| `headers` | map | No | -- | Additional HTTP headers. |
| `body_template` | string | No | -- | Request body with `{param}` interpolation. Only valid for `POST`/`PUT`/`PATCH`. |
| `response_path` | string | No | -- | Dot-notation path to extract from the JSON response. |
| `timeout_ms` | integer | No | `30000` | Request timeout in milliseconds. Range: 100-300000. |

### JavaScript tools

```yaml
version: 1
name: calculate
description: Evaluate a mathematical expression
type: javascript
timeout_ms: 5000
code: |
  const result = eval(args.expression);
  return { result: Number(result) };
parameters:
  - name: expression
    type: string
    required: true
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | string | Yes | -- | JavaScript function body. Receives `args` object. Must `return` a JSON-serializable value. `fetch` is available. |
| `runtime` | string | No | `node` | Runtime environment. Only `node` is supported in v1. |
| `timeout_ms` | integer | No | `5000` | Execution timeout. Range: 100-30000. |

### Web search tools

```yaml
version: 1
name: web-search
description: Search the web for current information
type: web_search
provider: brave
result_count: 5
safe_search: moderate
parameters:
  - name: query
    type: string
    required: true
    description: The search query
```

Requires `BRAVE_API_KEY` in your environment or credentials file.

### Agent tools (delegation)

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

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent_name` | string | Yes | -- | Name of the agent to delegate to. |
| `pass_context` | boolean | No | `false` | Whether to pass the parent agent's conversation context. |
| `timeout_ms` | integer | No | `120000` | Maximum execution time for the delegated agent. |
| `max_iterations` | integer | No | `10` | Maximum tool-call iterations for the delegated agent. |

---

## Workflow Configuration

Workflows orchestrate multiple agents. Define them in `workflows/<name>.yaml`:

```yaml
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

The orchestrator is a virtual agent powered by an LLM that decides how to route tasks to the specialist agents. There are no explicit graphs or state machines -- the LLM drives the workflow based on its system prompt and the task description.

---

## RAG Collection Configuration

RAG collection settings are defined in `rag/<name>/.crystalai-rag.yaml`. This file is optional; if absent, all defaults apply.

```yaml
version: 1
name: product-docs
embedding_provider: openai
embedding_model: text-embedding-3-large
chunk_size: 1024
chunk_overlap: 128
include:
  - "**/*.md"
  - "**/*.txt"
  - "**/*.pdf"
exclude:
  - "**/node_modules/**"
  - "**/.git/**"
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `embedding_provider` | string | `openai` | Provider for generating embeddings. |
| `embedding_model` | string | `text-embedding-3-small` | Embedding model identifier. |
| `chunk_size` | integer | `512` | Approximate chunk size in tokens. Range: 64-8192. |
| `chunk_overlap` | integer | `64` | Overlap between chunks. Must be less than `chunk_size`. |
| `include` | list | `["**/*.md", "**/*.txt", "**/*.pdf"]` | Glob patterns for files to include. |
| `exclude` | list | `[]` | Glob patterns for files to exclude. |

### Supported document formats

| Extension | Parser |
|-----------|--------|
| `.md`, `.mdx` | Plain text (markdown formatting preserved) |
| `.txt` | Plain text |
| `.pdf` | Text extraction (no OCR) |
| `.html`, `.htm` | Strip tags, extract text |

Other file formats are skipped with a warning.

---

## Directory Conventions

Here is the complete directory structure with all conventions:

```
my-project/
├── crystral.config.yaml           # project config (required)
│
├── agents/                        # agent definitions
│   ├── assistant.yaml             # name: assistant
│   ├── support-bot.yaml           # name: support-bot
│   └── researcher.yaml            # name: researcher
│
├── tools/                         # tool definitions
│   ├── get-ticket.yaml            # name: get-ticket
│   ├── calculate.yaml             # name: calculate
│   └── delegate-research.yaml     # name: delegate-research
│
├── workflows/                     # workflow definitions
│   └── content-pipeline.yaml      # name: content-pipeline
│
├── rag/                           # RAG document collections
│   ├── product-docs/              # collection: product-docs
│   │   ├── .crystalai-rag.yaml    # optional collection config
│   │   ├── api-reference.md
│   │   └── user-guide.md
│   └── support-runbooks/          # collection: support-runbooks
│       └── troubleshooting.md
│
├── .crystalai/                    # local state (gitignored)
│   ├── agents.db                  # SQLite: sessions, logs, embeddings
│   └── rag/
│       ├── product-docs.index     # vector index
│       └── support-runbooks.index
│
├── .env                           # project-level API keys (gitignored)
└── .gitignore
```

### Key rules

- **Name = filename** -- the `name` field in every YAML file must match the filename without extension
- **Flat directories** -- subdirectories inside `agents/`, `tools/`, and `workflows/` are not scanned
- **Dot files skipped** -- files starting with `.` are ignored during discovery
- **`.crystalai/` is local** -- this directory is auto-generated and should be in `.gitignore`

---

## Configuration Validation

Crystral validates configuration at two stages:

### Parse-time validation (when config is loaded)

- YAML syntax
- Schema version (`version` field present and supported)
- Required fields present and correct types
- Name matches filename
- Field values within valid ranges
- No silent type coercion (e.g. `temperature: "0.7"` as a string raises an error)

### Runtime validation (when agent runs)

- Credentials are resolvable for the specified provider
- Referenced tools exist as files
- Referenced RAG collections are indexed

### Strict mode

By default, some checks produce warnings rather than errors. Set `CRYSTALAI_STRICT=1` to make all warnings into errors:

```bash
CRYSTALAI_STRICT=1 node index.ts
```

| Check | Default | Strict |
|-------|---------|--------|
| Tool file not found | warning | error |
| RAG collection not indexed | warning | error |
| HTTP (not HTTPS) tool endpoint | warning | error |
| Unknown `x-` extension fields | ignored | warning |
| `body_template` set on GET request | warning | error |

### Extension fields

Any field prefixed with `x-` is a custom extension. Extensions are silently ignored by the SDK in default mode and produce warnings in strict mode:

```yaml
version: 1
name: support-agent
provider: openai
model: gpt-4o
x-team: customer-success
x-owner: alice@example.com
x-strict-tools: true
```

Extension fields are available in the raw config object via `agent.getConfig()` but are never used in execution logic.

---

## Further Reading

- [Config Specification](../CONFIG_SPEC.md) -- the canonical YAML schema reference with all validation rules, error messages, and examples
- [Architecture](../ARCHITECTURE.md) -- internal design of the runtime engine
- [Getting Started](./getting-started.md) -- installation and first agent walkthrough
