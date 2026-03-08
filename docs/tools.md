# Tools

Tools give Crystal AI agents the ability to take actions beyond text generation. When an agent has tools attached, the LLM can decide to call them during a conversation, receive the results, and use that information to formulate its response. This is the standard function-calling pattern supported by all modern LLM providers.

Each tool is defined in a single YAML file inside the `tools/` directory. Crystal AI supports four tool types: REST API calls, JavaScript functions, web search, and agent delegation.

---

## Tool Types Overview

| Type | Value | Description | Use Case |
|------|-------|-------------|----------|
| REST API | `rest_api` | Makes HTTP requests to external APIs | Fetching data, triggering webhooks, CRUD operations |
| JavaScript | `javascript` | Executes inline JavaScript in a sandboxed Node.js VM | Calculations, data transformation, string formatting |
| Web Search | `web_search` | Searches the web via the Brave Search API | Current events, fact-checking, research |
| Agent | `agent` | Delegates a task to another Crystal AI agent | Specialist sub-tasks, multi-agent orchestration |

---

## Common Fields (All Tool Types)

Every tool config shares a set of common fields regardless of type:

```yaml
version: 1
name: my-tool
description: What this tool does (shown to the AI model)
type: rest_api
parameters: []
```

### Common Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | yes | -- | Config schema version. Must be `1`. |
| `name` | string | yes | -- | Tool identifier. Must match filename. Allowed: `[a-zA-Z0-9_-]`, max 64 chars. |
| `description` | string | yes | -- | Tool description sent to the LLM. Max 512 chars. Write it as a short imperative sentence. |
| `type` | string | yes | -- | Tool type: `rest_api`, `javascript`, `web_search`, or `agent`. |
| `parameters` | list | yes | `[]` | Input parameters the LLM provides when calling the tool. Use `[]` for tools with no parameters. |

> **Tip:** The `description` field is critical. It is passed verbatim to the AI model as the tool description. A clear, concise description helps the model decide when and how to use the tool. Write it as an imperative sentence: "Fetch a support ticket by ID" rather than "This tool fetches tickets."

---

## Tool Parameters and Schema Definition

Parameters define the inputs the LLM provides when calling a tool. Crystal AI converts these to JSON Schema format for the provider API's function-calling interface.

### Parameter Fields

| Field | Type | Required | Default | Applies To | Description |
|-------|------|----------|---------|------------|-------------|
| `name` | string | yes | -- | all | Parameter identifier. Must be a valid JS identifier: `[a-zA-Z_][a-zA-Z0-9_]*`, max 64 chars. |
| `type` | string | yes | -- | all | Data type: `string`, `number`, `integer`, `boolean`, `array`, `object`. |
| `required` | boolean | no | `false` | all | Whether the LLM must provide this parameter. |
| `description` | string | no | -- | all | Describes the parameter to the LLM. Strongly recommended. |
| `default` | any | no | -- | all | Default value when not provided. Must match `type`. |
| `enum` | list | no | -- | all | Restrict to specific values. |
| `minimum` | number | no | -- | number, integer | Minimum allowed value (inclusive). |
| `maximum` | number | no | -- | number, integer | Maximum allowed value (inclusive). |
| `min_length` | integer | no | -- | string | Minimum string length. |
| `max_length` | integer | no | -- | string | Maximum string length. |
| `pattern` | string (regex) | no | -- | string | Regular expression the value must match. |
| `items` | object | no | -- | array | Schema for array items. Contains a `type` field. |

### Example: Rich Parameter Definitions

```yaml
parameters:
  - name: ticket_id
    type: string
    required: true
    description: The unique ticket identifier (format TKT-XXXXX)
    pattern: "^TKT-[0-9]{5}$"

  - name: status
    type: string
    required: false
    description: Filter by ticket status
    enum:
      - open
      - closed
      - pending

  - name: priority
    type: integer
    required: false
    description: Priority level (1 = highest, 5 = lowest)
    minimum: 1
    maximum: 5
    default: 3

  - name: tags
    type: array
    required: false
    description: Tags to apply to the ticket
    items:
      type: string
```

---

## REST API Tools

REST API tools make HTTP requests to external services. They support path parameter interpolation, multiple authentication methods, custom headers, request body templates, and response extraction.

### REST API Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `endpoint` | string (URL) | yes | -- | The request URL. Supports `{param}` path placeholders. |
| `method` | string | no | `GET` | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`. |
| `headers` | map (string to string) | no | -- | Custom HTTP headers. |
| `auth` | object | no | -- | Authentication configuration. See below. |
| `body_template` | string | no | -- | Request body with `{param}` placeholders. Valid for POST/PUT/PATCH only. |
| `response_path` | string | no | -- | Dot-notation path to extract from the JSON response (e.g. `data.ticket`). |
| `timeout_ms` | integer | no | `30000` | Request timeout in milliseconds. Range: `100`--`300000`. |

### Authentication Options

The `auth` object supports four modes:

| `auth.type` | Required Fields | Behavior |
|-------------|----------------|----------|
| `bearer` | `token_env` | Sends `Authorization: Bearer <token>` header. |
| `basic` | `username_env`, `password_env` | Sends `Authorization: Basic <base64(user:pass)>` header. |
| `header` | `token_env`, `header_name` | Sends `<header_name>: <token>` header. |
| `none` | -- | No authentication (default). |

All credential values are read from environment variables at runtime, never hardcoded in YAML.

> **Warning:** If the `endpoint` uses HTTP instead of HTTPS, Crystal AI logs a security warning. In strict mode (`CRYSTALAI_STRICT=1`), HTTP endpoints are rejected entirely.

### Complete REST API Example

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
    description: The unique ticket identifier (format TKT-XXXXX)
    pattern: "^TKT-[0-9]{5}$"
```

### REST API Tool with POST Body

```yaml
version: 1
name: create-ticket
description: Create a new support ticket
type: rest_api

endpoint: https://api.acme.com/v2/tickets
method: POST

auth:
  type: header
  token_env: ACME_API_KEY
  header_name: X-API-Key

headers:
  Content-Type: application/json
  Accept: application/json

body_template: |
  {
    "subject": "{subject}",
    "description": "{description}",
    "priority": {priority},
    "tags": {tags}
  }

response_path: data.ticket
timeout_ms: 15000

parameters:
  - name: subject
    type: string
    required: true
    description: Ticket subject line
    max_length: 255
  - name: description
    type: string
    required: true
    description: Detailed description of the issue
  - name: priority
    type: integer
    required: false
    description: Priority level (1-5)
    default: 3
    minimum: 1
    maximum: 5
  - name: tags
    type: array
    required: false
    description: Tags to categorize the ticket
    items:
      type: string
```

### How REST API Execution Works

1. The tool config is loaded from `tools/<name>.yaml`.
2. Path parameters in the `endpoint` are replaced: `{ticket_id}` becomes the actual value.
3. The auth token is resolved from the environment variable specified in `token_env`.
4. The HTTP request is executed with the configured method, headers, and body.
5. If `response_path` is set, the specified field is extracted from the JSON response.
6. The result is JSON-serialized and returned to the agent's message thread.

---

## JavaScript Tools

JavaScript tools execute inline code in a sandboxed Node.js `vm.runInNewContext` environment. They are ideal for calculations, data transformations, and formatting that do not require external API calls.

### JavaScript-Specific Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | string | yes | -- | JavaScript function body. Runs as an async function. |
| `runtime` | string | no | `node` | Execution runtime. Only `node` in v1. |
| `timeout_ms` | integer | no | `5000` | Execution timeout. Range: `100`--`30000`. |

### Execution Context

The `code` field contains the body of an async function. Inside the code:

- **`args`** -- An object containing the parameter values provided by the LLM.
- **`return`** -- The return value is JSON-serialized and sent back to the agent.
- **`fetch`** -- The global `fetch` function is available for HTTP requests.
- **No file system access** -- The sandbox does not expose `fs`, `path`, or other Node.js modules.

If the code throws an error, a `ToolExecutionError` is returned. If it exceeds the timeout, a `ToolTimeoutError` is returned. If the return value is not JSON-serializable, a `ToolExecutionError` is returned.

### Complete JavaScript Example

```yaml
version: 1
name: build-prompt
description: Builds a dynamic generation prompt from request parameters
type: javascript
runtime: node
timeout_ms: 5000

parameters:
  - name: type
    type: string
    required: true
    description: Template type
    enum:
      - static
      - animation
  - name: count
    type: integer
    required: false
    description: Number of templates to generate
    default: 4
    minimum: 1
    maximum: 8
  - name: prompt
    type: string
    required: true
    description: The user's creative brief

code: |
  const { type, count = 4, prompt } = args;
  const isAnimation = type === 'animation';

  return {
    userMessage: `Generate exactly ${count} visually distinct,
    production-ready ${isAnimation ? 'animated' : 'static'}
    social media ad templates for: ${prompt}`
  };
```

### Another JavaScript Example: Price Calculator

```yaml
version: 1
name: calculate-price
description: Calculate the final price after applying a discount and tax
type: javascript
timeout_ms: 1000

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

code: |
  const tax = args.tax_rate ?? 0.08;
  const discounted = args.price * (1 - (args.discount ?? 0));
  const total = discounted * (1 + tax);
  return {
    original: args.price,
    discounted,
    tax: discounted * tax,
    total: Math.round(total * 100) / 100,
  };
```

---

## Web Search Tools

Web search tools use the Brave Search API to retrieve current information from the web. This is useful for agents that need to answer questions about recent events, verify facts, or gather research.

### Web Search-Specific Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | no | `brave` | Search provider. Only `brave` in v1. |
| `result_count` | integer | no | `5` | Number of results to return. Range: `1`--`20`. |
| `safe_search` | string | no | `moderate` | Content filter: `off`, `moderate`, `strict`. |

### Required Credential

Web search requires the `BRAVE_API_KEY` environment variable. Crystal AI checks for this key at tool load time and raises a `CredentialNotFoundError` if it is missing.

### Complete Web Search Example

```yaml
version: 1
name: web-search
description: Search the web for current information and recent events
type: web_search

provider: brave
result_count: 5
safe_search: moderate

parameters:
  - name: query
    type: string
    required: true
    description: The search query
  - name: count
    type: integer
    required: false
    description: Number of results to return (1-20)
    minimum: 1
    maximum: 20
```

### How Web Search Execution Works

1. The Brave Search API is called with the `query` parameter.
2. Results are formatted as a list of title, snippet, and URL entries.
3. The formatted text is returned to the agent's message thread.

---

## Agent Tools (Delegation)

Agent tools enable one agent to delegate a task to another agent. This is the foundational building block for multi-agent orchestration in Crystal AI. When the parent agent calls an agent tool, a full `AgentRunner` is spawned for the child agent, complete with its own tool loop, model, and system prompt.

### Agent Tool-Specific Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent_name` | string | yes | -- | Name of the target agent (must exist in `agents/`). |
| `pass_context` | boolean | no | `false` | Whether to pass the parent's recent conversation as context to the child. |
| `timeout_ms` | integer | no | `120000` | Maximum execution time for the delegated agent. Range: `1000`--`600000`. |
| `max_iterations` | integer | no | `10` | Maximum tool-calling iterations for the child agent. Range: `1`--`100`. |

### When to Use Agent Delegation

Use agent tools when:

- A sub-task requires a different model, provider, or temperature than the parent.
- A sub-task has a complex system prompt that would clutter the parent agent.
- You want to compose specialists into a pipeline (strategy, then copy, then design).
- You need to isolate concerns so each agent focuses on one thing well.

### Circular Delegation Prevention

Crystal AI maintains a call stack during agent execution. Before delegating, it checks whether the target agent is already in the stack. If agent A delegates to agent B, and agent B tries to delegate back to agent A, a `CircularDelegationError` is raised with the full chain (e.g. `A -> B -> A`).

### Context Passing

When `pass_context: true`, the parent agent's recent conversation is summarized and prepended to the delegated task. This gives the child agent awareness of the broader conversation without passing the full message history.

### Complete Agent Tool Example

```yaml
version: 1
name: call-strategist
description: >
  Delegate to the ad strategist to analyze a brief and produce a creative
  strategy (audience, tone, key messages, visual direction, copy angles).
type: agent
agent_name: ad-strategist
timeout_ms: 60000

parameters:
  - name: task
    type: string
    required: true
    description: >
      The full advertising brief to analyze -- product name, what it is,
      target market, goals, and any constraints.
```

### Agent Delegation Pattern: Full Pipeline

Here is a real-world pattern where a creative director orchestrates three specialists:

**Tool 1: `tools/call-strategist.yaml`**
```yaml
version: 1
name: call-strategist
description: Delegate to the ad strategist for creative strategy
type: agent
agent_name: ad-strategist
timeout_ms: 60000

parameters:
  - name: task
    type: string
    required: true
    description: The advertising brief to analyze
```

**Tool 2: `tools/call-copywriter.yaml`**
```yaml
version: 1
name: call-copywriter
description: Delegate to the ad copywriter for headlines, taglines, and CTAs
type: agent
agent_name: ad-copywriter
timeout_ms: 60000

parameters:
  - name: task
    type: string
    required: true
    description: Brief + strategy output + template count and type
```

**Tool 3: `tools/call-designer.yaml`**
```yaml
version: 1
name: call-designer
description: Delegate to the template designer for production-ready HTML templates
type: agent
agent_name: ad-template-generator
timeout_ms: 180000

parameters:
  - name: task
    type: string
    required: true
    description: Type, count, brief, strategy, and copy for each template slot
```

**Orchestrator agent: `agents/ad-creative-director.yaml`**
```yaml
version: 1
name: ad-creative-director
description: Orchestrates strategist, copywriter, and designer
provider: together
model: meta-llama/Llama-3.3-70B-Instruct-Turbo
temperature: 0.7
max_tokens: 16000

system_prompt: |
  You are a creative director. Call call-strategist first,
  then call-copywriter, then call-designer. Output the
  designer's JSON verbatim.

tools:
  - call-strategist
  - call-copywriter
  - call-designer
```

The LLM decides the execution order based on the system prompt instructions. Each specialist runs as a fully independent agent with its own model and configuration.

---

## Attaching Tools to Agents

Reference tools by name in an agent's `tools` array:

```yaml
# agents/support-agent.yaml
version: 1
name: support-agent
provider: openai
model: gpt-4o
tools:
  - get-ticket
  - create-ticket
  - web-search
  - calculate-price
```

Each name must correspond to a file at `tools/<name>.yaml`. Tools are loaded and validated at runtime when `agent.run()` is called, not at config parse time. This means:

- Missing tool files produce a **warning** by default.
- Set `x-strict-tools: true` in the agent config to make missing tools an **error**.
- Tools from MCP servers (configured via `mcp`) are merged with file-based tools automatically.

> **Note:** The tool `description` and `parameters` are converted to JSON Schema and sent to the LLM as function definitions. The model uses this information to decide when to call each tool and what arguments to provide.

---

## Tool YAML Reference (All Fields)

This table consolidates every field across all tool types:

| Field | Type | `rest_api` | `javascript` | `web_search` | `agent` |
|-------|------|-----------|-------------|-------------|---------|
| `version` | integer | required | required | required | required |
| `name` | string | required | required | required | required |
| `description` | string | required | required | required | required |
| `type` | string | required | required | required | required |
| `parameters` | list | required | required | required | required |
| `endpoint` | string | required | -- | -- | -- |
| `method` | string | optional | -- | -- | -- |
| `headers` | map | optional | -- | -- | -- |
| `auth` | object | optional | -- | -- | -- |
| `body_template` | string | optional | -- | -- | -- |
| `response_path` | string | optional | -- | -- | -- |
| `timeout_ms` | integer | optional | optional | -- | optional |
| `code` | string | -- | required | -- | -- |
| `runtime` | string | -- | optional | -- | -- |
| `provider` | string | -- | -- | optional | -- |
| `result_count` | integer | -- | -- | optional | -- |
| `safe_search` | string | -- | -- | optional | -- |
| `agent_name` | string | -- | -- | -- | required |
| `pass_context` | boolean | -- | -- | -- | optional |
| `max_iterations` | integer | -- | -- | -- | optional |

---

## How Tool Execution Works

When an agent's LLM returns a tool call, Crystal AI executes it through this flow:

1. **Identify the tool.** Check if it is an MCP tool (prefixed `mcp_*`) or a file-based tool.
2. **Load the config.** Read `tools/<name>.yaml` and validate with Zod.
3. **Validate arguments.** Check the provided arguments against the parameter schema.
4. **Execute by type:**
   - `rest_api`: Build URL, resolve auth, make HTTP request, extract response.
   - `javascript`: Run code in sandboxed VM with `args` object.
   - `web_search`: Call Brave Search API, format results.
   - `agent`: Spawn child `AgentRunner`, execute with call stack tracking.
5. **Return result.** The result is JSON-serialized and appended to the message thread as a tool result.
6. **Resume generation.** The LLM receives the tool result and continues generating.

The agent's tool loop runs for a maximum of 10 iterations. If the LLM keeps calling tools beyond this limit, the loop exits and the last response is returned.

---

## Error Handling

| Error | Code | Cause |
|-------|------|-------|
| `ToolNotFoundError` | `TOOL_NOT_FOUND` | Tool YAML file does not exist |
| `ToolExecutionError` | `TOOL_EXECUTION_ERROR` | Runtime error in tool execution (JS error, HTTP failure) |
| `ToolTimeoutError` | `TOOL_TIMEOUT` | Tool exceeded its `timeout_ms` |
| `CircularDelegationError` | -- | Agent tool creates a circular call chain |
| `CredentialNotFoundError` | `CREDENTIAL_NOT_FOUND` | Required env var for auth or web search not set |
| `ValidationError` | `VALIDATION_ERROR` | Tool config has invalid fields or types |

---

## Related Documentation

- [Agents Guide](./agents.md) -- Configuring agents that use tools
- [Workflows Guide](./workflows.md) -- Multi-agent orchestration
- [Configuration Specification](../CONFIG_SPEC.md) -- Full YAML schema reference
- [Architecture](../ARCHITECTURE.md) -- Internal design and data flow
