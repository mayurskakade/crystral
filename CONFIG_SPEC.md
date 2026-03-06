# CrystalAI — Configuration Specification

**Version:** 1.0
**Status:** Canonical
**Scope:** This document is the single source of truth for all CrystalAI configuration files. Every SDK in every language implements against this spec. No SDK may extend or relax these rules without a spec update.

---

## Table of Contents

1. [Overview](#1-overview)
2. [File Discovery Rules](#2-file-discovery-rules)
3. [Schema Versioning](#3-schema-versioning)
4. [Project Config — `crystalai.config.yaml`](#4-project-config--crystalaiconfigyaml)
5. [Agent Config — `agents/<name>.yaml`](#5-agent-config--agentsnameaml)
6. [Tool Config — `tools/<name>.yaml`](#6-tool-config--toolsnameyaml)
7. [RAG Collection Config — `rag/<name>/.crystalai-rag.yaml`](#7-rag-collection-config--ragnamecrystalairaxyaml)
8. [Credential File — `~/.crystalai/credentials`](#8-credential-file--crystalaicredentials)
9. [Validation Rules](#9-validation-rules)
10. [Canonical Error Messages](#10-canonical-error-messages)
11. [Extension Points](#11-extension-points)
12. [Migration Guide — v1 → v2](#12-migration-guide--v1--v2)
13. [Full Examples](#13-full-examples)

---

## 1. Overview

CrystalAI uses YAML as its configuration language for all resource definitions. YAML was chosen because it is:

- **Version-controllable** — meaningful diffs in git
- **Language-agnostic** — all SDK languages parse it the same way
- **Human-editable** — developers can modify it directly without a build step
- **Comment-supporting** — `#` comments allowed for documentation inside config files

### Config File Types

| File | Purpose | Required |
|------|---------|---------|
| `crystalai.config.yaml` | Project-level settings | Yes (for CLI and Studio) |
| `agents/<name>.yaml` | Agent definition | One or more |
| `tools/<name>.yaml` | Tool definition | Optional |
| `rag/<name>/.crystalai-rag.yaml` | RAG collection settings | Optional (directory required) |
| `~/.crystalai/credentials` | Global API keys | Optional (can use env vars) |

### Design Principles

1. **Fail loudly** — Invalid config must raise an error with a clear message. No silent defaults for required fields.
2. **Name = filename** — The `name` field in every config must match the filename without extension.
3. **Consistent defaults** — All SDKs use identical default values for optional fields.
4. **No implicit behavior** — If a feature is not explicitly configured, it is disabled. No magic.

---

## 2. File Discovery Rules

### Project Root Detection

SDKs locate the project root by walking up directories from `cwd` until `crystalai.config.yaml` is found. If not found, the current directory is used as the root with a warning (not an error), except for the `init` command which creates it.

```
/home/user/my-project/
├── crystalai.config.yaml   ← project root
├── agents/
│   └── support.yaml
└── src/
    └── main.ts             ← cwd when SDK is called from here
                               → walks up → finds crystalai.config.yaml
                               → project root = /home/user/my-project/
```

### Agent Discovery

All files matching `<project-root>/agents/*.yaml` and `<project-root>/agents/*.yml` are considered agent configs.

- Subdirectories are **not** scanned recursively.
- Files starting with `.` (dot files) are skipped.
- Files not parseable as YAML are skipped with a warning (not an error) during list operations, but raise an error when loaded directly by name.

### Tool Discovery

Same rules as agent discovery, applied to `<project-root>/tools/`.

### RAG Collection Discovery

All **directories** inside `<project-root>/rag/` are considered RAG collections.

- Files directly inside `rag/` (not in a subdirectory) are ignored.
- The collection name is the directory name.
- `rag/<name>/.crystalai-rag.yaml` is optional. If absent, all defaults apply.

### Name-to-File Resolution

When an SDK resolves a name (e.g. `Agent('support-bot')`), it tries in order:

1. `<project-root>/agents/support-bot.yaml`
2. `<project-root>/agents/support-bot.yml`
3. Raise `AgentNotFoundError`

---

## 3. Schema Versioning

### `version` Field

Every config file MUST contain a top-level `version` field as an integer. The current version is `1`.

```yaml
version: 1   # required in all config files
```

**Validation:** If `version` is absent, SDKs must raise `ValidationError` with message:
```
Missing required field 'version'. Add 'version: 1' to the top of the file.
```

If `version` is a value the SDK does not support (e.g. `3` when SDK only supports `1` and `2`):
```
Unsupported config version: 3. This SDK supports versions 1–2. Please upgrade @crystalai/sdk.
```

### Version Guarantee

| Version | Status | SDK support |
|---------|--------|-------------|
| 1 | Current | All SDKs |
| 2 | Planned | See [Section 12](#12-migration-guide--v1--v2) |

**Backwards compatibility guarantee:** SDKs supporting version N must also support all versions < N. A v2 SDK reads v1 files without modification.

**Forward compatibility rule:** SDKs encountering a version higher than their maximum supported version must raise an error, never silently ignore it.

---

## 4. Project Config — `crystalai.config.yaml`

### Full Schema

```yaml
version: 1                    # integer, required
project: my-project           # string, required
studio:                       # object, optional
  port: 4000                  # integer, optional, default: 4000, range: 1024–65535
  open_browser: true          # boolean, optional, default: true
  host: 127.0.0.1             # string, optional, default: "127.0.0.1"
```

### Field Reference

#### `version`
- **Type:** integer
- **Required:** yes
- **Valid values:** `1`
- **Description:** Config schema version.

#### `project`
- **Type:** string
- **Required:** yes
- **Constraints:** 1–64 characters, `[a-zA-Z0-9_-]` only, must not start with `-` or `_`
- **Description:** Human-readable project name. Used as a label in Studio and logs.
- **Error if invalid chars:**
  ```
  'project' contains invalid characters. Use only letters, numbers, hyphens, and underscores.
  ```

#### `studio.port`
- **Type:** integer
- **Required:** no
- **Default:** `4000`
- **Constraints:** 1024–65535
- **Description:** Port for the Studio HTTP server.
- **Error if out of range:**
  ```
  'studio.port' must be between 1024 and 65535. Got: 80.
  ```

#### `studio.open_browser`
- **Type:** boolean
- **Required:** no
- **Default:** `true`
- **Description:** Whether `crystalai studio` opens the browser automatically.

#### `studio.host`
- **Type:** string
- **Required:** no
- **Default:** `"127.0.0.1"`
- **Valid values:** `"127.0.0.1"`, `"0.0.0.0"`, or a valid IPv4 address
- **Warning if `0.0.0.0`:** SDKs must print a security warning: `Studio is exposed to all network interfaces. Only use this in trusted networks.`

---

## 5. Agent Config — `agents/<name>.yaml`

### Full Schema

```yaml
version: 1                          # integer, required

name: support-agent                 # string, required
description: Customer support agent # string, optional

provider: openai                    # string, required — see Provider Names
model: gpt-4o                       # string, required

system_prompt: |                    # string, optional, multiline
  You are a helpful support agent.

temperature: 0.7                    # number, optional, default: 1.0, range: 0.0–2.0
max_tokens: 4096                    # integer, optional, default: 4096, range: 1–1000000
top_p: 1.0                          # number, optional, default: 1.0, range: 0.0–1.0
presence_penalty: 0.0               # number, optional, default: 0.0, range: -2.0–2.0
frequency_penalty: 0.0              # number, optional, default: 0.0, range: -2.0–2.0
stop_sequences:                     # list of strings, optional
  - "END"

tools:                              # list of strings, optional
  - get-ticket
  - calculate-price

rag:                                # object, optional
  collections:                      # list of strings, required if rag is set
    - product-docs
  embedding_provider: openai        # string, required if rag is set — see Provider Names
  embedding_model: text-embedding-3-small  # string, required if rag is set
  match_threshold: 0.7              # number, optional, default: 0.7, range: 0.0–1.0
  match_count: 5                    # integer, optional, default: 5, range: 1–50
```

### Field Reference

#### `name`
- **Type:** string
- **Required:** yes
- **Constraints:** 1–64 characters, `[a-zA-Z0-9_-]` only
- **Validation rule:** Must match the filename without extension. An agent at `agents/support-bot.yaml` must have `name: support-bot`.
- **Error if mismatch:**
  ```
  Agent name 'customer-support' does not match filename 'support-bot.yaml'.
  The name field must equal the filename without extension.
  ```

#### `provider`
- **Type:** string (enum)
- **Required:** yes
- **Valid values:** `openai`, `anthropic`, `groq`, `google`, `together`
- **Case:** lowercase only
- **Error if invalid:**
  ```
  Unknown provider: 'OpenAI'. Valid providers are: openai, anthropic, groq, google, together.
  Did you mean 'openai'?
  ```

#### `model`
- **Type:** string
- **Required:** yes
- **Constraints:** 1–128 characters
- **Description:** Model identifier passed directly to the provider API. Not validated against a list (providers add new models frequently).

#### `system_prompt`
- **Type:** string
- **Required:** no
- **Default:** `""` (empty string — no system message injected)
- **Multiline:** use YAML block scalar `|` for multiline prompts
- **Template variables:** Supports `{variable_name}` syntax. Variables are substituted at runtime from the `variables` argument to `agent.run()`. Unknown variables are left as-is (no error).

#### `temperature`
- **Type:** number (float)
- **Required:** no
- **Default:** `1.0`
- **Range:** `0.0` to `2.0` inclusive
- **Note:** Not all providers support the full range. Values outside provider-specific ranges are passed through; the provider API will return an error.

#### `max_tokens`
- **Type:** integer
- **Required:** no
- **Default:** `4096`
- **Range:** `1` to `1000000`

#### `tools`
- **Type:** list of strings
- **Required:** no
- **Default:** `[]`
- **Description:** Each string is a tool name. SDKs must verify each tool file exists at load time (not at config parse time). Missing tools produce a warning, not an error, unless `strict_tools: true` is set (see extension points).

#### `rag`
- **Type:** object
- **Required:** no
- **Subfields — `rag.collections`:**
  - Type: list of strings
  - Required: yes (if `rag` object is present)
  - Each string is a RAG collection name (must correspond to `rag/<name>/` directory)
- **Subfields — `rag.embedding_provider`:**
  - Type: string (same enum as `provider`)
  - Required: yes (if `rag` object is present)
- **Subfields — `rag.embedding_model`:**
  - Type: string
  - Required: yes (if `rag` object is present)
- **Subfields — `rag.match_threshold`:**
  - Type: number (float)
  - Default: `0.7`
  - Range: `0.0–1.0`
- **Subfields — `rag.match_count`:**
  - Type: integer
  - Default: `5`
  - Range: `1–50`
- **Error if `rag` present but `collections` empty:**
  ```
  'rag.collections' must contain at least one collection name.
  ```

### Provider Names (Enum)

| Value | Provider | Notes |
|-------|----------|-------|
| `openai` | OpenAI | Supports chat + embeddings |
| `anthropic` | Anthropic | Supports chat only |
| `groq` | Groq | Supports chat only |
| `google` | Google | Supports chat + embeddings |
| `together` | Together AI | Supports chat only |

This enum applies to both `provider` and `rag.embedding_provider`.

---

## 6. Tool Config — `tools/<name>.yaml`

### Common Fields (All Tool Types)

```yaml
version: 1                   # integer, required
name: get-ticket             # string, required, must match filename
description: string          # string, required (used as tool description for AI)
type: rest_api               # string, required — rest_api | javascript | web_search
parameters:                  # list, required (may be empty list [])
  - name: ticket_id          # string, required
    type: string             # string, required — string | number | integer | boolean | array | object
    required: true           # boolean, optional, default: false
    description: string      # string, optional (recommended)
    default: any             # any, optional — must match type
    enum:                    # list, optional — restrict to specific values
      - open
      - closed
    minimum: 0               # number, optional — for number/integer types only
    maximum: 100             # number, optional — for number/integer types only
    min_length: 1            # integer, optional — for string types only
    max_length: 255          # integer, optional — for string types only
    pattern: "^[A-Z0-9]+$"  # string (regex), optional — for string types only
    items:                   # object, optional — for array type only
      type: string           # type of array items
```

#### `description` (tool-level)
- **Required:** yes
- This string is passed verbatim to the AI model as the tool description. Write it as a short imperative sentence (e.g. "Fetch a support ticket by ID.").
- **Max length:** 512 characters

#### `parameters`
- **Required:** yes (use `[]` for tools with no parameters)
- Parameters are converted to a JSON Schema object by SDKs for the provider API's tool/function calling format.
- Parameter `name` constraints: `[a-zA-Z_][a-zA-Z0-9_]*`, max 64 characters (matches JSON Schema property naming rules)

---

### Type: `rest_api`

```yaml
version: 1
name: get-ticket
description: Fetch a support ticket by ID
type: rest_api

endpoint: https://api.example.com/tickets/{ticket_id}   # string, required
method: GET                                               # string, optional, default: GET
                                                          # valid: GET | POST | PUT | PATCH | DELETE | HEAD

headers:                    # map of string→string, optional
  Content-Type: application/json
  Accept: application/json

auth:                       # object, optional
  type: bearer              # string, required — bearer | basic | header | none
  token_env: API_TOKEN      # string, required for bearer/header — env var name
  username_env: API_USER    # string, required for basic — env var name
  password_env: API_PASS    # string, required for basic — env var name
  header_name: X-API-Key    # string, required for header type

body_template: |            # string, optional — only valid for POST/PUT/PATCH
  {"ticket_id": "{ticket_id}", "status": "{status}"}

response_path: data.ticket  # string (dot notation), optional — extract field from JSON response
timeout_ms: 30000           # integer, optional, default: 30000, range: 100–300000

parameters:
  - name: ticket_id
    type: string
    required: true
    description: The ticket ID to fetch
```

#### `endpoint`
- **Required:** yes
- **Constraints:** Must be a valid HTTPS URL (HTTP is allowed but SDKs must warn: `Tool 'get-ticket' uses HTTP. Consider HTTPS for security.`)
- **Path parameters:** `{param_name}` syntax. Each `{param_name}` must have a corresponding entry in `parameters`.
- **Validation:** SDKs must verify that all `{param_name}` placeholders in the endpoint have a matching parameter name.
- **Error if placeholder has no parameter:**
  ```
  Tool 'get-ticket': endpoint placeholder '{ticket_id}' has no matching parameter definition.
  ```

#### `auth.type`
- **Values:** `bearer`, `basic`, `header`, `none`
- **Default:** `none`
- For `bearer`: injects `Authorization: Bearer <token>` header. `token_env` required.
- For `basic`: injects `Authorization: Basic <base64(user:pass)>`. Both `username_env` and `password_env` required.
- For `header`: injects `<header_name>: <token>` header. Both `token_env` and `header_name` required.
- **Error if env var not found at runtime:**
  ```
  Tool 'get-ticket': auth token env var 'API_TOKEN' is not set.
  ```

#### `body_template`
- **Valid only when** `method` is `POST`, `PUT`, or `PATCH`. SDKs must warn (not error) if set for `GET`/`DELETE`.
- **Interpolation:** `{param_name}` placeholders are replaced with the tool call argument values at runtime. Non-string values are JSON-serialized.

---

### Type: `javascript`

```yaml
version: 1
name: calculate-price
description: Calculate the final price after applying a discount and tax
type: javascript

runtime: node                # string, optional, default: node — only node supported in v1
timeout_ms: 5000             # integer, optional, default: 5000, range: 100–30000

code: |                      # string, required — multiline JS function body
  const tax = args.tax_rate ?? 0.08;
  const discounted = args.price * (1 - (args.discount ?? 0));
  const total = discounted * (1 + tax);
  return { original: args.price, discounted, tax: discounted * tax, total };

parameters:
  - name: price
    type: number
    required: true
    description: Original price in USD
  - name: discount
    type: number
    required: false
    description: Discount as decimal (e.g. 0.1 for 10%)
    minimum: 0.0
    maximum: 1.0
  - name: tax_rate
    type: number
    required: false
    description: Tax rate as decimal (e.g. 0.08 for 8%)
```

#### `code`
- **Required:** yes
- **Execution context:** The code runs as the body of an async function. The `args` object contains the tool call arguments. `return` value is JSON-serialized and returned to the agent. `fetch` is available. No file system access.
- **Error codes from sandbox:**
  - Runtime error → `ToolExecutionError` with the JS error message
  - Timeout → `ToolTimeoutError`
  - `return` value not JSON-serializable → `ToolExecutionError`

#### `runtime`
- **Valid values in v1:** `node` only
- v2 will add: `python`, `deno`

---

### Type: `web_search`

```yaml
version: 1
name: web-search
description: Search the web for current information and recent events
type: web_search

provider: brave              # string, optional, default: brave — only brave supported in v1
result_count: 5              # integer, optional, default: 5, range: 1–20
safe_search: moderate        # string, optional, default: moderate — off | moderate | strict

parameters:
  - name: query
    type: string
    required: true
    description: The search query
  - name: count
    type: integer
    required: false
    description: Number of results to return (1–20)
    minimum: 1
    maximum: 20
```

**Required credential:** `BRAVE_API_KEY` in environment or credentials file. SDKs must check for this key at tool load time and raise `CredentialNotFoundError` with message:
```
Tool 'web-search' requires BRAVE_API_KEY.
Set it in your environment: export BRAVE_API_KEY=your-key
```

---

## 7. RAG Collection Config — `rag/<name>/.crystalai-rag.yaml`

This file is **optional**. If absent, all defaults apply.

```yaml
version: 1
name: product-docs           # string, required, must match directory name

embedding_provider: openai              # string, optional, default: openai
embedding_model: text-embedding-3-small # string, optional, default: text-embedding-3-small

chunk_size: 512              # integer, optional, default: 512, range: 64–8192
                             # unit: approximate tokens (1 token ≈ 4 characters)
chunk_overlap: 64            # integer, optional, default: 64
                             # must be less than chunk_size
                             # range: 0–(chunk_size/2)

include:                     # list of glob patterns, optional
  - "**/*.md"                # default if omitted: ["**/*.md", "**/*.txt", "**/*.pdf"]
  - "**/*.txt"
  - "**/*.pdf"

exclude:                     # list of glob patterns, optional, default: []
  - "**/node_modules/**"
  - "**/.git/**"
  - "**/dist/**"
```

#### `chunk_size`
- **Type:** integer
- **Default:** `512`
- **Range:** `64–8192`
- **Unit:** approximate tokens. SDKs use character count ÷ 4 as a token approximation. Exact tokenization is not required.

#### `chunk_overlap`
- **Type:** integer
- **Default:** `64`
- **Constraint:** Must be `< chunk_size`
- **Error if violated:**
  ```
  'chunk_overlap' (200) must be less than 'chunk_size' (100) in rag/product-docs/.crystalai-rag.yaml
  ```

#### Supported Document Formats (v1)

| Extension | Parser |
|-----------|--------|
| `.md`, `.mdx` | Read as plain text (markdown formatting preserved) |
| `.txt` | Read as plain text |
| `.pdf` | Text extraction only (no OCR) |
| `.html`, `.htm` | Strip tags, extract text |

Other formats are skipped with a warning: `Skipping unsupported file type: diagram.excalidraw`

---

## 8. Credential File — `~/.crystalai/credentials`

The global credentials file uses INI format (not YAML).

### Format

```ini
[openai]
api_key = sk-proj-abc123...

[anthropic]
api_key = sk-ant-api03-abc123...

[groq]
api_key = gsk_abc123...

[google]
api_key = AIzaSyAbc123...

[together]
api_key = abc123...

[brave]
api_key = BSAabc123...
```

### Rules

- Section names are provider names (lowercase)
- Only `api_key` is supported per section in v1
- Lines starting with `#` are comments
- The file is created with mode `0600` (owner read/write only)
- SDKs must refuse to read the file if its permissions are wider than `0600` on Unix systems, with warning:
  ```
  Warning: ~/.crystalai/credentials has insecure permissions. Run: chmod 600 ~/.crystalai/credentials
  ```
  On Windows, this check is skipped.

### Credential Resolution Order

All SDKs must resolve credentials in this exact priority order (first match wins):

```
Priority 1: process environment variable
  e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY, TOGETHER_API_KEY

Priority 2: project .env file (<project-root>/.env)
  Parsed with dotenv. Same env var names as Priority 1.

Priority 3: ~/.crystalai/credentials
  [openai] api_key = ...
```

**Environment variable names per provider:**

| Provider | Env var name |
|----------|-------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `google` | `GOOGLE_API_KEY` |
| `together` | `TOGETHER_API_KEY` |
| `brave` (web search) | `BRAVE_API_KEY` |

**Error if no credential found (any priority level):**
```
No API key found for provider 'openai'.

Tried:
  1. Environment variable OPENAI_API_KEY — not set
  2. Project .env file — not found or key not in file
  3. ~/.crystalai/credentials — provider section not found

To fix, run one of:
  crystalai auth add openai
  export OPENAI_API_KEY=your-key
  echo "OPENAI_API_KEY=your-key" >> .env
```

---

## 9. Validation Rules

### When Validation Runs

| Operation | Validation scope |
|-----------|-----------------|
| `Agent('name')` constructor | Load + parse YAML, validate schema, validate name matches filename. Do NOT verify credentials or tool/RAG existence. |
| `agent.run()` | Validate credentials are resolvable, validate referenced tools exist, validate referenced RAG collections are indexed. |
| `crystalai init` | No validation (creates new files) |
| `crystalai create agent` | Validates name format only |
| `crystalai list` | Parse all configs, collect errors per file, print warnings for invalid files without stopping |

### Strict Validation Modes

By default, some checks are warnings. In strict mode (set via `CRYSTALAI_STRICT=1` env var or `--strict` flag), all warnings become errors.

| Check | Default | Strict |
|-------|---------|--------|
| Tool file not found | warning | error |
| RAG collection not indexed | warning | error |
| HTTP (not HTTPS) tool endpoint | warning | error |
| Unknown `x-` extension fields | silently ignored | warning |
| `body_template` set on GET request | warning | error |

### Type Coercion Rules

SDKs must NOT silently coerce types. Mismatched types raise `ValidationError`:

| Config value | Field type | Behavior |
|-------------|-----------|---------|
| `temperature: "0.7"` (string) | number | `ValidationError` |
| `max_tokens: 4096.5` | integer | `ValidationError` — must be a whole number |
| `open_browser: "true"` | boolean | `ValidationError` |
| `tools: get-ticket` | list | `ValidationError` — must be a YAML list |

---

## 10. Canonical Error Messages

All SDKs must produce error messages that match the templates below. The goal is that a user seeing an error from any SDK can find the same fix regardless of their language.

### Error Codes (used by all SDKs)

| Code | HTTP Status | Class Name |
|------|------------|-----------|
| `VALIDATION_ERROR` | 400 | `ValidationError` |
| `AGENT_NOT_FOUND` | 404 | `AgentNotFoundError` |
| `TOOL_NOT_FOUND` | 404 | `ToolNotFoundError` |
| `COLLECTION_NOT_FOUND` | 404 | `RAGCollectionNotFoundError` |
| `COLLECTION_NOT_INDEXED` | 409 | `CollectionNotIndexedError` |
| `CREDENTIAL_NOT_FOUND` | 401 | `CredentialNotFoundError` |
| `PROVIDER_ERROR` | 502 | `ProviderError` |
| `RATE_LIMIT` | 429 | `RateLimitError` |
| `TOOL_EXECUTION_ERROR` | 500 | `ToolExecutionError` |
| `TOOL_TIMEOUT` | 504 | `ToolTimeoutError` |
| `STORAGE_ERROR` | 500 | `StorageError` |
| `CONFIG_VERSION_ERROR` | 400 | `ConfigVersionError` |

### Message Templates

#### `AGENT_NOT_FOUND`
```
Agent '{name}' not found.
Expected file: {project_root}/agents/{name}.yaml

To create it, run:
  crystalai create agent {name}
```

#### `TOOL_NOT_FOUND`
```
Tool '{name}' not found.
Expected file: {project_root}/tools/{name}.yaml

Referenced by agent: {agent_name}

To create it, run:
  crystalai create tool {name}
```

#### `COLLECTION_NOT_INDEXED`
```
RAG collection '{name}' has not been indexed yet.
Run the following to index it before running the agent:
  crystalai rag index {name}
```

#### `VALIDATION_ERROR`
```
Invalid config in {file_path}:
  Field '{field}': {reason}

Example of valid value:
  {field}: {example}
```

#### `PROVIDER_ERROR`
```
Provider error from {provider} ({model}):
  Status: {http_status}
  Message: {provider_message}

Check:
  - Your API key is valid and has quota remaining
  - The model name '{model}' is correct for {provider}
  - The provider API is operational: {status_page_url}
```

---

## 11. Extension Points

### `x-` Prefix Fields

Any field prefixed with `x-` is a custom extension and is silently ignored by all SDKs in default mode (warning in strict mode). This allows tooling to add metadata without breaking SDK compatibility.

```yaml
version: 1
name: support-agent
provider: openai
model: gpt-4o

x-team: customer-success         # ignored by SDK
x-owner: alice@example.com       # ignored by SDK
x-review-date: 2025-01-01        # ignored by SDK
```

**Rules for extension fields:**
- Must start with `x-`
- Value can be any YAML type (string, number, boolean, list, object)
- SDKs must expose these fields in the raw config object accessible via `agent.getConfig()` or equivalent, but must not use them in execution logic
- Extension fields at any nesting level are allowed

### Custom Provider (v1 — `openai_compatible` type)

For providers that implement the OpenAI-compatible API (most open-source model servers):

```yaml
version: 1
name: my-agent
provider: openai              # use 'openai' provider
model: meta-llama/Llama-3-8b-Instruct

# Extension: custom base URL for OpenAI-compatible server
x-provider-base-url: http://localhost:11434/v1   # e.g. Ollama, LM Studio, vLLM

system_prompt: You are a helpful assistant.
```

In v1, this is an extension (`x-provider-base-url`). In v2, it becomes a first-class field.

### Future Extension: v2 `custom_provider`

v2 will add official support:

```yaml
# v2 (planned)
version: 2
name: my-agent
provider:
  type: openai_compatible
  base_url: http://localhost:11434/v1
  name: ollama
model: llama3
```

### `strict_tools` Flag (Extension in v1)

```yaml
version: 1
name: support-agent
provider: openai
model: gpt-4o
tools:
  - get-ticket

x-strict-tools: true    # raise error (not warning) if any tool file is missing
```

---

## 12. Migration Guide — v1 → v2

> v2 is planned and not yet released. This section documents the planned migration path.

### Breaking Changes in v2

#### 1. `provider` field becomes an object

**v1:**
```yaml
provider: openai
model: gpt-4o
```

**v2:**
```yaml
provider:
  name: openai
  base_url: https://api.openai.com/v1   # optional, explicit
model: gpt-4o
```

**Migration:** v2 SDKs auto-convert string `provider` to `{ name: provider }`.

#### 2. `rag` field structure changes

**v1:**
```yaml
rag:
  collections:
    - product-docs
  embedding_provider: openai
  embedding_model: text-embedding-3-small
```

**v2:** Embedding config moves to the collection itself:
```yaml
rag:
  collections:
    - name: product-docs
      embedding_provider: openai
      embedding_model: text-embedding-3-small
      match_threshold: 0.7
```

**Migration:** v2 SDKs auto-convert v1 flat `rag` object to per-collection config.

#### 3. Tool `body_template` becomes `body`

**v1:**
```yaml
body_template: '{"id": "{ticket_id}"}'
```

**v2:**
```yaml
body:
  template: '{"id": "{ticket_id}"}'
  # or:
  json:
    id: "{ticket_id}"
```

### Automatic Migration

When an SDK opens a v1 file and the SDK supports v2, it:
1. Reads the file with v1 rules
2. Applies auto-migration transforms in memory
3. Does NOT write back to disk
4. Logs: `Using v1 config with automatic migration. Run 'crystalai migrate' to upgrade files.`

`crystalai migrate` (v2 CLI command) writes converted YAML back to disk.

---

## 13. Full Examples

### Minimal Agent

```yaml
version: 1
name: simple-bot
provider: openai
model: gpt-4o
```

### Full-Featured Agent

```yaml
version: 1
name: support-agent
description: Customer support agent with ticket access and product knowledge
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful customer support agent for AcmeCorp.
  Always be polite and professional.
  If you cannot resolve an issue, escalate to a human agent.

  Customer tier: {customer_tier}
temperature: 0.3
max_tokens: 2048
tools:
  - get-ticket
  - update-ticket
  - send-email
rag:
  collections:
    - product-docs
    - support-runbooks
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_threshold: 0.75
  match_count: 4
x-team: support
x-escalation-email: support-lead@acme.com
```

### REST API Tool with Auth

```yaml
version: 1
name: get-ticket
description: Fetch a customer support ticket by its ID
type: rest_api
endpoint: https://api.acme.com/v2/tickets/{ticket_id}
method: GET
auth:
  type: bearer
  token_env: ACME_SUPPORT_API_KEY
headers:
  Accept: application/json
  X-Client-Version: "2.0"
response_path: data
timeout_ms: 10000
parameters:
  - name: ticket_id
    type: string
    required: true
    description: The unique ticket identifier (format: TKT-XXXXX)
    pattern: "^TKT-[0-9]{5}$"
```

### JavaScript Tool

```yaml
version: 1
name: format-currency
description: Format a number as a currency string with symbol and commas
type: javascript
timeout_ms: 1000
parameters:
  - name: amount
    type: number
    required: true
    description: The amount to format
  - name: currency
    type: string
    required: false
    description: ISO 4217 currency code
    default: USD
    enum: [USD, EUR, GBP, JPY, INR]
  - name: locale
    type: string
    required: false
    description: BCP 47 locale string
    default: en-US
code: |
  const formatter = new Intl.NumberFormat(args.locale ?? 'en-US', {
    style: 'currency',
    currency: args.currency ?? 'USD',
  });
  return { formatted: formatter.format(args.amount), amount: args.amount, currency: args.currency ?? 'USD' };
```

### RAG Collection Config

```yaml
version: 1
name: product-docs
embedding_provider: openai
embedding_model: text-embedding-3-large
chunk_size: 1024
chunk_overlap: 128
include:
  - "**/*.md"
  - "docs/**/*.txt"
exclude:
  - "drafts/**"
  - "**/*-old.md"
```
