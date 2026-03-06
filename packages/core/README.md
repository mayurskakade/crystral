# @crystral/core

Core runtime engine for Crystral - a local-first AI agent framework for developers.

## Installation

```bash
npm install @crystral/core
# or
pnpm add @crystral/core
```

## Features

- **Multi-provider support**: OpenAI, Anthropic, Groq, Google, Together
- **Local SQLite storage**: Sessions, messages, and RAG indexes
- **Tool executors**: REST API, JavaScript sandbox, Web Search, Agent delegation
- **Agent-as-tool**: Agents can call other agents as tools with circular delegation prevention
- **Workflow engine**: Multi-agent orchestration with YAML-defined workflows
- **MCP client**: Dynamic tool discovery from MCP servers (stdio + SSE transports)
- **RAG pipeline**: Chunking, embeddings, indexing, semantic search
- **Agent runner**: Tool loop with streaming and cost tracking

## Quick Start

```typescript
import { createAgentRunner, loadAgentConfig } from '@crystral/core';

// Load agent from YAML
const config = loadAgentConfig('my-agent');

// Create runner
const runner = createAgentRunner(config);

// Run agent
const result = await runner.run('Hello!');

console.log(result.content);
```

## API

### Config Loading

```typescript
import { 
  loadAgentConfig, 
  loadToolConfig,
  loadProjectConfig,
  loadRAGCollectionConfig 
} from '@crystral/core';

const agentConfig = loadAgentConfig('agent-name');
const toolConfig = loadToolConfig('tool-name');
const projectConfig = loadProjectConfig();
const ragConfig = loadRAGCollectionConfig('collection-name');
```

### Agent Runner

```typescript
import { createAgentRunner } from '@crystral/core';

const runner = createAgentRunner(agentConfig);

// Simple run
const result = await runner.run('Your message');

// With streaming
for await (const chunk of runner.stream('Your message')) {
  process.stdout.write(chunk);
}

// Continue session
const result2 = await runner.run('Follow-up message', {
  sessionId: result.sessionId,
});
```

### Storage

```typescript
import { SQLiteStorage } from '@crystral/core';

const storage = SQLiteStorage.getInstance();

// Sessions
const session = storage.createSession('my-agent');
const messages = storage.getMessages(session.id);

// RAG
storage.storeChunks('collection', chunks);
const results = storage.searchRAG('collection', embedding, 5);
```

### Providers

```typescript
import { createProvider, resolveApiKey } from '@crystral/core';

const apiKey = resolveApiKey('openai');
const provider = createProvider('openai', apiKey);

const completion = await provider.complete({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming
for await (const chunk of provider.stream({ ... })) {
  console.log(chunk);
}
```

### Credentials

API keys are resolved in order:
1. Environment variable (e.g., `OPENAI_API_KEY`)
2. Project `.env` file
3. Global credentials file (`~/.crystral/credentials`)

```typescript
import { resolveApiKey, saveGlobalCredential } from '@crystral/core';

// Get API key
const key = resolveApiKey('openai');

// Save credential
saveGlobalCredential('openai', 'sk-...');
```

### Workflow Engine

```typescript
import { WorkflowEngine, loadWorkflowConfig } from '@crystral/core';

// Load and run a workflow
const config = loadWorkflowConfig('content-pipeline');
const engine = new WorkflowEngine(config);
const result = await engine.run('Write an article about AI');

console.log(result.content);
console.log(result.agentResults); // per-agent call stats
```

### MCP Client

```typescript
import { MCPClientManager } from '@crystral/core';

const manager = new MCPClientManager();
await manager.connectAll([
  { transport: 'stdio', name: 'fs', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
]);

const tools = manager.getAllTools(); // ToolDefinition[]
const result = await manager.callTool('mcp_fs_read_file', { path: '/tmp/test.txt' });
manager.closeAll();
```

## File Structure

```
your-project/
├── crystral.config.yaml    # Project config
├── agents/
│   └── my-agent.yaml       # Agent definitions
├── tools/
│   └── my-tool.yaml        # Tool definitions (rest_api, javascript, web_search, agent)
├── workflows/
│   └── my-workflow.yaml    # Multi-agent workflow definitions
├── rag/
│   └── my-docs/
│       └── .crystral-rag.yaml  # RAG config
└── .crystral/
    └── agents.db           # SQLite database
```

## Module Structure

```
src/
├── types/          # Zod schemas and TypeScript interfaces
├── errors/         # Error hierarchy (CrystralError, CircularDelegationError, ...)
├── config/         # YAML loading and validation
├── credentials/    # API key resolution
├── providers/      # LLM provider clients (OpenAI, Anthropic, Groq, Google, Together)
├── storage/        # SQLite storage adapter
├── tools/          # Tool executors (REST, JS, web search, agent delegation)
├── agent/          # Agent runner with tool loop
├── workflow/       # Multi-agent workflow engine
├── mcp/            # MCP client (stdio + SSE transports, JSON-RPC 2.0)
└── rag/            # RAG pipeline (chunker, embedder, indexer, searcher)
```

## License

MIT
