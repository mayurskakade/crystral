# @crystralai/client

[![npm version](https://img.shields.io/npm/v/@crystralai/client?style=flat-square)](https://www.npmjs.com/package/@crystralai/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](https://www.npmjs.com/package/@crystralai/client)

**Universal AI client for Crystral — works everywhere `fetch` does.**

| Environment | Status |
|---|---|
| Browser (React, Vue, Svelte…) | ✅ |
| React Native | ✅ |
| Electron (renderer + main) | ✅ |
| Node.js ≥ 18 | ✅ |
| Cloudflare Workers / Vercel Edge | ✅ |
| Next.js (client + server) | ✅ |

Zero Node.js dependencies. No `better-sqlite3`. No filesystem. No native addons.
Uses only `fetch` and `crypto.randomUUID()` — both available natively in all target environments.

---

## Installation

```bash
npm install @crystralai/client
# or
pnpm add @crystralai/client
```

---

## Quick Start

```typescript
import { CrystralClient } from '@crystralai/client';

const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: userProvidedKey,   // BYOK — user supplies their own key
  systemPrompt: 'You are a helpful assistant.',
});

const result = await client.run('What is the capital of France?');
console.log(result.content); // "Paris"
```

---

## BYOK Model

This package is designed for **Bring Your Own Key** applications where the end-user provides their own API key. Never hard-code API keys in source code.

```typescript
// React example — key from user input
const [apiKey, setApiKey] = useState('');

const client = new CrystralClient({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey,  // user typed this in
});
```

---

## Providers

| Provider | Value | Example model |
|---|---|---|
| OpenAI | `openai` | `gpt-4o`, `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-3-5-sonnet-20241022` |
| Groq | `groq` | `llama-3.3-70b-versatile` |
| Google | `google` | `gemini-1.5-pro` |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

```typescript
// Switch provider at any time
const client = new CrystralClient({ provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey });
```

---

## Multi-turn Conversations

```typescript
// Turn 1 — new session created automatically
const r1 = await client.run('My name is Alice.');
console.log(r1.sessionId); // "uuid-..."

// Turn 2 — continue the same conversation
const r2 = await client.run('What is my name?', { sessionId: r1.sessionId });
console.log(r2.content); // "Your name is Alice."
```

---

## Streaming

### Callback style
```typescript
const result = await client.run('Write a short poem', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});
```

### Async generator style
```typescript
for await (const token of client.stream('Tell me a story')) {
  process.stdout.write(token);
}
```

---

## Tools

Pass JavaScript functions as tools — the model decides when to call them.

```typescript
const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey,
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name' } },
        required: ['city'],
      },
      execute: async ({ city }) => {
        const res = await fetch(`https://wttr.in/${city}?format=j1`);
        const data = await res.json();
        return { temp: data.current_condition[0].temp_C + '°C' };
      },
    },
  ],
});

const result = await client.run('What is the weather in Tokyo?');
// Model calls get_weather("Tokyo"), gets result, replies naturally
console.log(result.content);
console.log(result.toolCalls); // [{ name: 'get_weather', args: { city: 'Tokyo' }, result: {...} }]
```

---

## Session Storage

### Default — in-memory (all environments)

```typescript
const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey });
// Sessions live in memory; lost on page refresh
```

### Browser localStorage

```typescript
import { CrystralClient, LocalStorageAdapter } from '@crystralai/client';

const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey,
  storage: new LocalStorageAdapter('my-app'), // namespaced, survives refresh
});
```

### Custom adapter

Implement `StorageAdapter` for IndexedDB, AsyncStorage (React Native), SQLite, or any backend:

```typescript
import type { StorageAdapter, Message } from '@crystralai/client';

class MyStorage implements StorageAdapter {
  createSession() { return crypto.randomUUID(); }
  getMessages(sessionId: string): Message[] { /* ... */ return []; }
  saveMessages(sessionId: string, messages: Message[]) { /* ... */ }
  listSessions() { return []; }
  deleteSession(sessionId: string) { /* ... */ }
}
```

---

## Custom / Proxy Base URL

Point to a CORS proxy, local Ollama instance, or OpenAI-compatible API:

```typescript
const client = new CrystralClient({
  provider: 'openai',
  model: 'llama3',
  apiKey: 'ollama',
  baseUrl: 'http://localhost:11434/v1',  // Ollama OpenAI-compatible endpoint
});
```

---

## System Prompt Variables

Use `{variable}` placeholders in the system prompt, filled at runtime:

```typescript
const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey,
  systemPrompt: 'You are a support agent for {company}. The user is {userName}.',
});

const result = await client.run('I need help', {
  variables: { company: 'Acme Corp', userName: 'Alice' },
});
```

---

## Multimodal (Vision)

Pass images alongside the message for vision-capable models:

```typescript
const result = await client.run('What is in this image?', {
  images: [
    { data: base64String, media_type: 'image/jpeg' },
    // or a public URL:
    { data: 'https://example.com/photo.jpg', media_type: 'image/jpeg' },
  ],
});
```

---

## API Reference

### `new CrystralClient(config)`

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `Provider` | Yes | `openai` \| `anthropic` \| `groq` \| `google` \| `together` |
| `model` | `string` | Yes | Model identifier |
| `apiKey` | `string` | Yes | Provider API key (BYOK) |
| `systemPrompt` | `string` | No | System-level instructions. Supports `{variable}` interpolation. |
| `temperature` | `number` | No | Sampling temperature (0–2) |
| `maxTokens` | `number` | No | Max tokens to generate |
| `tools` | `ClientTool[]` | No | Tools the model can call |
| `storage` | `StorageAdapter` | No | Session storage. Defaults to `MemoryStorage`. |
| `baseUrl` | `string` | No | Override provider API base URL |

### `client.run(message, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `sessionId` | `string` | auto | Resume an existing session |
| `stream` | `boolean` | `false` | Enable streaming via `onToken` |
| `onToken` | `(token: string) => void` | — | Called per token when streaming |
| `onToolCall` | `(name, args) => void` | — | Called before tool execution |
| `onToolResult` | `(name, result, success) => void` | — | Called after tool execution |
| `maxToolIterations` | `number` | `10` | Max tool-call cycles |
| `images` | `ImageInput[]` | — | Multimodal image inputs |
| `variables` | `Record<string, string>` | — | System prompt variable substitutions |

### `RunResult`

```typescript
{
  content: string;           // Model's final response
  sessionId: string;         // Pass to continue conversation
  messages: Message[];       // Full history for this session
  toolCalls: Array<{ name, args, result, success }>;
  usage: { input, output, total };
  durationMs: number;
}
```

### `client.stream(message, options?)` — async generator

### `client.getHistory(sessionId)` → `Message[]`
### `client.clearSession(sessionId)` — reset history
### `client.deleteSession(sessionId)` — remove session
### `client.listSessions()` → `string[]`
### `client.setApiKey(apiKey)` — update key at runtime

---

## Error Handling

```typescript
import {
  CrystralClientError,
  ProviderError,
  RateLimitError,
  ToolExecutionError,
  InvalidConfigError,
} from '@crystralai/client';

try {
  const result = await client.run('Hello');
} catch (err) {
  if (err instanceof RateLimitError) {
    const wait = err.retryAfterMs ?? 5000;
    console.warn(`Rate limited. Retry after ${wait}ms`);
  } else if (err instanceof ProviderError) {
    console.error(`[${err.provider}] HTTP ${err.statusCode}: ${err.message}`);
  } else if (err instanceof ToolExecutionError) {
    console.error(`Tool "${err.toolName}" failed: ${err.message}`);
  }
}
```

---

## React Example

```tsx
import { useState } from 'react';
import { CrystralClient, LocalStorageAdapter } from '@crystralai/client';

export function Chat() {
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();

  const client = new CrystralClient({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey,
    storage: new LocalStorageAdapter(),
  });

  async function send(text: string) {
    const result = await client.run(text, { sessionId, stream: true, onToken: (t) => console.log(t) });
    setSessionId(result.sessionId);
    setMessages(prev => [...prev, `You: ${text}`, `AI: ${result.content}`]);
  }

  return (
    <div>
      <input placeholder="Your API key" onChange={e => setApiKey(e.target.value)} />
      {/* chat UI */}
    </div>
  );
}
```

---

## Difference vs `@crystralai/sdk`

| Feature | `@crystralai/client` | `@crystralai/sdk` |
|---|---|---|
| Browser / React Native | ✅ | ❌ |
| Zero dependencies | ✅ | ❌ |
| YAML agent config | ❌ | ✅ |
| File-based tools | ❌ | ✅ |
| SQLite session storage | ❌ | ✅ |
| RAG | ❌ | ✅ |
| MCP servers | ❌ | ✅ |
| Workflows | ❌ | ✅ |

Use `@crystralai/client` for frontend / BYOK apps. Use `@crystralai/sdk` for server-side agents with YAML configuration.

---

## License

MIT © [Mayur Kakade](https://github.com/mayurskakade)
