# Sessions

A **session** is a named conversation thread.  Crystral persists session data
to a local SQLite database so conversations survive process restarts.

---

## What Is Stored

Each session stores the ordered list of messages exchanged (system, user,
assistant, tool results).  When you resume a session Crystral replays that
history into the LLM's context window so the model "remembers" the
conversation.

---

## Starting a Session

You don't need to create a session explicitly.  The first `run()` call
automatically creates one and returns its ID:

```typescript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();

const r1 = await client.run('support-bot', 'Hi, I need help with my order.');
console.log(r1.sessionId); // e.g. "sess_01J..."
```

---

## Continuing a Session

Pass the `sessionId` from the previous result into the next call:

```typescript
// Turn 2
const r2 = await client.run('support-bot', 'Order number is #98765.', {
  sessionId: r1.sessionId,
});

// Turn 3
const r3 = await client.run('support-bot', 'Yes, please issue a refund.', {
  sessionId: r1.sessionId, // same session ID throughout
});
```

All three turns are part of the same conversation.  The model sees the full
history on every call.

---

## Using an Agent Instance

If you call `loadAgent()` and reuse the `Agent` object, the session is tracked
automatically in memory — you don't need to pass `sessionId` manually:

```typescript
const agent = client.loadAgent('support-bot');

const r1 = await agent.run('Hi, I have a question.');
const r2 = await agent.run('My order is #98765.'); // automatically continues r1's session
const r3 = await agent.run('Yes, proceed.');
```

The `Agent` instance remembers the last `sessionId` and reuses it.

---

## Forking a Session

To create a parallel branch from an existing conversation, pass a **different**
`sessionId` — Crystral will start a fresh session that doesn't share history
with the original:

```typescript
// Branch A: continue the original
const branchA = await client.run('support-bot', 'Option A: replace the item.', {
  sessionId: r1.sessionId,
});

// Branch B: explore a different path from the same starting point
const branchB = await client.run('support-bot', 'Option B: issue a refund.', {
  sessionId: 'my-custom-fork-id', // different ID = new session
});
```

---

## Inspecting History

`agent.getHistory()` returns the in-memory message list for the current session:

```typescript
const history = agent.getHistory();
history.forEach(msg => {
  console.log(`[${msg.role}] ${msg.content?.slice(0, 80)}...`);
});
```

> **Note:** `getHistory()` reflects the in-memory state of the `Agent` instance,
> not the full SQLite-backed log.  For persisted history use `client.getLogs()`.

---

## Clearing a Session

Call `agent.clearSession()` to discard the in-memory history and start fresh.
The old session data remains in SQLite and can still be accessed via
`client.getLogs()`.

```typescript
agent.clearSession();
const fresh = await agent.run('Let's start over — what can you help with?');
// fresh.sessionId is a brand-new session ID
```

---

## Session Persistence

Sessions are stored in a SQLite file at:

```
<cwd>/.crystral/sessions.db
```

This means:

- Sessions survive process restarts automatically
- You can resume a session days later using the same `sessionId`
- The database is local and never sent to any server
