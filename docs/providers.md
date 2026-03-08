# LLM Providers

Crystal AI ships with five built-in LLM providers. Every agent specifies a `provider` and `model` in its YAML config, and Crystal AI handles credential resolution, request formatting, and response normalization behind a unified `ProviderClient` interface.

---

## Supported Providers

| Provider | Config value | API style | Chat | Embeddings | Vision | Tool calling | Streaming |
|----------|-------------|-----------|------|------------|--------|-------------|-----------|
| OpenAI | `openai` | OpenAI API | Yes | Yes | Yes | Yes | Yes |
| Anthropic | `anthropic` | Anthropic Messages API | Yes | No | Yes | Yes | Yes |
| Google (Gemini) | `google` | Gemini REST API | Yes | Yes | Yes | Yes | Yes |
| Groq | `groq` | OpenAI-compatible | Yes | No | No | Yes | Yes |
| Together AI | `together` | OpenAI-compatible | Yes | No | No | Yes | Yes |

> **Note:** The `provider` value in YAML must be lowercase. Writing `OpenAI` or `Anthropic` will produce a validation error with a helpful suggestion.

---

## Provider Comparison

### Default Models

Each built-in provider has a default model used when the `model` field is omitted in programmatic SDK usage:

| Provider | Default model |
|----------|--------------|
| `openai` | `gpt-4o-mini` |
| `anthropic` | `claude-3-haiku-20240307` |
| `groq` | `llama-3.1-70b-versatile` |
| `google` | `gemini-1.5-flash` |
| `together` | `meta-llama/Llama-3-70b-chat-hf` |

> **Tip:** In YAML agent configs, `model` is a required field. Default models only apply when using the SDK without specifying a model explicitly.

### Popular Models by Provider

| Provider | Models | Pricing tier |
|----------|--------|-------------|
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` | $$$ (4o) to $ (mini) |
| `anthropic` | `claude-sonnet-4-20250514`, `claude-3.5-sonnet-20241022`, `claude-3-haiku-20240307` | $$$ (opus) to $ (haiku) |
| `google` | `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash` | $$ (pro) to $ (flash) |
| `groq` | `llama-3.1-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` | $ (fast inference) |
| `together` | `meta-llama/Llama-3-70b-chat-hf`, `mistralai/Mixtral-8x7B-Instruct-v0.1` | $ (open-source models) |

> **Note:** Model identifiers are passed directly to the provider API and are not validated by Crystal AI. Providers add new models frequently -- use whatever model string the provider supports.

### Cost Tracking

Crystal AI tracks token usage and estimates costs per inference call. Built-in cost rates (USD per 1M tokens) are defined for common models:

| Provider:Model | Input cost | Output cost |
|----------------|-----------|-------------|
| `openai:gpt-4o` | $5.00 | $15.00 |
| `openai:gpt-4o-mini` | $0.15 | $0.60 |
| `openai:gpt-4-turbo` | $10.00 | $30.00 |
| `anthropic:claude-opus` | $15.00 | $75.00 |
| `anthropic:claude-sonnet` | $3.00 | $15.00 |
| `anthropic:claude-haiku` | $0.25 | $1.25 |
| `google:gemini-1.5-pro` | $3.50 | $10.50 |
| `google:gemini-1.5-flash` | $0.35 | $1.05 |

Models not in this table report a cost of `$0.00`. Cost data is logged in the `inference_logs` table and visible in [Studio](./studio.md).

---

## Credential Configuration

Each provider requires an API key. Crystal AI resolves credentials in this priority order (first match wins):

1. **Environment variable** -- e.g. `OPENAI_API_KEY`
2. **Project `.env` file** -- `<project-root>/.env`, parsed with dotenv
3. **Global credentials file** -- `~/.crystalai/credentials` (INI format)

### Environment Variable Names

| Provider | Environment variable |
|----------|---------------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `google` | `GOOGLE_API_KEY` |
| `together` | `TOGETHER_API_KEY` |

### Setting Credentials via CLI

```bash
# Interactive -- prompts for the API key
crystalai auth add openai

# List configured providers (keys are masked)
crystalai auth list

# Remove a stored credential
crystalai auth remove openai
```

### Setting Credentials via Environment

```bash
# Shell export
export OPENAI_API_KEY=sk-proj-abc123...

# Or in your project .env file
echo "OPENAI_API_KEY=sk-proj-abc123..." >> .env
```

### Global Credentials File

The file at `~/.crystalai/credentials` uses INI format:

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
```

> **Warning:** The credentials file must have `0600` permissions (owner read/write only). Crystal AI will warn if permissions are too open. Run `chmod 600 ~/.crystalai/credentials` to fix.

---

## YAML Configuration

### Basic Agent with Provider

Every agent config requires `provider` and `model`:

```yaml
version: 1
name: my-agent
provider: openai
model: gpt-4o
system_prompt: You are a helpful assistant.
```

### Provider-Specific Examples

**OpenAI:**

```yaml
version: 1
name: openai-agent
provider: openai
model: gpt-4o
temperature: 0.7
max_tokens: 4096
top_p: 1.0
frequency_penalty: 0.0
presence_penalty: 0.0
```

**Anthropic:**

```yaml
version: 1
name: anthropic-agent
provider: anthropic
model: claude-sonnet-4-20250514
temperature: 0.5
max_tokens: 8192
stop_sequences:
  - "END"
```

**Google (Gemini):**

```yaml
version: 1
name: gemini-agent
provider: google
model: gemini-1.5-pro
temperature: 0.8
max_tokens: 4096
```

**Groq:**

```yaml
version: 1
name: groq-agent
provider: groq
model: llama-3.1-70b-versatile
temperature: 0.3
max_tokens: 4096
```

**Together AI:**

```yaml
version: 1
name: together-agent
provider: together
model: meta-llama/Llama-3-70b-chat-hf
temperature: 0.7
max_tokens: 2048
```

### Completion Parameters

All providers support these fields in the agent config:

| Field | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `temperature` | number | `1.0` | 0.0--2.0 | Controls randomness. Lower = more deterministic. |
| `max_tokens` | integer | `4096` | 1--1,000,000 | Maximum tokens in the response. |
| `top_p` | number | `1.0` | 0.0--1.0 | Nucleus sampling threshold. |
| `presence_penalty` | number | `0.0` | -2.0--2.0 | Penalizes repeated topics. |
| `frequency_penalty` | number | `0.0` | -2.0--2.0 | Penalizes repeated tokens. |
| `stop_sequences` | list | `[]` | -- | Strings that stop generation. |

> **Note:** Not all providers support every parameter. Unsupported parameters are passed through to the API, which may return an error.

---

## Per-Agent Provider Override

Different agents in the same project can use different providers. There is no project-level default provider -- each agent declares its own.

```yaml
# agents/fast-responder.yaml
version: 1
name: fast-responder
provider: groq
model: llama-3.1-8b-instant
temperature: 0.2

# agents/deep-thinker.yaml
version: 1
name: deep-thinker
provider: anthropic
model: claude-sonnet-4-20250514
temperature: 0.7
max_tokens: 8192
```

### Fallback Providers

If a primary provider fails (rate limit, server error, timeout), Crystal AI can automatically retry with fallback providers:

```yaml
version: 1
name: resilient-agent
provider: openai
model: gpt-4o
retry:
  max_attempts: 3
  backoff: exponential
  retry_on:
    - rate_limit
    - server_error
    - timeout
fallback:
  - provider: anthropic
    model: claude-sonnet-4-20250514
  - provider: google
    model: gemini-1.5-pro
```

The `retry` config controls how many times to retry the primary provider before falling back. The `fallback` list is tried in order.

---

## Multimodal Support

Provider capabilities vary. The table below summarizes what each provider supports:

| Capability | OpenAI | Anthropic | Google | Groq | Together |
|-----------|--------|-----------|--------|------|----------|
| Vision (image input) | Yes | Yes | Yes | No | No |
| Document input (PDF) | No | Yes | Yes | No | No |
| Audio input (native) | Yes | No | Yes | No | No |
| Transcription (speech-to-text) | Yes | No | No | Yes | Yes |
| Text-to-speech (TTS) | Yes | No | Yes | No | Yes |
| Image generation | Yes | No | No | No | Yes |
| Embeddings | Yes | No | Yes | No | No |

To enable vision for an agent, add the `capabilities` block:

```yaml
version: 1
name: vision-agent
provider: openai
model: gpt-4o
capabilities:
  vision: true
```

See the [Agents Guide](./agents.md) for full details on the `capabilities` config.

---

## Streaming

All five providers support streaming responses. Crystal AI normalizes the different streaming formats (OpenAI SSE, Anthropic SSE, Gemini SSE) into a unified `AsyncIterable<string>` interface.

```typescript
// SDK streaming
const crystral = new Crystral();
const agent = crystral.loadAgent('my-agent');

for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

In the CLI, streaming is the default behavior for `crystalai run`.

---

## Custom and OpenAI-Compatible Providers

For providers that implement the OpenAI-compatible API (Ollama, LM Studio, vLLM, Fireworks, Perplexity), use the `base_url` field or the `openai-compatible` provider shortcut.

### Using `base_url` Override

```yaml
version: 1
name: local-agent
provider: openai
model: llama3
base_url: http://localhost:11434/v1
```

### Using `openai-compatible` Provider

```yaml
version: 1
name: ollama-agent
provider: openai-compatible
model: llama3
base_url: http://localhost:11434/v1
```

> **Note:** The `openai-compatible` provider requires `base_url` to be set. It uses the `OpenAIProvider` internally with the custom base URL.

### Registering Custom Providers (SDK)

For non-OpenAI-compatible providers, register a custom provider factory at runtime:

```typescript
import { registerProvider } from '@crystralai/core';

registerProvider('my-provider', (apiKey) => new MyProviderClient(apiKey));
```

Custom providers must implement the `ProviderClient` interface: `complete()`, `stream()`, `embed()`, and the capability flags (`supportsVision()`, `supportsEmbeddings()`, etc.).

---

## Model Selection Best Practices

1. **Start with the cheapest model that works.** Use `gpt-4o-mini`, `gemini-1.5-flash`, or `llama-3.1-8b-instant` during development. Upgrade to larger models only when quality demands it.

2. **Match the model to the task.** Use high-capability models (`gpt-4o`, `claude-sonnet-4-20250514`) for complex reasoning and tool calling. Use fast models (`groq` with Llama) for simple classification or extraction.

3. **Use Groq for latency-sensitive tasks.** Groq's LPU hardware delivers significantly faster inference on supported models.

4. **Use fallback providers for production reliability.** Configure `retry` and `fallback` so your agents survive provider outages.

5. **Use embeddings providers strategically.** Only OpenAI and Google support embeddings. If your chat provider is Anthropic or Groq, set a separate `embedding_provider` in your RAG config.

6. **Set `temperature` intentionally.** Use `0.0`--`0.3` for deterministic tasks (data extraction, classification). Use `0.7`--`1.0` for creative tasks (writing, brainstorming).

---

## Architecture Details

All providers implement the `ProviderClient` interface defined in `packages/core/src/providers/base.ts`:

```typescript
interface ProviderClient {
  complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult>;
  stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string>;
  embed(text: string, model: string): Promise<number[]>;
  supportsEmbeddings(): boolean;
  supportsVision(): boolean;
  supportsTranscription(): boolean;
  supportsAudioInput(): boolean;
  supportsTTS(): boolean;
  supportsImageGeneration(): boolean;
  supportsDocuments(): boolean;
}
```

The `createProvider(provider, apiKey, baseUrl?)` factory function in `packages/core/src/providers/index.ts` selects the correct implementation. Provider implementations are thin HTTP clients with no external SDK dependencies -- OpenAI, Groq, and Together use the OpenAI-compatible REST format; Anthropic uses its Messages API; Google uses the Gemini REST API.

---

## Related Documentation

- [Configuration Reference](./configuration.md) -- full YAML schema for all config files
- [Agents Guide](./agents.md) -- agent configuration including tools, RAG, and MCP
- [SDK Reference](./sdk.md) -- programmatic TypeScript API
- [RAG Guide](./rag.md) -- embedding providers for vector search
