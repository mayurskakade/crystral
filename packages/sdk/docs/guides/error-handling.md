# Error Handling

All errors thrown by `@crystral/sdk` extend the base `CrystralError` class and
carry a machine-readable `code` string property.

---

## Error Hierarchy

```
Error
└── CrystralError              (base — all Crystral errors)
    ├── AgentNotFoundError
    ├── ValidationError
    ├── CredentialNotFoundError
    ├── ProviderError
    │   └── RateLimitError
    ├── ToolNotFoundError
    ├── ToolExecutionError
    └── CircularDelegationError
```

---

## Catching All Crystral Errors

```typescript
import { CrystralError } from '@crystral/sdk';

try {
  await client.run('my-agent', 'Hello');
} catch (err) {
  if (err instanceof CrystralError) {
    console.error(`[${err.code}] ${err.message}`);
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

---

## Error Reference

### `AgentNotFoundError`

**When thrown:** `loadAgent()` or `run()` cannot find an agent YAML file.

**`code`:** `"AGENT_NOT_FOUND"`

**Properties:**
- `agentName: string` — the agent name that was looked up

**Resolution:** Verify the agent YAML exists at `<cwd>/agents/<name>.yaml`.

```typescript
import { AgentNotFoundError } from '@crystral/sdk';

try {
  const agent = client.loadAgent('typo-agent');
} catch (err) {
  if (err instanceof AgentNotFoundError) {
    console.error(
      `Agent "${err.agentName}" not found.\n` +
      `Expected: agents/${err.agentName}.yaml`
    );
  }
}
```

---

### `ValidationError`

**When thrown:** An agent YAML file is found but fails schema validation.

**`code`:** `"VALIDATION_ERROR"`

**Resolution:** Check the YAML against the [Agent YAML Reference](../README.md#agent-yaml-reference).

```typescript
import { ValidationError } from '@crystral/sdk';

try {
  const agent = client.loadAgent('bad-config');
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`YAML validation failed:\n${err.message}`);
    // err.message contains the field path and constraint that failed
  }
}
```

---

### `CredentialNotFoundError`

**When thrown:** The required API key for the agent's provider is not found.

**`code`:** `"CREDENTIAL_NOT_FOUND"`

**Properties:**
- `envVarName: string` — the environment variable that was looked up

**Resolution order:** Crystral checks these in order:
1. Environment variable (e.g. `OPENAI_API_KEY`)
2. `.env` file in the project root
3. `~/.crystral/credentials` global file

```typescript
import { CredentialNotFoundError } from '@crystral/sdk';

try {
  await agent.run('Hello');
} catch (err) {
  if (err instanceof CredentialNotFoundError) {
    console.error(
      `Missing credential.\n` +
      `Set ${err.envVarName} in your environment or .env file.`
    );
  }
}
```

---

### `ProviderError`

**When thrown:** The LLM provider returns an error response (non-rate-limit).

**`code`:** Provider-specific string (e.g. `"invalid_api_key"`, `"model_not_found"`)

```typescript
import { ProviderError } from '@crystral/sdk';

try {
  await agent.run('Hello');
} catch (err) {
  if (err instanceof ProviderError) {
    console.error(`Provider error [${err.code}]: ${err.message}`);
  }
}
```

---

### `RateLimitError`

**When thrown:** The provider returns HTTP 429 Too Many Requests.

**`code`:** `"RATE_LIMIT"`

**Properties:**
- `retryAfterMs?: number` — suggested delay before retrying (may be `undefined`)

```typescript
import { RateLimitError } from '@crystral/sdk';

async function runWithRetry(agentName: string, message: string, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.run(agentName, message);
    } catch (err) {
      if (err instanceof RateLimitError && attempt < maxRetries) {
        const wait = err.retryAfterMs ?? Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Retrying in ${wait}ms... (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}
```

---

### `ToolNotFoundError`

**When thrown:** The model requests a tool that is not declared in the agent YAML.

**`code`:** `"TOOL_NOT_FOUND"`

**Properties:**
- `toolName: string` — the tool name the model attempted to call

**Resolution:** Add the missing tool to the agent's `tools` array, or update the
system prompt to discourage calling tools that don't exist.

```typescript
import { ToolNotFoundError } from '@crystral/sdk';

try {
  await agent.run('Use the calculator tool');
} catch (err) {
  if (err instanceof ToolNotFoundError) {
    console.error(`Tool "${err.toolName}" is not defined for this agent.`);
  }
}
```

---

### `ToolExecutionError`

**When thrown:** A tool is found and called, but its execution fails (e.g. HTTP
error from a `rest_api` tool, thrown exception from a `javascript` tool).

**`code`:** `"TOOL_EXECUTION_ERROR"`

**Properties:**
- `toolName: string` — the tool that failed
- `cause?: Error` — the underlying error

```typescript
import { ToolExecutionError } from '@crystral/sdk';

try {
  await agent.run('Fetch the current stock price');
} catch (err) {
  if (err instanceof ToolExecutionError) {
    console.error(`Tool "${err.toolName}" failed: ${err.message}`);
    if (err.cause) console.error('Caused by:', err.cause);
  }
}
```

---

### `CircularDelegationError`

**When thrown:** An agent delegation creates a circular call chain (e.g. A → B → A).

**`code`:** `"TOOL_EXECUTION_ERROR"`

**Properties:**
- `agentName: string` — the agent that would have caused the cycle
- `callStack: string[]` — the current call chain when the cycle was detected

**Resolution:** Review your agent tool definitions to ensure no circular references exist.

```typescript
import { CircularDelegationError } from '@crystral/sdk';

try {
  await client.run('orchestrator', 'Do something');
} catch (err) {
  if (err instanceof CircularDelegationError) {
    console.error(
      `Circular delegation detected!\n` +
      `Call chain: ${err.callStack.join(' → ')} → ${err.agentName}`
    );
  }
}
```

---

## Comprehensive Switch Pattern

```typescript
import {
  CrystralError,
  AgentNotFoundError,
  ValidationError,
  CredentialNotFoundError,
  RateLimitError,
  ProviderError,
  ToolNotFoundError,
  ToolExecutionError,
  CircularDelegationError,
} from '@crystral/sdk';

async function safeRun(agentName: string, message: string) {
  try {
    return await client.run(agentName, message);
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      throw new Error(`Configuration error: agent "${err.agentName}" does not exist.`);
    }
    if (err instanceof ValidationError) {
      throw new Error(`Configuration error: invalid agent YAML — ${err.message}`);
    }
    if (err instanceof CredentialNotFoundError) {
      throw new Error(`Setup error: set ${err.envVarName} before running agents.`);
    }
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterMs ?? 5000;
      await new Promise(r => setTimeout(r, wait));
      return client.run(agentName, message); // single retry
    }
    if (err instanceof ProviderError) {
      throw new Error(`LLM provider error: ${err.message}`);
    }
    if (err instanceof ToolExecutionError) {
      console.error(`Non-fatal: tool "${err.toolName}" failed. Continuing...`);
      return null; // or re-throw if tools are critical
    }
    if (err instanceof CircularDelegationError) {
      throw new Error(`Circular delegation: ${err.callStack.join(' → ')} → ${err.agentName}`);
    }
    throw err; // unknown error — re-throw
  }
}
```
