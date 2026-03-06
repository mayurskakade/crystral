# Providers

Crystral supports multiple LLM providers.  This guide covers credential setup,
model selection, and provider-specific notes.

---

## Supported LLM Providers

| Provider | `provider` value | Default Model | Environment Variable |
|----------|-----------------|---------------|----------------------|
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| Groq | `groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Google | `google` | `gemini-1.5-pro` | `GOOGLE_API_KEY` |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |

---

## Credential Resolution Order

For each provider, Crystral looks up the API key in this order:

1. **Process environment** — the key is already in `process.env`
2. **Project `.env` file** — `<cwd>/.env` (loaded automatically via `dotenv`)
3. **Global credentials file** — `~/.crystral/credentials`

The first match wins.

---

## Setting Credentials

### Option 1: Environment Variables (Recommended for Production)

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

### Option 2: Project `.env` File (Recommended for Development)

Create `.env` in your project root (add to `.gitignore`):

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIza...
TOGETHER_API_KEY=...
```

### Option 3: Global Credentials File

Create `~/.crystral/credentials` (YAML format):

```yaml
openai:
  api_key: sk-...
anthropic:
  api_key: sk-ant-...
groq:
  api_key: gsk_...
google:
  api_key: AIza...
together:
  api_key: ...
```

This is useful when you want credentials shared across multiple projects.

---

## Provider-Specific Notes

### OpenAI

- Supports all `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, and `gpt-3.5-turbo` variants
- Tool calling is available on all `gpt-4` and `gpt-4o` models
- Sign up at [platform.openai.com](https://platform.openai.com)

### Anthropic

- Recommended model: `claude-3-5-sonnet-20241022` (best balance of speed and quality)
- Also available: `claude-3-opus-20240229`, `claude-3-haiku-20240307`
- Sign up at [console.anthropic.com](https://console.anthropic.com)

### Groq

- Extremely fast inference (LPU hardware)
- Subject to aggressive rate limits on the free tier — implement exponential
  back-off using `RateLimitError.retryAfterMs` (see [error-handling.md](error-handling.md))
- Available models include Llama 3, Mixtral, and Gemma variants
- Sign up at [console.groq.com](https://console.groq.com)

### Google (Gemini)

- Requires creating a project in Google Cloud and enabling the Generative AI API
- `GOOGLE_API_KEY` is an API key from [aistudio.google.com](https://aistudio.google.com)
- Available models: `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`

### Together AI

- Access to hundreds of open-source models (Llama, Mistral, Qwen, etc.)
- Sign up at [api.together.xyz](https://api.together.xyz)
- Use the full model path as the `model` value in agent YAML, e.g.
  `meta-llama/Llama-3.3-70B-Instruct-Turbo`

---

## Embedding Providers

Embedding providers are used by RAG collections to vectorise documents and
queries.  They are configured per-collection in `.crystral-rag.yaml`, not in
the agent YAML.

| Provider | `embedding_provider` | Models | Environment Variable |
|----------|---------------------|--------|----------------------|
| OpenAI | `openai` | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` | `OPENAI_API_KEY` |
| Google | `google` | `text-embedding-004`, `embedding-001` | `GOOGLE_API_KEY` |

Example `.crystral-rag.yaml`:

```yaml
name: my-docs
embedding_provider: openai
embedding_model: text-embedding-3-small
```

---

## Choosing a Provider

| Use Case | Recommendation |
|----------|----------------|
| Best quality | Anthropic `claude-3-5-sonnet` or OpenAI `gpt-4o` |
| Lowest cost | Groq `llama-3.3-70b-versatile` (free tier available) |
| Fastest response | Groq |
| Open-source models | Together AI |
| Multimodal (vision) | OpenAI `gpt-4o` or Google `gemini-1.5-pro` |
| Long context (200k+) | Anthropic `claude-3-5-sonnet` |
