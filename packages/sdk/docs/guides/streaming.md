# Streaming

Crystral supports token-by-token streaming so you can display the agent's
response as it is generated rather than waiting for the full completion.

---

## Enabling Streaming

Set `stream: true` in `RunOptions` and provide an `onToken` callback:

```typescript
import { Crystral } from '@crystral/sdk';

const client = new Crystral();

const result = await client.run('assistant', 'Explain how photosynthesis works.', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});

// Newline after streaming completes
process.stdout.write('\n');

// The full concatenated response is still available here
console.log('Full response length:', result.content.length);
```

The `onToken` callback is invoked synchronously for each token as the model
generates it.  After all tokens have been delivered the `run()` promise resolves
with the complete `RunResult`.

---

## Tool Lifecycle Callbacks

Use `onToolCall` and `onToolResult` to observe tool invocations during a
streaming run:

```typescript
const result = await client.run('researcher', 'What is the latest news on AI?', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
  onToolCall: (name, args) => {
    process.stdout.write('\n'); // end the current streaming line
    console.log(`  ⚙ Calling tool: ${name}`, args);
  },
  onToolResult: (name, res) => {
    if (res.success) {
      console.log(`  ✓ ${name} completed`);
    } else {
      console.error(`  ✗ ${name} failed`);
    }
  },
});
```

The callbacks fire in this order for each tool iteration:
1. `onToolCall(name, args)` — model has requested a tool call
2. *(tool executes)*
3. `onToolResult(name, result)` — tool has returned a result
4. Model continues generating (tokens resume via `onToken`)

---

## Streaming in a Web Server

For HTTP streaming (Server-Sent Events or chunked transfer), write tokens
directly to the response stream:

```typescript
// Express example
app.get('/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const result = await client.run('assistant', req.query.message as string, {
    stream: true,
    onToken: (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
  });

  res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\n\n`);
  res.end();
});
```

---

## Streaming with an Agent Instance

The same options work on `agent.run()`:

```typescript
const agent = client.loadAgent('assistant');

await agent.run('Write a haiku about TypeScript.', {
  stream: true,
  onToken: (t) => process.stdout.write(t),
});
```

---

## Note on Current Implementation

The current streaming implementation simulates word-by-word delivery by
splitting the completed response into tokens.  Native provider-level streaming
(where tokens are delivered from the API as they are generated) is on the
roadmap and will be enabled transparently — existing `onToken` callbacks will
continue to work without code changes.

The final `result.content` is always the complete response regardless of
whether streaming was enabled.
