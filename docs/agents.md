# Agents

An agent in Crystal AI is a configured AI persona backed by a large language model. Each agent is defined in a single YAML file inside the `agents/` directory of your project. The YAML file specifies which LLM provider and model to use, the system prompt that shapes the agent's behavior, which tools it can call, and optional features like RAG retrieval, structured output, retry logic, guardrails, and MCP server connections.

Agents are the fundamental unit of work in Crystal AI. You can run an agent directly from the CLI, through the SDK, or via Studio. You can also compose agents together using [tool delegation](./tools.md#agent-tools-delegation) or [workflows](./workflows.md).

---

## Agent YAML Specification

Every agent config file lives at `agents/<name>.yaml` and must include the `version`, `name`, `provider`, and `model` fields at minimum. The `name` field must match the filename without extension.

### Minimal Example

```yaml
version: 1
name: simple-bot
provider: openai
model: gpt-4o
```

### Full Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | yes | -- | Config schema version. Must be `1`. |
| `name` | string | yes | -- | Agent identifier. Must match filename. Allowed: `[a-zA-Z0-9_-]`, max 64 chars. |
| `description` | string | no | -- | Human-readable description (max 512 chars). Shown in Studio and logs. |
| `provider` | string | yes | -- | LLM provider: `openai`, `anthropic`, `groq`, `google`, `together`, or any custom string. |
| `model` | string | yes | -- | Model identifier passed to the provider API (e.g. `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-2.5-flash`). |
| `base_url` | string (URL) | no | -- | Custom base URL for OpenAI-compatible providers (e.g. Ollama, vLLM). |
| `system_prompt` | string or object | no | `""` | System message sent to the model. Supports `{variable}` template syntax. |
| `temperature` | number | no | `1.0` | Sampling temperature. Range: `0.0`--`2.0`. |
| `max_tokens` | integer | no | `4096` | Maximum tokens in the response. Range: `1`--`1000000`. |
| `top_p` | number | no | `1.0` | Nucleus sampling threshold. Range: `0.0`--`1.0`. |
| `presence_penalty` | number | no | `0.0` | Penalizes repeated topics. Range: `-2.0`--`2.0`. |
| `frequency_penalty` | number | no | `0.0` | Penalizes repeated tokens. Range: `-2.0`--`2.0`. |
| `stop_sequences` | list of strings | no | -- | Sequences that cause the model to stop generating. |
| `tools` | list of strings | no | `[]` | Tool names referencing files in `tools/`. |
| `rag` | object | no | -- | Vector store config for RAG retrieval. See [RAG Integration](#rag-integration). |
| `mcp` | list of objects | no | `[]` | MCP servers providing dynamic tools. See [MCP Server Attachment](#mcp-server-attachment). |
| `output` | object | no | -- | Structured output config (format, JSON schema, strict mode). |
| `retry` | object | no | -- | Retry policy for failed LLM calls. |
| `fallback` | list of objects | no | -- | Fallback provider/model pairs tried in order when the primary fails. |
| `guardrails` | object | no | -- | Input and output filtering rules. |
| `capabilities` | object | no | -- | Multimodal capabilities (vision, audio, image generation). |
| `cache` | object | no | -- | Response caching with TTL. |
| `logging` | object | no | -- | Per-agent logging level and export target. |
| `extends` | string | no | -- | Name of another agent to inherit config from. |

---

## Field-by-Field Explanation

### `version`

Every config file must start with `version: 1`. This field enables forward-compatible schema evolution. If the SDK encounters an unsupported version, it raises a clear error telling you to upgrade.

### `name`

The name uniquely identifies the agent. It must match the YAML filename without the extension. An agent at `agents/support-bot.yaml` must have `name: support-bot`. Names are limited to letters, numbers, hyphens, and underscores.

### `provider` and `model`

The `provider` field selects the LLM backend. Crystal AI ships with five built-in providers:

| Provider | Value | Chat | Embeddings |
|----------|-------|------|------------|
| OpenAI | `openai` | yes | yes |
| Anthropic | `anthropic` | yes | no |
| Groq | `groq` | yes | no |
| Google (Gemini) | `google` | yes | yes |
| Together AI | `together` | yes | no |

The `model` field is the exact model identifier sent to the provider API. Crystal AI does not validate model names against a list because providers add new models frequently.

> **Tip:** You can point any provider at a custom endpoint using `base_url`. This works well with local servers like Ollama or vLLM that implement the OpenAI-compatible API.

```yaml
provider: openai
model: llama3
base_url: http://localhost:11434/v1
```

### `system_prompt`

The system prompt defines the agent's personality, instructions, and constraints. Use the YAML block scalar `|` for multiline prompts:

```yaml
system_prompt: |
  You are a helpful customer support agent for AcmeCorp.
  Always be polite and professional.
  If you cannot resolve an issue, escalate to a human agent.

  Customer tier: {customer_tier}
```

Template variables use `{variable_name}` syntax. Variables are substituted at runtime from the `variables` argument passed to `agent.run()`. Unresolved variables are left as-is without raising an error.

The system prompt can also be specified as an object with explicit defaults:

```yaml
system_prompt:
  template: "You are an assistant for {company}. Speak in {tone} tone."
  variables:
    company: AcmeCorp
    tone: professional
```

### `temperature`

Controls randomness in the model's output. Lower values (e.g. `0.1`) produce more deterministic, focused responses. Higher values (e.g. `1.5`) produce more creative, varied output. The default of `1.0` is a balanced starting point.

- Use `0.0`--`0.3` for factual tasks, code analysis, and structured output.
- Use `0.5`--`0.8` for general conversation and customer support.
- Use `0.8`--`1.2` for creative writing, brainstorming, and ad copy.

### `tools`

A list of tool names. Each name must correspond to a file at `tools/<name>.yaml`. Tools are verified at runtime, not at config parse time. By default, a missing tool file produces a warning; set `x-strict-tools: true` to make it an error.

```yaml
tools:
  - get-ticket
  - update-ticket
  - send-email
```

See the [Tools Guide](./tools.md) for details on creating and configuring tools.

---

## System Prompt Best Practices

1. **Start with identity.** Open with a clear role statement: "You are a senior security analyst..." This grounds the model's behavior.

2. **Be specific about output format.** If you need structured output, describe the exact format: headings, tables, numbered lists, or JSON.

3. **Provide focus areas.** List the specific topics or categories the agent should cover. Bullet points work well.

4. **Set boundaries.** State what the agent should NOT do: "Never recommend specific medications" or "If you cannot resolve the issue, escalate."

5. **Use template variables for dynamic context.** Instead of hardcoding values like customer names or tiers, use `{variable}` placeholders.

6. **Keep it concise.** Long system prompts consume input tokens on every request. Aim for the minimum effective prompt.

```yaml
system_prompt: |
  You are a senior advertising strategist with deep expertise in digital
  and social media marketing.

  When given a brief, produce a concise creative strategy covering:
  1. Target Audience
  2. Tone of Voice
  3. Key Messages (3-5 core ideas)
  4. Emotional Hook
  5. Visual Direction
  6. Copy Angles (3 headline directions)

  Be specific, actionable, and concise. No filler.
```

---

## Model Selection and Provider Override

Different tasks benefit from different models. Use low-cost, fast models for simple routing or classification, and more capable models for complex reasoning or generation.

```yaml
# Fast and cheap — good for classification
provider: groq
model: llama-3.1-8b-instant
temperature: 0.1

# Balanced — good for general tasks
provider: openai
model: gpt-4o
temperature: 0.7

# High capability — good for complex generation
provider: google
model: gemini-2.5-flash
temperature: 0.9
max_tokens: 32000
```

### Fallback Providers

If the primary provider fails (rate limit, outage, timeout), Crystal AI can automatically try fallback provider/model pairs:

```yaml
provider: openai
model: gpt-4o
fallback:
  - provider: anthropic
    model: claude-sonnet-4-20250514
  - provider: google
    model: gemini-2.5-flash
```

Fallback is attempted in order. Each entry must specify both `provider` and `model`.

### Retry Configuration

Control how failed requests are retried before falling back:

```yaml
retry:
  max_attempts: 3                # 1-10, default: 3
  backoff: exponential           # none | linear | exponential
  retry_on:                      # which errors trigger retry
    - rate_limit
    - server_error
    - timeout
```

---

## Structured Output

Force the agent to return structured JSON matching a schema:

```yaml
output:
  format: json          # json | text (default: text)
  strict: true          # enforce schema validation (default: false)
  schema:
    type: object
    required:
      - summary
      - items
    properties:
      summary:
        type: string
      items:
        type: array
        items:
          type: object
          required:
            - name
            - score
          properties:
            name:
              type: string
            score:
              type: number
```

When `format: json` is set, the model is instructed to produce valid JSON. The `schema` field provides the JSON Schema definition. With `strict: true`, the output is validated against the schema and an error is raised if it does not conform.

---

## RAG Integration

Connect an agent to external vector stores for retrieval-augmented generation. When RAG is configured, the agent embeds the user's query, retrieves relevant chunks from the vector database, and injects them into the system prompt as context.

```yaml
rag:
  provider: pinecone               # pinecone | chroma | qdrant | weaviate | pgvector
  match_count: 5                   # max chunks to retrieve (1-50, default: 5)
  match_threshold: 0.7             # minimum similarity score (0.0-1.0, default: 0.7)
  embedding_provider: openai       # LLM provider for query embedding
  embedding_model: text-embedding-3-small
  connection:                      # provider-specific connection details
    host: https://my-index.svc.pinecone.io
    api_key_env: PINECONE_API_KEY
    namespace: product-docs
```

### Connection Settings by Provider

| Vector Store | Required Connection Fields |
|-------------|---------------------------|
| Pinecone | `host`, `api_key_env`, optional `namespace` |
| Chroma | `url`, `collection`, optional `api_key_env` |
| Qdrant | `url`, `collection`, optional `api_key_env`, `vector_name` |
| Weaviate | `url`, `class_name`, optional `text_key`, `properties`, `api_key_env` |
| pgvector | `connection_string_env`, `table`, optional `content_column`, `embedding_column`, `source_column` |

> **Note:** Weaviate supports built-in vectorization via its `nearText` module. When using it, `embedding_provider` and `embedding_model` can be omitted.

---

## MCP Server Attachment

Agents can connect to [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers to dynamically discover and use tools at runtime. MCP tools are merged with file-based tools and made available in the agent's tool loop.

### stdio Transport

Spawns the MCP server as a child process:

```yaml
mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - /path/to/allowed/directory
    env:
      NODE_ENV: production
```

### SSE Transport

Connects to an existing MCP server over HTTP:

```yaml
mcp:
  - transport: sse
    name: github
    url: https://mcp.github.com/sse
```

MCP tools are exposed with the naming convention `mcp_{serverName}_{toolName}` to prevent collisions. Connections are opened at the start of `agent.run()` and closed when the run completes.

---

## Guardrails

Apply input and output filtering rules to control what the agent processes and produces:

```yaml
guardrails:
  input:
    max_length: 10000              # reject inputs longer than this (characters)
    block_patterns:                # regex patterns to block
      - "(?i)ignore previous instructions"
    block_topics:                  # topic keywords to block
      - competitor_pricing
    pii_action: redact             # block | redact | warn | none (default: none)
  output:
    max_length: 5000
    block_patterns:
      - "(?i)internal use only"
    require_patterns:              # output must match at least one
      - "Sources:"
    pii_action: warn
```

---

## Capabilities (Multimodal)

Enable multimodal input and output for providers that support it:

```yaml
capabilities:
  vision: true                     # accept image inputs (default: false)
  max_image_size: 4194304          # max image bytes (optional)
  audio_input: true                # accept audio inputs (default: false)
  audio_output: true               # generate audio (default: false)
  image_generation: true           # generate images (default: false)
  output_modalities:               # which modalities to produce
    - text
    - image
  tts_voice: nova                  # text-to-speech voice name
  tts_model: tts-1                 # text-to-speech model
  transcription_model: whisper-1   # speech-to-text model
  image_gen_model: dall-e-3        # image generation model
```

---

## Caching and Logging

### Cache

Enable response caching to avoid redundant LLM calls for identical inputs:

```yaml
cache:
  enabled: true
  ttl: 3600                        # cache lifetime in seconds (default: 3600)
  force: false                     # bypass cache for this request (optional)
```

### Logging

Override the project-level logging config for a specific agent:

```yaml
logging:
  level: debug                     # debug | info | warn | error (default: info)
  trace: true                      # include full request/response traces (default: false)
  export: file                     # stdout | file | webhook (default: stdout)
```

---

## Agent Inheritance

Use the `extends` field to inherit configuration from another agent. The child agent overrides only the fields it specifies:

```yaml
version: 1
name: support-agent-spanish
extends: support-agent
system_prompt: |
  Eres un agente de soporte al cliente para AcmeCorp.
  Responde siempre en espanol.
```

The child inherits all fields from the parent (`provider`, `model`, `tools`, `rag`, etc.) and overrides `system_prompt`.

---

## Complete Examples

### Simple Chatbot

A minimal conversational agent with no tools or RAG:

```yaml
version: 1
name: chatbot
description: General-purpose conversational assistant
provider: openai
model: gpt-4o
temperature: 0.7
max_tokens: 2048
system_prompt: |
  You are a friendly, helpful assistant. Answer questions clearly
  and concisely. If you are unsure about something, say so.
```

### Multi-Tool Agent with Delegation

An orchestrator agent that delegates to specialist agents via tool calls:

```yaml
version: 1
name: ad-creative-director
description: >
  Orchestrates a team of specialist agents (strategist, copywriter,
  designer) to produce social media ad templates.
provider: together
model: meta-llama/Llama-3.3-70B-Instruct-Turbo
temperature: 0.7
max_tokens: 16000

system_prompt: |
  You are a creative director leading a team of specialist AI agents.

  Your team:
  - call-strategist: Analyzes briefs and defines creative strategy
  - call-copywriter: Writes headlines, taglines, body copy, and CTAs
  - call-designer: Generates production-ready HTML + Tailwind templates

  Follow this exact sequence:
  1. Call call-strategist with the full brief.
  2. Call call-copywriter with the brief + strategy output.
  3. Call call-designer with type, count, brief, strategy, and copy.
  4. Output the raw JSON returned by call-designer verbatim.

tools:
  - call-strategist
  - call-copywriter
  - call-designer

output:
  format: json
  schema:
    type: object
    required:
      - templates
    properties:
      templates:
        type: array

retry:
  max_attempts: 2
  backoff: exponential

logging:
  level: info
```

### Code Review Agent

A focused analysis agent with low temperature for deterministic output:

```yaml
version: 1
name: code-security-auditor
description: Audits code for OWASP Top 10 vulnerabilities
provider: google
model: gemini-2.5-flash
temperature: 0.1
max_tokens: 4096

system_prompt: |
  You are a senior application security engineer specializing in
  OWASP Top 10 vulnerabilities.

  Analyze the provided code and identify ALL security issues.
  For each issue:
  - Assign severity: CRITICAL / HIGH / MEDIUM / LOW
  - Name the vulnerability type
  - State the exact line number(s)
  - Quote the vulnerable code snippet
  - Explain why it is dangerous
  - Provide a complete corrected code snippet

  Format your response as structured markdown with a summary table.
```

### Structured Output Agent

An agent that returns validated JSON matching a strict schema:

```yaml
version: 1
name: ad-template-generator
description: Generates social media ad templates as structured HTML + React
provider: google
model: gemini-2.5-flash
temperature: 0.9
max_tokens: 32000

system_prompt: |
  You are an expert UI designer specializing in social media ad templates.
  Return a JSON object with a `templates` array...

output:
  format: json
  strict: true
  schema:
    type: object
    required:
      - templates
    properties:
      templates:
        type: array
        items:
          type: object
          required:
            - name
            - description
            - previewHtml
            - reactCode

retry:
  max_attempts: 3
  backoff: exponential

capabilities:
  vision: true

cache:
  enabled: true
  ttl: 3600
```

### Agent with MCP Servers

An agent that discovers tools dynamically from MCP servers:

```yaml
version: 1
name: dev-assistant
description: Development assistant with filesystem and GitHub access
provider: anthropic
model: claude-sonnet-4-20250514
temperature: 0.3
max_tokens: 8192

system_prompt: |
  You are a development assistant. You can read files from the
  project directory and interact with GitHub repositories.

mcp:
  - transport: stdio
    name: filesystem
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - ./src
  - transport: sse
    name: github
    url: https://mcp.github.com/sse
```

---

## Running Agents

### CLI

```bash
# Interactive run
crystalai run support-agent "My order hasn't arrived"

# With template variables
crystalai run support-agent "Help me" --var customer_tier=premium

# Stream output
crystalai run support-agent "Hello" --stream
```

### TypeScript SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const crystral = new Crystral();
const agent = crystral.loadAgent('support-agent');

const result = await agent.run('My order is missing', {
  variables: { customer_tier: 'premium' },
});

console.log(result.content);
```

### Studio

Launch the visual dashboard with `crystalai studio` and select an agent from the chat interface.

---

## Agent Execution Flow

When you run an agent, Crystal AI follows this sequence:

1. Load the agent config from `agents/<name>.yaml` and validate it with Zod.
2. Resolve the API key for the configured provider.
3. Create or resume a conversation session (SQLite).
4. If RAG is configured, embed the user query and retrieve relevant chunks.
5. Build the message array: system prompt (with RAG context injected), conversation history, and the new user message.
6. Load and format all referenced tools (file-based and MCP).
7. Enter the tool-calling loop (max 10 iterations):
   - Send messages to the LLM.
   - If the model returns tool calls, execute each tool and append results.
   - If the model returns a final response, exit the loop.
8. Save the response to the session and log token usage.

---

## Related Documentation

- [Tools Guide](./tools.md) -- Defining and configuring tools
- [Workflows Guide](./workflows.md) -- Multi-agent orchestration
- [MCP Guide](./mcp.md) -- Connecting to MCP servers for dynamic tools
- [Providers Guide](./providers.md) -- LLM provider configuration and model selection
- [CLI Reference](./cli-reference.md) -- Running agents from the command line
- [Examples](./examples.md) -- Complete example projects
- [Configuration Specification](../CONFIG_SPEC.md) -- Full YAML schema reference
- [Architecture](../ARCHITECTURE.md) -- Internal design and data flow
