# Changelog

All notable changes to `@crystral/sdk` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-03-05

### Added
- **`Workflow` class** — load and run multi-agent workflows from YAML definitions
- **`Crystral.loadWorkflow()`** — load a workflow by name from `workflows/<name>.yaml`
- **`Crystral.runWorkflow()`** — one-shot convenience method to load and run a workflow
- **`SDKWorkflowRunOptions`** and **`SDKWorkflowRunResult`** interfaces
- **Agent delegation callbacks** — `onAgentDelegation` and `onAgentDelegationResult` in `RunOptions`
- **`CircularDelegationError`** re-export — thrown when agent delegation creates a circular call chain
- **New type re-exports** from `@crystral/core`: `AgentToolConfig`, `MCPServerConfig`, `WorkflowConfig`, `AgentDelegationEvent`, `AgentDelegationResultEvent`
- **Workflows guide** — `docs/guides/workflows.md`
- **Agent tool documentation** — added `agent` tool type to tools guide
- Updated error handling guide with `CircularDelegationError`

---

## [0.1.1] - 2026-03-03

### Added
- Comprehensive TSDoc comments on all exported symbols
- Full API reference README with badges, tables, and examples
- TypeDoc configuration for generating HTML API docs (`pnpm run docs`)
- `docs/guides/` — 7 Markdown guides: getting-started, sessions, streaming, tools, rag, error-handling, providers
- `CHANGELOG.md`
- `typedoc` and `typedoc-plugin-markdown` devDependencies

---

## [0.1.0] - 2026-03-03

### Added

- **`Crystral` client class** — main entry point with `loadAgent()`, `run()`, and `getLogs()`
- **`Agent` class** — agent instance with `run()`, `getHistory()`, and `clearSession()`
- **Multi-turn session support** — pass `sessionId` in `RunOptions` to continue a conversation across calls; sessions are persisted to SQLite and survive process restarts
- **Streaming support** — enable with `stream: true`; receive tokens via `onToken` callback and tool lifecycle events via `onToolCall` / `onToolResult`
- **Inference log retrieval** — `getLogs()` queries the local SQLite store with optional filters (`agentName`, `limit`, `since`)
- **`CrystralOptions` interface** — optional `cwd` for resolving agent YAML files from a custom directory
- **`RunOptions` interface** — full control over session, streaming, variables, and tool iteration cap
- **`RunResult` interface** — structured result containing `content`, `sessionId`, `messages`, `toolCalls`, `ragContext`, `usage`, and `durationMs`
- **`GetLogsFilter` interface** — filter inference logs by agent name, count limit, and start date
- **Re-exports of all types and error classes from `@crystral/core`**:
  - Types: `AgentConfig`, `ToolConfig`, `RAGCollectionConfig`, `RAGConfig`, `Message`, `Session`, `ToolCall`, `InferenceLog`, `Provider`, `CompletionOptions`, `CompletionResult`
  - Errors: `CrystralError`, `ValidationError`, `AgentNotFoundError`, `ToolNotFoundError`, `ToolExecutionError`, `ProviderError`, `RateLimitError`, `CredentialNotFoundError`
- **`crystral` default singleton instance** — zero-config named export for simple scripts
- **TypeDoc HTML API reference** — generate with `pnpm run docs`
- **TSDoc comments** on every exported symbol
- **Documentation guides** — 7 Markdown guides covering getting started, sessions, streaming, tools, RAG, error handling, and providers
