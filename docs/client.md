# Browser SDK (`@crystralai/client`)

The `@crystralai/client` package is a universal AI client that works everywhere `fetch` does. It is designed for **Bring Your Own Key (BYOK)** applications where end users supply their own API keys, enabling direct LLM access from the browser without a backend proxy.

| Environment | Status |
|---|---|
| Browser (React, Vue, Svelte) | Supported |
| React Native | Supported |
| Electron (renderer + main) | Supported |
| Node.js 18+ | Supported |
| Cloudflare Workers / Vercel Edge | Supported |
| Next.js (client + server) | Supported |

**Zero Node.js dependencies.** No `better-sqlite3`. No filesystem. No native addons. Uses only `fetch` and `crypto.randomUUID()`, both available natively in all target environments.

---

## Installation

```bash
# npm
npm install @crystralai/client

# pnpm
pnpm add @crystralai/client
```

---

## Quick Start

```typescript
import { CrystralClient } from '@crystralai/client';

const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: userProvidedKey,
  systemPrompt: 'You are a helpful assistant.',
});

const result = await client.run('What is the capital of France?');
console.log(result.content); // "Paris"
```

---

## BYOK (Bring Your Own Key)

This package is built for applications where the end user provides their own API key. The key is never sent to your servers -- it goes directly from the user's browser to the LLM provider.

> **Warning:** API keys in the browser are visible to the end user. This is intentional for BYOK apps. Never hard-code keys in source code. Always accept them as user input.

```typescript
// React example -- key from user input
const [apiKey, setApiKey] = useState('');

const client = new CrystralClient({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey,  // user typed this in
});
```

---

## Configuration

### `new CrystralClient(config)`

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `Provider` | Yes | `openai`, `anthropic`, `groq`, `google`, or `together`. Also accepts custom strings. |
| `model` | `string` | Yes | Model identifier (e.g. `gpt-4o`, `claude-3-5-sonnet-20241022`). |
| `apiKey` | `string` | Yes | Provider API key (BYOK). |
| `systemPrompt` | `string` | No | System-level instructions. Supports `{variable}` interpolation. |
| `temperature` | `number` | No | Sampling temperature (0--2). Defaults to provider default. |
| `maxTokens` | `number` | No | Max tokens to generate. |
| `tools` | `ClientTool[]` | No | Tools the model can call (see [Tools](#tools)). |
| `storage` | `StorageAdapter` | No | Session storage adapter. Defaults to in-memory. |
| `baseUrl` | `string` | No | Override provider API base URL. |

---

## Providers

| Provider | Value | Example Models |
|---|---|---|
| OpenAI | `openai` | `gpt-4o`, `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-3-5-sonnet-20241022` |
| Groq | `groq` | `llama-3.3-70b-versatile` |
| Google | `google` | `gemini-1.5-pro` |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

Switch providers at any time by constructing a new client:

```typescript
const client = new CrystralClient({
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  apiKey,
});
```

### Custom / Proxy Base URL

Point to a CORS proxy, local Ollama instance, or any OpenAI-compatible API:

```typescript
const client = new CrystralClient({
  provider: 'openai',
  model: 'llama3',
  apiKey: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
});
```

### Custom Providers

Register and unregister custom provider implementations at runtime:

```typescript
import { registerProvider, unregisterProvider, listProviders } from '@crystralai/client';
```

---

## Running Queries

### `client.run(message, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `sessionId` | `string` | auto | Resume an existing session. |
| `stream` | `boolean` | `false` | Enable streaming via `onToken`. |
| `onToken` | `(token: string) => void` | -- | Called per token when streaming. |
| `onToolCall` | `(name, args) => void` | -- | Called before tool execution. |
| `onToolResult` | `(name, result, success) => void` | -- | Called after tool execution. |
| `maxToolIterations` | `number` | `10` | Max tool-call cycles. |
| `images` | `ImageInput[]` | -- | Legacy multimodal image inputs. |
| `input` | `ContentBlock[]` | -- | Unified multimodal input blocks (audio, image, document). |
| `outputModalities` | `Array<'text' \| 'audio' \| 'image'>` | -- | Requested output modalities. |
| `ttsVoice` | `string` | -- | TTS voice override. |
| `variables` | `Record<string, string>` | -- | System prompt variable substitutions using `{key}` syntax. |

### `RunResult`

```typescript
{
  content: string;           // Model's final response
  sessionId: string;         // Pass to continue conversation
  messages: Message[];       // Full history for this session
  toolCalls: Array<{ name, args, result, success }>;
  usage: { input, output, total };
  durationMs: number;
  media?: MediaOutput[];     // Generated images/audio
  transcript?: string;       // Auto-transcribed audio text
}
```

---

## Multi-turn Conversations

```typescript
// Turn 1 -- new session created automatically
const r1 = await client.run('My name is Alice.');
console.log(r1.sessionId);

// Turn 2 -- continue the same conversation
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

> **Note:** The async generator (`client.stream()`) does not support tool calls. For tool support with streaming, use `client.run()` with `stream: true`.

---

## Tools

Pass JavaScript functions as tools. The model decides when to call them.

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
        properties: {
          city: { type: 'string', description: 'City name' },
        },
        required: ['city'],
      },
      execute: async ({ city }) => {
        const res = await fetch(`https://wttr.in/${city}?format=j1`);
        const data = await res.json();
        return { temp: data.current_condition[0].temp_C + 'C' };
      },
    },
  ],
});

const result = await client.run('What is the weather in Tokyo?');
console.log(result.content);
console.log(result.toolCalls);
```

### `ClientTool` interface

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique tool identifier. |
| `description` | `string` | Description the model sees to decide when to use the tool. |
| `parameters` | `{type: 'object', properties, required?}` | JSON Schema describing the tool's parameters. |
| `execute` | `(args) => Promise<unknown>` | Async function called when the model invokes this tool. Return any serializable value. |

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
    { data: 'https://example.com/photo.jpg', media_type: 'image/jpeg' },
  ],
});
```

---

## Session Storage

### Default -- in-memory

Sessions live in memory and are lost on page refresh:

```typescript
const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey });
```

### Browser localStorage

```typescript
import { CrystralClient, LocalStorageAdapter } from '@crystralai/client';

const client = new CrystralClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey,
  storage: new LocalStorageAdapter('my-app'),  // namespaced, survives refresh
});
```

### Custom adapter

Implement the `StorageAdapter` interface for IndexedDB, AsyncStorage (React Native), SQLite, or any backend:

```typescript
import type { StorageAdapter, Message } from '@crystralai/client';

class MyStorage implements StorageAdapter {
  createSession(): string { return crypto.randomUUID(); }
  getMessages(sessionId: string): Message[] { /* ... */ return []; }
  saveMessages(sessionId: string, messages: Message[]): void { /* ... */ }
  listSessions(): string[] { return []; }
  deleteSession(sessionId: string): void { /* ... */ }
}
```

---

## Session Management Methods

| Method | Signature | Description |
|---|---|---|
| `getHistory` | `(sessionId: string) => Message[]` | Return stored messages for a session. |
| `clearSession` | `(sessionId: string) => void` | Clear a session's history. |
| `deleteSession` | `(sessionId: string) => void` | Remove a session entirely. |
| `listSessions` | `() => string[]` | List all session IDs in the current storage. |
| `setApiKey` | `(apiKey: string) => void` | Update the API key at runtime. |

---

## React Integration

```tsx
import { useState, useCallback, useRef } from 'react';
import { CrystralClient, LocalStorageAdapter } from '@crystralai/client';

export function Chat() {
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [streaming, setStreaming] = useState('');

  const clientRef = useRef<CrystralClient | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current || clientRef.current !== null) {
      clientRef.current = new CrystralClient({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey,
        storage: new LocalStorageAdapter('my-app'),
      });
    }
    return clientRef.current;
  }, [apiKey]);

  const send = useCallback(async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setStreaming('');

    const client = getClient();
    const result = await client.run(text, {
      sessionId,
      stream: true,
      onToken: (token) => setStreaming(prev => prev + token),
    });

    setSessionId(result.sessionId);
    setMessages(prev => [...prev, { role: 'assistant', text: result.content }]);
    setStreaming('');
  }, [sessionId, getClient]);

  return (
    <div>
      <input
        type="password"
        placeholder="Your OpenAI API key"
        onChange={e => setApiKey(e.target.value)}
      />
      {messages.map((m, i) => (
        <div key={i}><strong>{m.role}:</strong> {m.text}</div>
      ))}
      {streaming && <div><strong>assistant:</strong> {streaming}</div>}
      {/* input field + send button */}
    </div>
  );
}
```

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
  } else if (err instanceof InvalidConfigError) {
    console.error(`Config error: ${err.message}`);
  }
}
```

---

## Security Considerations

When using API keys in the browser:

1. **Keys are visible to the user.** This is by design for BYOK apps. The user owns and controls their key.
2. **Never bundle keys in source code.** Always accept them as runtime input (form field, localStorage, environment variable in SSR).
3. **CORS restrictions apply.** Some providers may require a proxy for browser requests. Use the `baseUrl` option to point at a CORS proxy if needed.
4. **Rotate compromised keys.** Educate users that browser-stored keys should be rotated if their device is compromised.
5. **Consider a backend proxy** for production apps where you control the key. Use [`@crystralai/sdk`](./sdk.md) on the server and expose a thin API.

---

## Comparison with `@crystralai/sdk`

| Feature | `@crystralai/client` | `@crystralai/sdk` |
|---|---|---|
| Browser / React Native | Yes | No |
| Zero dependencies | Yes | No |
| YAML agent config | No | Yes |
| File-based tools | No | Yes |
| SQLite session storage | No | Yes |
| RAG | No | Yes |
| MCP servers | No | Yes |
| Workflows | No | Yes |
| Agent delegation | No | Yes |

Use `@crystralai/client` for frontend / BYOK apps. Use `@crystralai/sdk` for server-side agents with YAML configuration.

---

## TypeScript Types

All types are exported from the package entry point:

```typescript
import type {
  Provider,
  BuiltInProvider,
  Message,
  ImageInput,
  ClientTool,
  StorageAdapter,
  ClientConfig,
  RunOptions,
  RunResult,
  ContentBlock,
  TextBlock,
  ImageBlock,
  AudioBlock,
  DocumentBlock,
  MediaOutput,
  ImageOutput,
  AudioOutput,
} from '@crystralai/client';
```
