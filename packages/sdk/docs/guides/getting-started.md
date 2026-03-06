# Getting Started with @crystral/sdk

This guide walks you from zero to a working agent in under five minutes.

---

## 1. Install the SDK

```bash
# npm
npm install @crystral/sdk

# pnpm
pnpm add @crystral/sdk

# yarn
yarn add @crystral/sdk
```

**Requirements:** Node.js 18 or later.

---

## 2. Create Your Project Structure

Crystral expects agent definitions in an `agents/` directory relative to your
project root (or the `cwd` you pass to the `Crystral` constructor).

```
my-project/
├── agents/
│   └── assistant.yaml
├── .env
├── package.json
└── index.ts
```

---

## 3. Add Your API Key

Create a `.env` file in your project root (never commit this file):

```bash
# .env
OPENAI_API_KEY=sk-...
```

Crystral automatically loads `.env` files. See [providers.md](providers.md) for
a full list of environment variable names per provider.

---

## 4. Write Your First Agent YAML

Create `agents/assistant.yaml`:

```yaml
version: "1"
name: assistant
provider: openai
model: gpt-4o-mini
system_prompt: |
  You are a concise, helpful assistant.
  Answer questions clearly and briefly.
temperature: 0.7
```

**Required fields:** `version`, `name`, `provider`, `model`.

---

## 5. Run Your First Query

```typescript
// index.ts
import { Crystral } from '@crystral/sdk';

const client = new Crystral();

const result = await client.run('assistant', 'What is the speed of light?');

console.log(result.content);
// → "The speed of light in a vacuum is approximately 299,792,458 metres per second..."
```

Run it:

```bash
npx tsx index.ts
# or
node --experimental-strip-types index.ts  # Node 22+
```

---

## 6. Understanding the RunResult

`client.run()` returns a `RunResult` object:

```typescript
const result = await client.run('assistant', 'Hello!');

console.log(result.content);        // The agent's text reply
console.log(result.sessionId);      // Opaque string — save this for follow-up turns
console.log(result.usage.input);    // Prompt tokens
console.log(result.usage.output);   // Completion tokens
console.log(result.usage.total);    // Total tokens
console.log(result.durationMs);     // Execution time in ms
console.log(result.toolCalls);      // [] when no tools were invoked
```

---

## Next Steps

- **Multi-turn chat** → [sessions.md](sessions.md)
- **Streaming tokens** → [streaming.md](streaming.md)
- **Equip your agent with tools** → [tools.md](tools.md)
- **Multi-agent workflows** → [workflows.md](workflows.md)
- **Add document retrieval (RAG)** → [rag.md](rag.md)
- **Handle errors gracefully** → [error-handling.md](error-handling.md)
