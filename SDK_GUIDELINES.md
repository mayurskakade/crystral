# CrystalAI — SDK Implementation Guidelines

**Scope:** This document tells SDK authors exactly how to implement a CrystalAI SDK in any language. All 5 official SDKs (TypeScript, Python, Java, Dart, Kotlin) follow these guidelines. Third-party SDKs may also use this as a reference.

---

## Table of Contents

1. [Cross-SDK Consistency Rules](#1-cross-sdk-consistency-rules)
2. [Config Loading Implementation](#2-config-loading-implementation)
3. [TypeScript / npm SDK](#3-typescript--npm-sdk)
4. [Python SDK](#4-python-sdk)
5. [Java SDK](#5-java-sdk)
6. [Dart / Flutter SDK](#6-dart--flutter-sdk)
7. [Kotlin SDK](#7-kotlin-sdk)
8. [Compliance Checklist](#8-compliance-checklist)

---

## 1. Cross-SDK Consistency Rules

These rules are non-negotiable. Every SDK must conform to all of them. An SDK that does not is not a compliant CrystalAI SDK.

### 1.1 Config Loading Must Be Identical

All SDKs read the same YAML files and apply the same validation from [CONFIG_SPEC.md](./CONFIG_SPEC.md). The parsing output is semantically identical across languages — same field names (adapted to language conventions), same default values, same error conditions.

**Name field conventions per language:**

| YAML field | TypeScript | Python | Java | Dart | Kotlin |
|------------|-----------|--------|------|------|--------|
| `system_prompt` | `systemPrompt` | `system_prompt` | `systemPrompt` | `systemPrompt` | `systemPrompt` |
| `max_tokens` | `maxTokens` | `max_tokens` | `maxTokens` | `maxTokens` | `maxTokens` |
| `match_threshold` | `matchThreshold` | `match_threshold` | `matchThreshold` | `matchThreshold` | `matchThreshold` |

YAML uses snake_case. Each SDK translates to its language's idiomatic casing at parse time. The underlying YAML never changes.

### 1.2 Credential Resolution Priority Is Fixed

All SDKs resolve credentials in this exact order — no exceptions:

```
1. process/runtime environment variable    (e.g. OPENAI_API_KEY)
2. project .env file                       (<project-root>/.env)
3. ~/.crystalai/credentials               (INI file)
```

No SDK may skip a step or change the priority. The .env file is always relative to the project root (where `crystalai.config.yaml` lives), not the SDK's calling code directory.

### 1.3 Error Codes Are Standardized

All SDKs use the error codes defined in CONFIG_SPEC.md Section 10. The error `code` field is always the snake_SCREAMING_SNAKE_CASE string (e.g. `CREDENTIAL_NOT_FOUND`, `AGENT_NOT_FOUND`). Error messages follow the canonical templates in the spec.

Error class hierarchy in all SDKs:

```
CrystalAIError (base)
  ├── ConfigurationError
  │   ├── ValidationError
  │   ├── ConfigVersionError
  │   └── AgentNotFoundError
  │       ToolNotFoundError
  │       RAGCollectionNotFoundError
  ├── CredentialNotFoundError
  ├── ProviderError
  │   └── RateLimitError
  ├── ToolExecutionError
  │   └── ToolTimeoutError
  ├── CollectionNotIndexedError
  └── StorageError
```

All errors expose:
- `code: string` — the standardized error code
- `message: string` — human-readable message following the canonical template
- `details: object/dict/map` — optional extra context (file path, field name, etc.)

### 1.4 Streaming Event Format Is Fixed

All SDKs producing or consuming the streaming API emit events in this exact format (JSON per line / SSE data field):

```json
{"type": "chunk", "content": "Hello"}
{"type": "tool_call", "id": "call_abc", "name": "get-ticket", "args": {"ticket_id": "123"}}
{"type": "tool_result", "id": "call_abc", "name": "get-ticket", "result": "{...}"}
{"type": "done", "session_id": "abc123", "tokens": {"input": 45, "output": 22, "total": 67}, "cost_usd": 0.0003, "latency_ms": 412}
```

The `done` event is always the last event. SDKs must not emit any events after `done`. The `type` field is always a string. Unknown event types must be silently ignored (for forward compatibility).

### 1.5 Session IDs Are Caller-Provided or UUID v4

When the caller does not provide a session ID, SDKs generate a UUID v4. All SDKs use UUID v4 — not sequential integers, not timestamps. Session IDs are strings in all languages.

### 1.6 Tool Calls Are Always Fully Resolved Before Returning

SDKs must never return a partial response that requires the caller to handle tool resolution. The SDK's `run()` method always handles the full tool-calling loop internally (up to `max_tool_iterations: 10`) and returns only the final natural-language response.

Callers who want to observe tool calls must use `stream()` and look for `tool_call` and `tool_result` events.

### 1.7 Cost Calculation Uses These Rates (v1 defaults)

When a provider does not return token counts in its response, SDKs use character ÷ 4 as an approximation. Cost is always in USD and always a float. When the provider does not return cost, SDKs set `cost_usd` to `0.0` (not `null`).

**Fallback cost table (only used when provider does not return cost):**

| Provider | Model pattern | Input per 1M tokens | Output per 1M tokens |
|----------|--------------|--------------------|--------------------|
| openai | gpt-4o | $5.00 | $15.00 |
| openai | gpt-4o-mini | $0.15 | $0.60 |
| openai | gpt-3.5-turbo | $0.50 | $1.50 |
| anthropic | claude-*-opus | $15.00 | $75.00 |
| anthropic | claude-*-sonnet | $3.00 | $15.00 |
| anthropic | claude-*-haiku | $0.25 | $1.25 |
| groq | * | $0.00 | $0.00 (use actual Groq pricing) |
| google | gemini-1.5-pro | $3.50 | $10.50 |
| google | gemini-1.5-flash | $0.35 | $1.05 |

These are approximations and may be outdated. SDKs must always prefer provider-returned cost data over this table.

---

## 2. Config Loading Implementation

This section specifies how any SDK must implement config loading. Use this as an implementation guide.

### 2.1 YAML Parsing Libraries

Recommended per language:

| Language | Library |
|----------|---------|
| TypeScript | `js-yaml` (^4.x) |
| Python | `PyYAML` (^6.x) or `ruamel.yaml` |
| Java | `SnakeYAML` (^2.x) |
| Dart | `yaml` (^3.x, from pub.dev) |
| Kotlin | `snakeyaml` (same as Java) or `kaml` (Kotlin-specific) |

### 2.2 Schema Validation Libraries

| Language | Library |
|----------|---------|
| TypeScript | `zod` (^3.x) |
| Python | `pydantic` (^2.x) |
| Java | Custom validation (Jakarta Bean Validation or manual) |
| Dart | Custom validation with `freezed` models |
| Kotlin | Custom validation with `kotlinx.serialization` or data class validation |

### 2.3 Config Loading Algorithm

All SDKs implement this exact algorithm:

```
function loadAgentConfig(name, cwd):
  projectRoot = findProjectRoot(cwd)

  # Try .yaml then .yml
  for ext in ['.yaml', '.yml']:
    filePath = projectRoot / 'agents' / (name + ext)
    if fileExists(filePath):
      rawYaml = readFile(filePath)
      parsed = parseYaml(rawYaml)

      # Step 1: Check version field exists
      if 'version' not in parsed:
        raise ValidationError(
          code='VALIDATION_ERROR',
          field='version',
          file=filePath,
          message='Missing required field version. Add version: 1 to the top of the file.'
        )

      # Step 2: Check version is supported
      if parsed.version > SUPPORTED_MAX_VERSION:
        raise ConfigVersionError(parsed.version)

      # Step 3: Apply version migrations if needed
      config = applyMigrations(parsed)

      # Step 4: Validate against schema
      validated = validateAgentSchema(config)   # raises ValidationError on failure

      # Step 5: Check name matches filename
      if validated.name != name:
        raise ValidationError(
          field='name',
          message=f"Agent name '{validated.name}' does not match filename '{name}.yaml'."
        )

      return validated

  # Neither .yaml nor .yml found
  raise AgentNotFoundError(name, projectRoot)
```

### 2.4 Project Root Detection

```
function findProjectRoot(cwd):
  dir = cwd
  while true:
    if fileExists(dir / 'crystalai.config.yaml'):
      return dir
    if fileExists(dir / 'crystalai.config.yml'):
      return dir
    parent = parentDirectory(dir)
    if parent == dir:   # reached filesystem root
      # No config found — use cwd with warning
      warn('crystalai.config.yaml not found. Using current directory as project root.')
      return cwd
    dir = parent
```

### 2.5 .env File Parsing

All SDKs must parse `.env` files that follow this format:

```
# Comment lines start with #
KEY=value
KEY="value with spaces"
KEY='single quoted'
# export prefix is supported
export KEY=value
# Inline comments after # are NOT supported (value includes #)
```

Do not use OS-level env var expansion inside `.env` values. Parse the value literally.

### 2.6 Credentials File Parsing

INI format parsing rules:
- Section header: `[provider_name]`
- Key-value: `key = value` or `key=value`
- Strip leading/trailing whitespace from both keys and values
- Lines starting with `#` or `;` are comments
- Unknown sections are silently ignored
- Unknown keys within a known section are silently ignored

---

## 3. TypeScript / npm SDK

**Package name:** `@crystalai/sdk`
**Runtime:** Node.js ≥ 18, ESM + CJS dual build
**Language version:** TypeScript 5.x, strict mode

### 3.1 Installation

```bash
npm install @crystalai/sdk
# or
pnpm add @crystalai/sdk
```

### 3.2 Public API

```typescript
// ---- Agent ----

export class Agent {
  constructor(name: string, opts?: AgentOptions)

  run(message: string, opts?: RunOptions): Promise<AgentResponse>
  stream(message: string, opts?: RunOptions): AsyncIterable<StreamEvent>
  session(id: string): AgentSession
  getConfig(): Promise<AgentConfig>
}

export interface AgentOptions {
  cwd?: string                // default: process.cwd()
}

export interface RunOptions {
  sessionId?: string
  variables?: Record<string, string>
  ragThreshold?: number
  ragMatchCount?: number
}

export interface AgentResponse {
  content: string
  sessionId: string
  toolCallsMade: number
  tokens: { input: number; output: number; total: number }
  costUsd: number
  latencyMs: number
}

export type StreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'done'; sessionId: string; tokens: TokenUsage; costUsd: number; latencyMs: number }

// ---- AgentSession ----

export class AgentSession {
  readonly sessionId: string
  readonly agentName: string

  send(message: string, opts?: Omit<RunOptions, 'sessionId'>): Promise<AgentResponse>
  stream(message: string, opts?: Omit<RunOptions, 'sessionId'>): AsyncIterable<StreamEvent>
  getHistory(): Promise<Message[]>
  clear(): Promise<void>
}

// ---- RAGCollection ----

export class RAGCollection {
  constructor(name: string, opts?: { cwd?: string })

  index(opts?: IndexOptions): Promise<IndexResult>
  search(query: string, opts?: SearchOptions): Promise<RAGResult[]>
  getStats(): Promise<CollectionStats>
  clear(): Promise<void>
}

export interface IndexOptions { force?: boolean }
export interface SearchOptions { limit?: number; threshold?: number }

export interface IndexResult {
  chunks: number
  documents: number
  skipped: number
  durationMs: number
}

export interface RAGResult {
  chunkId: string
  content: string
  documentPath: string
  similarity: number
}

// ---- Tool ----

export class Tool {
  constructor(name: string, opts?: { cwd?: string })

  execute(params: Record<string, unknown>): Promise<unknown>
  getConfig(): Promise<ToolConfig>
}

// ---- Config Types (re-exported from @crystalai/core) ----

export type { AgentConfig, ToolConfig, RAGCollectionConfig, ProjectConfig } from '@crystalai/core'

// ---- Error Types ----

export class CrystalAIError extends Error {
  code: string
  details: Record<string, unknown>
}

export class ValidationError extends CrystalAIError {}
export class AgentNotFoundError extends CrystalAIError {
  agentName: string
}
export class ToolNotFoundError extends CrystalAIError {
  toolName: string
}
export class CredentialNotFoundError extends CrystalAIError {
  provider: string
}
export class ProviderError extends CrystalAIError {
  provider: string
  httpStatus: number
}
export class RateLimitError extends ProviderError {
  retryAfterMs?: number
}
export class CollectionNotIndexedError extends CrystalAIError {
  collectionName: string
}
export class ToolExecutionError extends CrystalAIError {}
export class ToolTimeoutError extends CrystalAIError {}
export class StorageError extends CrystalAIError {}
```

### 3.3 Streaming Usage Pattern

```typescript
const agent = new Agent('support')

// Type-safe streaming with discriminated union
for await (const event of agent.stream('Hello!')) {
  if (event.type === 'chunk') {
    process.stdout.write(event.content)
  } else if (event.type === 'tool_call') {
    console.error(`\n[calling ${event.name}...]`)
  } else if (event.type === 'done') {
    console.log(`\nTokens: ${event.tokens.total}, Cost: $${event.costUsd.toFixed(4)}`)
  }
}
```

### 3.4 Error Handling Pattern

```typescript
import { Agent, CredentialNotFoundError, ProviderError, RateLimitError } from '@crystalai/sdk'

const agent = new Agent('support')
try {
  const response = await agent.run('Hello!')
} catch (err) {
  if (err instanceof RateLimitError) {
    const waitMs = err.retryAfterMs ?? 60_000
    await new Promise(r => setTimeout(r, waitMs))
    // retry
  } else if (err instanceof CredentialNotFoundError) {
    console.error(`Missing API key for ${err.provider}`)
    process.exit(1)
  } else if (err instanceof ProviderError) {
    console.error(`Provider error (${err.httpStatus}): ${err.message}`)
  }
}
```

### 3.5 ESM / CJS Compatibility

- Publish both ESM (`.js`) and CJS (`.cjs`) via `tsup`
- `package.json` exports map:
  ```json
  {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "require": "./dist/index.cjs",
        "types": "./dist/index.d.ts"
      }
    }
  }
  ```
- No top-level await in the main entry point (breaks CJS consumers)

---

## 4. Python SDK

**Package name:** `crystalai`
**Runtime:** Python ≥ 3.10
**Language features:** type hints throughout, `dataclass` / Pydantic models, sync + async

### 4.1 Installation

```bash
pip install crystalai
# or
uv add crystalai
```

### 4.2 Public API

```python
# ---- Agent ----

class Agent:
    def __init__(self, name: str, *, cwd: str | None = None) -> None: ...

    def run(
        self,
        message: str,
        *,
        session_id: str | None = None,
        variables: dict[str, str] | None = None,
        rag_threshold: float = 0.7,
        rag_match_count: int = 5,
    ) -> AgentResponse: ...

    async def run_async(self, message: str, **opts) -> AgentResponse: ...

    def stream(self, message: str, **opts) -> Generator[StreamEvent, None, None]: ...

    async def stream_async(self, message: str, **opts) -> AsyncGenerator[StreamEvent, None]: ...

    def session(self, session_id: str) -> "AgentSession": ...

    def get_config(self) -> AgentConfig: ...


@dataclass
class AgentResponse:
    content: str
    session_id: str
    tool_calls_made: int
    tokens: TokenUsage
    cost_usd: float
    latency_ms: int


@dataclass
class TokenUsage:
    input: int
    output: int
    total: int


# StreamEvent is a tagged union using Python 3.10+ match syntax
@dataclass
class ChunkEvent:
    type: Literal["chunk"]
    content: str

@dataclass
class ToolCallEvent:
    type: Literal["tool_call"]
    id: str
    name: str
    args: dict[str, Any]

@dataclass
class ToolResultEvent:
    type: Literal["tool_result"]
    id: str
    name: str
    result: str

@dataclass
class DoneEvent:
    type: Literal["done"]
    session_id: str
    tokens: TokenUsage
    cost_usd: float
    latency_ms: int

StreamEvent = ChunkEvent | ToolCallEvent | ToolResultEvent | DoneEvent


# ---- AgentSession ----

class AgentSession:
    session_id: str
    agent_name: str

    def send(self, message: str, **opts) -> AgentResponse: ...
    async def send_async(self, message: str, **opts) -> AgentResponse: ...
    def stream(self, message: str, **opts) -> Generator[StreamEvent, None, None]: ...
    async def stream_async(self, message: str, **opts) -> AsyncGenerator[StreamEvent, None]: ...
    def get_history(self) -> list[Message]: ...
    def clear(self) -> None: ...


# ---- RAGCollection ----

class RAGCollection:
    def __init__(self, name: str, *, cwd: str | None = None) -> None: ...

    def index(self, *, force: bool = False) -> IndexResult: ...
    async def index_async(self, *, force: bool = False) -> IndexResult: ...
    def search(self, query: str, *, limit: int = 5, threshold: float = 0.7) -> list[RAGResult]: ...
    async def search_async(self, query: str, **opts) -> list[RAGResult]: ...
    def get_stats(self) -> CollectionStats: ...
    def clear(self) -> None: ...


# ---- Tool ----

class Tool:
    def __init__(self, name: str, *, cwd: str | None = None) -> None: ...
    def execute(self, params: dict[str, Any]) -> Any: ...
    async def execute_async(self, params: dict[str, Any]) -> Any: ...
    def get_config(self) -> ToolConfig: ...


# ---- Errors ----

class CrystalAIError(Exception):
    code: str
    details: dict[str, Any]

class ValidationError(CrystalAIError): ...
class AgentNotFoundError(CrystalAIError):
    agent_name: str
class ToolNotFoundError(CrystalAIError):
    tool_name: str
class CredentialNotFoundError(CrystalAIError):
    provider: str
class ProviderError(CrystalAIError):
    provider: str
    http_status: int
class RateLimitError(ProviderError):
    retry_after_ms: int | None
class CollectionNotIndexedError(CrystalAIError):
    collection_name: str
class ToolExecutionError(CrystalAIError): ...
class ToolTimeoutError(CrystalAIError): ...
class StorageError(CrystalAIError): ...
```

### 4.3 Streaming Usage

```python
from crystalai import Agent

agent = Agent('support')

# Sync streaming
for event in agent.stream('Hello!'):
    match event.type:
        case 'chunk':
            print(event.content, end='', flush=True)
        case 'tool_call':
            print(f'\n[calling {event.name}...]', flush=True)
        case 'done':
            print(f'\nCost: ${event.cost_usd:.4f}')

# Async streaming
async def main():
    async for event in agent.stream_async('Hello!'):
        if event.type == 'chunk':
            print(event.content, end='', flush=True)
```

### 4.4 Pydantic Config Models

```python
from pydantic import BaseModel, field_validator

class AgentConfig(BaseModel):
    version: int
    name: str
    description: str | None = None
    provider: Literal['openai', 'anthropic', 'groq', 'google', 'together']
    model: str
    system_prompt: str = ''
    temperature: float = 1.0
    max_tokens: int = 4096
    tools: list[str] = []
    rag: RAGConfig | None = None

    @field_validator('temperature')
    @classmethod
    def validate_temperature(cls, v):
        if not 0.0 <= v <= 2.0:
            raise ValueError(f'temperature must be between 0.0 and 2.0, got {v}')
        return v
```

### 4.5 pyproject.toml

```toml
[project]
name = "crystalai"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "pyyaml>=6.0",
    "pydantic>=2.0",
    "httpx>=0.27",
    "python-dotenv>=1.0",
    "openai>=1.0",
    "anthropic>=0.20",
    "click>=8.1",
]

[project.scripts]
crystalai = "crystalai.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

## 5. Java SDK

**Package name:** `ai.crystalai:crystalai-java`
**Runtime:** Java 17+
**Language features:** records, sealed classes, `CompletableFuture`, `java.util.stream`

### 5.1 Installation

**Maven:**
```xml
<dependency>
  <groupId>ai.crystalai</groupId>
  <artifactId>crystalai-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

**Gradle (Kotlin DSL):**
```kotlin
implementation("ai.crystalai:crystalai-java:0.1.0")
```

### 5.2 Public API

```java
// ---- Agent ----

public class Agent {
    public Agent(String name) {}
    public Agent(String name, AgentOptions options) {}

    // Synchronous (blocking)
    public AgentResponse run(String message) throws CrystalAIException {}
    public AgentResponse run(String message, RunOptions options) throws CrystalAIException {}

    // Asynchronous (non-blocking)
    public CompletableFuture<AgentResponse> runAsync(String message) {}
    public CompletableFuture<AgentResponse> runAsync(String message, RunOptions options) {}

    // Streaming — returns a Stream<StreamEvent> via callback or reactive
    public void stream(String message, StreamHandler handler) throws CrystalAIException {}
    public CompletableFuture<Void> streamAsync(String message, StreamHandler handler) {}

    public AgentSession session(String sessionId) {}
    public AgentConfig getConfig() throws CrystalAIException {}
}

// ---- Data Classes (Records) ----

public record AgentOptions(
    @Nullable String cwd
) {
    public static AgentOptions defaults() { return new AgentOptions(null); }
}

public record RunOptions(
    @Nullable String sessionId,
    Map<String, String> variables,
    double ragThreshold,
    int ragMatchCount
) {
    public static Builder builder() { return new Builder(); }
    // Builder pattern
}

public record AgentResponse(
    String content,
    String sessionId,
    int toolCallsMade,
    TokenUsage tokens,
    double costUsd,
    long latencyMs
) {}

public record TokenUsage(int input, int output, int total) {}

// ---- Streaming ----

// Sealed interface for type-safe event handling (Java 17+)
public sealed interface StreamEvent permits
    StreamEvent.Chunk, StreamEvent.ToolCall, StreamEvent.ToolResult, StreamEvent.Done {

    record Chunk(String content) implements StreamEvent {}
    record ToolCall(String id, String name, Map<String, Object> args) implements StreamEvent {}
    record ToolResult(String id, String name, String result) implements StreamEvent {}
    record Done(String sessionId, TokenUsage tokens, double costUsd, long latencyMs) implements StreamEvent {}
}

@FunctionalInterface
public interface StreamHandler {
    void onEvent(StreamEvent event);
}

// ---- AgentSession ----

public class AgentSession {
    public String getSessionId() {}
    public String getAgentName() {}

    public AgentResponse send(String message) throws CrystalAIException {}
    public CompletableFuture<AgentResponse> sendAsync(String message) {}
    public void stream(String message, StreamHandler handler) throws CrystalAIException {}
    public List<Message> getHistory() throws CrystalAIException {}
    public void clear() throws CrystalAIException {}
}

// ---- RAGCollection ----

public class RAGCollection {
    public RAGCollection(String name) {}
    public RAGCollection(String name, @Nullable String cwd) {}

    public IndexResult index() throws CrystalAIException {}
    public IndexResult index(boolean force) throws CrystalAIException {}
    public CompletableFuture<IndexResult> indexAsync() {}
    public List<RAGResult> search(String query) throws CrystalAIException {}
    public List<RAGResult> search(String query, int limit, double threshold) throws CrystalAIException {}
    public CompletableFuture<List<RAGResult>> searchAsync(String query) {}
    public CollectionStats getStats() throws CrystalAIException {}
    public void clear() throws CrystalAIException {}
}

// ---- Tool ----

public class Tool {
    public Tool(String name) {}
    public Object execute(Map<String, Object> params) throws CrystalAIException {}
    public CompletableFuture<Object> executeAsync(Map<String, Object> params) {}
    public ToolConfig getConfig() throws CrystalAIException {}
}

// ---- Exceptions ----

public class CrystalAIException extends RuntimeException {    // unchecked
    public String getCode() {}
    public Map<String, Object> getDetails() {}
}

public class ValidationException extends CrystalAIException {}
public class AgentNotFoundException extends CrystalAIException {
    public String getAgentName() {}
}
public class ToolNotFoundException extends CrystalAIException {
    public String getToolName() {}
}
public class CredentialNotFoundException extends CrystalAIException {
    public String getProvider() {}
}
public class ProviderException extends CrystalAIException {
    public String getProvider() {}
    public int getHttpStatus() {}
}
public class RateLimitException extends ProviderException {
    public Optional<Long> getRetryAfterMs() {}
}
```

### 5.3 Streaming Usage

```java
// Java 21+ with pattern matching
Agent agent = new Agent("support");
agent.stream("Hello!", event -> {
    switch (event) {
        case StreamEvent.Chunk(var content) -> System.out.print(content);
        case StreamEvent.ToolCall(var id, var name, var args) ->
            System.err.println("\n[calling " + name + "...]");
        case StreamEvent.Done(var sid, var tokens, var cost, var ms) ->
            System.out.printf("\nCost: $%.4f%n", cost);
        case StreamEvent.ToolResult ignored -> {}
    }
});

// Async streaming
agent.streamAsync("Hello!", event -> {
    if (event instanceof StreamEvent.Chunk chunk) {
        System.out.print(chunk.content());
    }
}).get();  // block until done
```

### 5.4 Java YAML Parsing

```java
// Use SnakeYAML 2.x
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
Map<String, Object> raw = yaml.load(fileReader);
```

---

## 6. Dart / Flutter SDK

**Package name:** `crystalai`
**Runtime:** Dart 3.x (Flutter 3.x)
**Language features:** `Future`, `Stream`, `sealed class`, `freezed` for immutable models

### 6.1 Installation

```yaml
# pubspec.yaml
dependencies:
  crystalai: ^0.1.0
```

```bash
dart pub get
# or
flutter pub get
```

### 6.2 Public API

```dart
// ---- Agent ----

class Agent {
  Agent(String name, {String? cwd});

  // Synchronous-style (actually async Future)
  Future<AgentResponse> run(
    String message, {
    String? sessionId,
    Map<String, String>? variables,
    double ragThreshold = 0.7,
    int ragMatchCount = 5,
  });

  // Streaming
  Stream<StreamEvent> stream(
    String message, {
    String? sessionId,
    Map<String, String>? variables,
  });

  AgentSession session(String sessionId);
  Future<AgentConfig> getConfig();
}

// ---- Immutable Data Classes (using freezed or manual) ----

@immutable
class AgentResponse {
  const AgentResponse({
    required this.content,
    required this.sessionId,
    required this.toolCallsMade,
    required this.tokens,
    required this.costUsd,
    required this.latencyMs,
  });

  final String content;
  final String sessionId;
  final int toolCallsMade;
  final TokenUsage tokens;
  final double costUsd;
  final int latencyMs;
}

@immutable
class TokenUsage {
  const TokenUsage({required this.input, required this.output, required this.total});
  final int input;
  final int output;
  final int total;
}

// ---- Sealed StreamEvent (Dart 3 sealed classes) ----

sealed class StreamEvent {}

final class ChunkEvent extends StreamEvent {
  ChunkEvent(this.content);
  final String content;
}

final class ToolCallEvent extends StreamEvent {
  ToolCallEvent({required this.id, required this.name, required this.args});
  final String id;
  final String name;
  final Map<String, dynamic> args;
}

final class ToolResultEvent extends StreamEvent {
  ToolResultEvent({required this.id, required this.name, required this.result});
  final String id;
  final String name;
  final String result;
}

final class DoneEvent extends StreamEvent {
  DoneEvent({required this.sessionId, required this.tokens, required this.costUsd, required this.latencyMs});
  final String sessionId;
  final TokenUsage tokens;
  final double costUsd;
  final int latencyMs;
}

// ---- AgentSession ----

class AgentSession {
  final String sessionId;
  final String agentName;

  Future<AgentResponse> send(String message);
  Stream<StreamEvent> stream(String message);
  Future<List<Message>> getHistory();
  Future<void> clear();
}

// ---- RAGCollection ----

class RAGCollection {
  RAGCollection(String name, {String? cwd});

  Future<IndexResult> index({bool force = false});
  Future<List<RAGResult>> search(String query, {int limit = 5, double threshold = 0.7});
  Future<CollectionStats> getStats();
  Future<void> clear();
}

// ---- Tool ----

class Tool {
  Tool(String name, {String? cwd});

  Future<dynamic> execute(Map<String, dynamic> params);
  Future<ToolConfig> getConfig();
}

// ---- Exceptions ----

class CrystalAIException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic> details;
}

class ValidationException extends CrystalAIException {}
class AgentNotFoundException extends CrystalAIException {
  final String agentName;
}
class CredentialNotFoundException extends CrystalAIException {
  final String provider;
}
class ProviderException extends CrystalAIException {
  final String provider;
  final int httpStatus;
}
class RateLimitException extends ProviderException {
  final Duration? retryAfter;
}
```

### 6.3 Streaming Usage

```dart
final agent = Agent('support');

await for (final event in agent.stream('Hello!')) {
  switch (event) {
    case ChunkEvent(:final content):
      stdout.write(content);
    case ToolCallEvent(:final name):
      stderr.writeln('\n[calling $name...]');
    case DoneEvent(:final costUsd):
      print('\nCost: \$${costUsd.toStringAsFixed(4)}');
    case ToolResultEvent():
      break; // ignore in UI
  }
}
```

### 6.4 Flutter Usage

```dart
// In a Flutter widget - stream to display agent response
class ChatScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<StreamEvent>(
      stream: Agent('support').stream('Hello!'),
      builder: (context, snapshot) {
        if (snapshot.hasData && snapshot.data is ChunkEvent) {
          final chunk = snapshot.data as ChunkEvent;
          // append chunk to displayed text
        }
        return const CircularProgressIndicator();
      },
    );
  }
}
```

### 6.5 Notes on Dart-Specific Config Loading

- Use `dart:io` `File` and `Directory` for file system access
- Use `package:yaml` for YAML parsing
- The `cwd` parameter defaults to `Directory.current.path`
- For Flutter, config files must be bundled via `assets` or loaded from `getApplicationDocumentsDirectory()` — document this clearly; agent YAML files are not accessible from Flutter apps the same way as in Dart CLI

---

## 7. Kotlin SDK

**Package name:** `ai.crystalai:crystalai-kotlin`
**Runtime:** JVM 17+, Kotlin 1.9+
**Language features:** coroutines (`suspend` functions, `Flow`), data classes, sealed classes, extension functions

### 7.1 Installation

**Gradle (Kotlin DSL):**
```kotlin
implementation("ai.crystalai:crystalai-kotlin:0.1.0")
```

```bash
# Add coroutines dependency
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
```

### 7.2 Public API

```kotlin
// ---- Agent ----

class Agent(
    val name: String,
    val cwd: String? = null,
) {
    // Blocking (non-suspend) — for Java interop or simple scripts
    fun runBlocking(message: String, options: RunOptions = RunOptions()): AgentResponse

    // Coroutine-based (idiomatic Kotlin)
    suspend fun run(message: String, options: RunOptions = RunOptions()): AgentResponse

    // Cold Flow for streaming
    fun stream(message: String, options: RunOptions = RunOptions()): Flow<StreamEvent>

    fun session(sessionId: String): AgentSession
    suspend fun getConfig(): AgentConfig
}

data class RunOptions(
    val sessionId: String? = null,
    val variables: Map<String, String> = emptyMap(),
    val ragThreshold: Double = 0.7,
    val ragMatchCount: Int = 5,
)

data class AgentResponse(
    val content: String,
    val sessionId: String,
    val toolCallsMade: Int,
    val tokens: TokenUsage,
    val costUsd: Double,
    val latencyMs: Long,
)

data class TokenUsage(val input: Int, val output: Int, val total: Int)

// ---- Sealed StreamEvent ----

sealed class StreamEvent {
    data class Chunk(val content: String) : StreamEvent()
    data class ToolCall(
        val id: String,
        val name: String,
        val args: Map<String, Any>,
    ) : StreamEvent()
    data class ToolResult(
        val id: String,
        val name: String,
        val result: String,
    ) : StreamEvent()
    data class Done(
        val sessionId: String,
        val tokens: TokenUsage,
        val costUsd: Double,
        val latencyMs: Long,
    ) : StreamEvent()
}

// ---- AgentSession ----

class AgentSession(
    val sessionId: String,
    val agentName: String,
) {
    suspend fun send(message: String, options: RunOptions = RunOptions()): AgentResponse
    fun stream(message: String, options: RunOptions = RunOptions()): Flow<StreamEvent>
    suspend fun getHistory(): List<Message>
    suspend fun clear()
}

// ---- RAGCollection ----

class RAGCollection(
    val name: String,
    val cwd: String? = null,
) {
    suspend fun index(force: Boolean = false): IndexResult
    suspend fun search(
        query: String,
        limit: Int = 5,
        threshold: Double = 0.7,
    ): List<RAGResult>
    suspend fun getStats(): CollectionStats
    suspend fun clear()
}

// ---- Tool ----

class Tool(
    val name: String,
    val cwd: String? = null,
) {
    suspend fun execute(params: Map<String, Any>): Any?
    suspend fun getConfig(): ToolConfig
}

// ---- Exceptions ----

open class CrystalAIException(
    val code: String,
    message: String,
    val details: Map<String, Any> = emptyMap(),
) : RuntimeException(message)

class ValidationException(message: String, details: Map<String, Any> = emptyMap()) :
    CrystalAIException("VALIDATION_ERROR", message, details)

class AgentNotFoundException(val agentName: String) :
    CrystalAIException("AGENT_NOT_FOUND", "Agent '$agentName' not found.")

class ToolNotFoundException(val toolName: String) :
    CrystalAIException("TOOL_NOT_FOUND", "Tool '$toolName' not found.")

class CredentialNotFoundException(val provider: String) :
    CrystalAIException("CREDENTIAL_NOT_FOUND", "No API key found for provider '$provider'.")

open class ProviderException(
    val provider: String,
    val httpStatus: Int,
    message: String,
) : CrystalAIException("PROVIDER_ERROR", message)

class RateLimitException(
    provider: String,
    httpStatus: Int,
    val retryAfterMs: Long? = null,
) : ProviderException(provider, httpStatus, "Rate limit exceeded for $provider.")
```

### 7.3 Streaming Usage

```kotlin
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.runBlocking

val agent = Agent("support")

// Coroutine-based (recommended)
runBlocking {
    agent.stream("Hello!").collect { event ->
        when (event) {
            is StreamEvent.Chunk -> print(event.content)
            is StreamEvent.ToolCall -> System.err.println("\n[calling ${event.name}...]")
            is StreamEvent.Done -> println("\nCost: $${event.costUsd}")
            is StreamEvent.ToolResult -> { /* ignore */ }
        }
    }
}

// In a coroutine scope (e.g., Android ViewModel)
viewModelScope.launch {
    agent.stream("Hello!").collect { event ->
        when (event) {
            is StreamEvent.Chunk -> _uiState.update { it.copy(text = it.text + event.content) }
            is StreamEvent.Done -> _uiState.update { it.copy(loading = false) }
            else -> {}
        }
    }
}
```

### 7.4 Error Handling with Kotlin

```kotlin
val agent = Agent("support")

try {
    val response = agent.run("Hello!")
    println(response.content)
} catch (e: RateLimitException) {
    val waitMs = e.retryAfterMs ?: 60_000
    delay(waitMs)
    // retry
} catch (e: CredentialNotFoundException) {
    println("Missing API key for: ${e.provider}")
    exitProcess(1)
} catch (e: CrystalAIException) {
    println("Error [${e.code}]: ${e.message}")
}

// Or with Result type (Kotlin idiomatic)
val result = runCatching { agent.run("Hello!") }
result.fold(
    onSuccess = { println(it.content) },
    onFailure = { err ->
        when (err) {
            is CredentialNotFoundException -> println("Set up credentials first")
            is ProviderException -> println("Provider error: ${err.httpStatus}")
            else -> throw err
        }
    }
)
```

### 7.5 Android Considerations

- Config files in Android must be either bundled as assets or downloaded — they cannot be in the file system like desktop Kotlin
- For Android, the recommended pattern is to pass config as Kotlin data classes directly rather than YAML files
- Provide an `Agent.fromConfig(AgentConfig)` constructor as an alternative to `Agent("name")`
- SQLite storage on Android uses `android.database.sqlite.SQLiteDatabase` instead of a JVM SQLite library

---

## 8. Compliance Checklist

An SDK is **compliant** when it passes all items in this checklist. Mark N/A if the item does not apply to the target language (e.g., Android items don't apply to Dart CLI).

### 8.1 Config Loading

- [ ] Reads `crystalai.config.yaml` / `.yml` from project root
- [ ] Detects project root by walking up from `cwd`
- [ ] Reads agent configs from `agents/<name>.yaml` / `.yml`
- [ ] Reads tool configs from `tools/<name>.yaml` / `.yml`
- [ ] Reads RAG config from `rag/<name>/.crystalai-rag.yaml`
- [ ] Applies all defaults from CONFIG_SPEC.md for optional fields
- [ ] Validates `version` field presence — raises `ValidationError` if missing
- [ ] Validates `name` field matches filename — raises `ValidationError` if mismatched
- [ ] Validates `provider` is one of the allowed enum values
- [ ] Validates `temperature` in range 0.0–2.0
- [ ] Validates `max_tokens` is a positive integer
- [ ] Validates `studio.port` in range 1024–65535
- [ ] Does NOT silently coerce types (string "0.7" for number raises error)
- [ ] Ignores `x-` prefixed fields silently (or warns in strict mode)
- [ ] Parses extension fields and exposes them via `getConfig()`

### 8.2 Credential Resolution

- [ ] Resolves env var first (e.g. `OPENAI_API_KEY`)
- [ ] Falls back to project `.env` file
- [ ] Falls back to `~/.crystalai/credentials` INI file
- [ ] Raises `CredentialNotFoundError` with canonical message if none found
- [ ] `CredentialNotFoundError` includes the provider name
- [ ] Shows all three places tried in the error message
- [ ] Reads credentials file with `0600` permission check (Unix only)

### 8.3 Agent Execution

- [ ] `run()` returns `AgentResponse` with all required fields
- [ ] `run()` with `sessionId` loads history from storage
- [ ] `run()` saves new messages to storage after completion
- [ ] `run()` logs to `inference_logs` in storage
- [ ] Tool calling loop runs up to 10 iterations
- [ ] Tool calling loop stops and returns after `finish_reason: stop`
- [ ] `run()` injects RAG context into system prompt when configured
- [ ] `stream()` emits events in the canonical format
- [ ] `stream()` emits `done` as the last event
- [ ] `stream()` handles tool calls within the stream correctly

### 8.4 RAG Pipeline

- [ ] `index()` discovers files matching configured `include` patterns
- [ ] `index()` skips files matching `exclude` patterns
- [ ] `index()` warns on unsupported file types without erroring
- [ ] `index()` chunks text with configured `chunk_size` and `chunk_overlap`
- [ ] `index()` generates embeddings using configured provider + model
- [ ] `index()` stores chunks + embeddings in SQLite
- [ ] `index(force=true)` re-indexes all files regardless of change status
- [ ] `search()` generates query embedding and runs vector similarity search
- [ ] `search()` returns results with `similarity >= threshold`
- [ ] `search()` returns at most `limit` results

### 8.5 Error Handling

- [ ] All errors extend `CrystalAIError` / `CrystalAIException`
- [ ] All errors have a `code` field matching the canonical codes
- [ ] Error messages match the canonical templates from CONFIG_SPEC.md
- [ ] `ProviderError` exposes `provider` and `httpStatus`
- [ ] `RateLimitError` exposes `retryAfterMs` when available from provider
- [ ] `ToolExecutionError` exposes the underlying error message from the tool

### 8.6 Storage

- [ ] Storage file is at `<project-root>/.crystalai/agents.db`
- [ ] Creates `.crystalai/` directory if it doesn't exist
- [ ] Applies schema on first open (idempotent `CREATE TABLE IF NOT EXISTS`)
- [ ] Session IDs are UUID v4 when auto-generated
- [ ] `StorageError` is raised (not generic exception) on DB failures

### 8.7 Tool Execution

- [ ] REST API tool: resolves path parameters from args
- [ ] REST API tool: resolves auth token from env var
- [ ] REST API tool: raises `CredentialNotFoundError` if auth env var not set
- [ ] REST API tool: raises `ToolTimeoutError` on request timeout
- [ ] REST API tool: applies `response_path` dot-notation extraction if configured
- [ ] JavaScript tool: N/A for non-Node.js SDKs (mark as not supported)
- [ ] Web search tool: raises `CredentialNotFoundError` if `BRAVE_API_KEY` not set

### 8.8 Streaming Format

- [ ] Emits `chunk` events as text arrives from provider
- [ ] Emits `tool_call` event before executing each tool
- [ ] Emits `tool_result` event after each tool completes
- [ ] Emits exactly one `done` event as the final event
- [ ] `done` event includes `tokens`, `costUsd`, `latencyMs`, `sessionId`
- [ ] Unknown event types from provider are ignored gracefully

### 8.9 Cross-SDK Consistency Verification

To verify your SDK is consistent with others, run these test cases and compare output:

| Test | Expected behavior |
|------|------------------|
| Load agent with `name: wrong` in `agents/correct.yaml` | `ValidationError` with message about name mismatch |
| Load agent with `temperature: "hot"` (string) | `ValidationError` — type coercion not allowed |
| Run agent with no credentials configured | `CredentialNotFoundError` listing all 3 sources tried |
| Run agent with invalid model name | `ProviderError` from the provider API |
| Stream agent that calls one tool | Events: chunk*, tool_call, tool_result, chunk*, done |
| Search un-indexed RAG collection | `CollectionNotIndexedError` |
| Load config with `version: 99` | `ConfigVersionError` mentioning supported version range |
