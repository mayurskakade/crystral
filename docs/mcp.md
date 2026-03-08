# MCP (Model Context Protocol)

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is an open standard for connecting AI applications to external tools and data sources. Crystal AI acts as an **MCP client**, enabling agents to dynamically discover and use tools exposed by MCP servers at runtime.

This means you can connect any MCP-compatible server -- filesystem access, GitHub, databases, browser automation, or custom internal tools -- to a Crystal AI agent without writing tool YAML files for each individual operation.

---

## How It Works

When an agent with MCP servers configured starts a run:

1. **Connect** -- The agent runner opens connections to all configured MCP servers.
2. **Discover** -- Each server is queried for its available tools via the `tools/list` JSON-RPC method.
3. **Merge** -- MCP tools are merged with file-based tools (from `tools/*.yaml`) into a single tool set.
4. **Execute** -- During the tool loop, if the LLM calls an MCP tool, the request is routed to the correct server.
5. **Close** -- All MCP connections are closed when the agent run completes.

```
AgentRunner
  |
  +-- loadTools()
  |     +-- Load file-based tools (tools/*.yaml)
  |     +-- mcpManager.connectAll(config.mcp)
  |           +-- StdioMCPConnection("filesystem")
  |           |     spawn -> initialize -> tools/list
  |           +-- SSEMCPConnection("github")
  |                 POST -> initialize -> tools/list
  |
  +-- mcpManager.getAllTools()
  |     -> ToolDefinition[] (e.g., mcp_filesystem_read_file)
  |
  +-- Tool loop:
        if mcpManager.isMCPTool(name):
          mcpManager.callTool(name, args) -> result
        else:
          executeTool(config, args) -> result
```

---

## Transport Types

Crystal AI supports two MCP transport types.

### stdio

The **stdio** transport spawns the MCP server as a child process and communicates over stdin/stdout using Content-Length framed JSON-RPC 2.0 messages.

- Best for: Local tools, CLI-based servers, filesystem access.
- The server process is spawned on connection and killed on close.
- Environment variables can be injected into the server process.
- Uses only Node.js built-ins: `child_process`, `events`.

### SSE (Server-Sent Events)

The **SSE** transport communicates with a remote MCP server over HTTP. It uses the Streamable HTTP pattern:

- Sends JSON-RPC requests via HTTP POST.
- Receives responses as either plain JSON or SSE streams.
- Tracks sessions via the `Mcp-Session-Id` header.
- Best for: Remote servers, cloud-hosted tools, shared team servers.
- Uses the built-in `fetch` API.

---

## MCP Server Configuration in YAML

MCP servers are configured in the `mcp` field of an agent config file.

### stdio Server

```yaml
# agents/dev-assistant.yaml
version: 1
name: dev-assistant
provider: openai
model: gpt-4o
system_prompt: You are a development assistant with filesystem access.

mcp:
  - name: filesystem
    transport: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - "/Users/me/projects"
    env:
      NODE_ENV: production
```

### SSE Server

```yaml
# agents/github-assistant.yaml
version: 1
name: github-assistant
provider: openai
model: gpt-4o
system_prompt: You help manage GitHub repositories.

mcp:
  - name: github
    transport: sse
    url: https://mcp-github.example.com/sse
```

### Multiple Servers

An agent can connect to multiple MCP servers simultaneously:

```yaml
mcp:
  - name: filesystem
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]

  - name: github
    transport: sse
    url: https://mcp-github.example.com/sse

  - name: database
    transport: stdio
    command: node
    args: ["./mcp-servers/postgres-server.js"]
    env:
      DATABASE_URL: postgresql://localhost:5432/mydb
```

---

## Configuration Field Reference

### stdio Transport

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Unique server identifier, max 64 chars. Used in tool name prefixing. |
| `transport` | `"stdio"` | Yes | -- | Must be `stdio`. |
| `command` | string | Yes | -- | Executable to spawn (e.g., `npx`, `node`, `python`). |
| `args` | list of strings | No | `[]` | Command-line arguments passed to the process. |
| `env` | map of strings | No | -- | Additional environment variables for the server process. Merged with the parent process environment. |

### SSE Transport

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Unique server identifier, max 64 chars. |
| `transport` | `"sse"` | Yes | -- | Must be `sse`. |
| `url` | string (URL) | Yes | -- | Full URL of the MCP server endpoint. Must be a valid URL. |

---

## Tool Discovery and Naming

When Crystal AI connects to an MCP server, it queries `tools/list` and receives a list of tool definitions. Each tool is exposed to the LLM with a **prefixed name** to prevent collisions:

```
mcp_{serverName}_{toolName}
```

For example, a server named `filesystem` exposing a tool called `read_file` becomes `mcp_filesystem_read_file`.

This naming convention ensures:

- No collisions between tools from different MCP servers.
- No collisions between MCP tools and file-based tools (defined in `tools/*.yaml`).
- Clear attribution of which server provides each tool.

### Tool Definition Mapping

MCP tool definitions are converted to Crystal AI's internal `ToolDefinition` format:

| MCP Field | Crystal AI Field |
|-----------|-----------------|
| `name` | `function.name` (with `mcp_<server>_` prefix) |
| `description` | `function.description` |
| `inputSchema.properties` | `function.parameters.properties` |
| `inputSchema.required` | `function.parameters.required` |

---

## Attaching MCP Servers to Agents

Add MCP servers to any agent via the `mcp` field:

```yaml
version: 1
name: my-agent
provider: openai
model: gpt-4o
system_prompt: |
  You are a helpful assistant with access to the filesystem
  and GitHub. Use these tools when the user asks you to
  read files or manage repositories.

tools:
  - web-search          # File-based tool

mcp:
  - name: filesystem    # MCP server tools
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

File-based tools and MCP tools are merged into a single tool set. The LLM sees all tools and can call any of them during the conversation.

---

## Authentication and Environment Variables

### stdio Servers

Pass secrets via the `env` field. These are injected into the server's process environment:

```yaml
mcp:
  - name: database
    transport: stdio
    command: node
    args: ["./mcp-servers/postgres.js"]
    env:
      DATABASE_URL: postgresql://user:pass@localhost/mydb
      DB_SSL: "true"
```

> **Warning:** Avoid hardcoding secrets in YAML files. Use environment variable references or a `.env` file. The `env` field values are merged with the parent process environment, so any variable set in your shell or `.env` file is automatically available to MCP server processes.

A safer approach:

```yaml
mcp:
  - name: database
    transport: stdio
    command: node
    args: ["./mcp-servers/postgres.js"]
    # DATABASE_URL is inherited from the parent process env
    # Set it in .env or export it in your shell
```

### SSE Servers

Authentication for SSE servers is handled by the server itself. If the server requires an API key or token, it should be included in the URL or configured on the server side. Crystal AI's SSE client does not currently inject custom authentication headers.

---

## Protocol Details

Crystal AI implements the MCP client protocol using JSON-RPC 2.0. No external MCP SDK is used -- the implementation is built from scratch using only Node.js built-ins.

### Connection Lifecycle

1. **Initialize** -- Send `initialize` request with protocol version `2024-11-05` and client info.
2. **Acknowledge** -- Send `notifications/initialized` notification.
3. **Discover** -- Send `tools/list` request to get available tools.
4. **Execute** -- Send `tools/call` requests during the agent's tool loop.
5. **Close** -- Kill the child process (stdio) or drop the connection (SSE).

### JSON-RPC Message Format (stdio)

Messages are framed with `Content-Length` headers:

```
Content-Length: 123\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
```

### Session Management (SSE)

The SSE transport tracks sessions via the `Mcp-Session-Id` response header. Once received, the session ID is included in all subsequent requests:

```
POST /sse HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: abc-123

{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{...}}
```

---

## Complete Examples

### Example 1: Filesystem Agent

Give an agent read/write access to a project directory:

```yaml
# agents/file-assistant.yaml
version: 1
name: file-assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a file management assistant. You can read, write,
  and search files in the user's project directory.

mcp:
  - name: filesystem
    transport: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - "/Users/me/projects/my-app"
```

Run it:

```bash
crystalai run file-assistant "List all TypeScript files in the src directory"
```

### Example 2: Multi-Server Agent

Combine filesystem and database access:

```yaml
# agents/data-analyst.yaml
version: 1
name: data-analyst
provider: anthropic
model: claude-sonnet-4-20250514
system_prompt: |
  You are a data analyst. You can query the database to
  analyze data and write reports to the filesystem.

mcp:
  - name: postgres
    transport: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-postgres"
    env:
      POSTGRES_CONNECTION_STRING: postgresql://localhost:5432/analytics

  - name: filesystem
    transport: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - "/Users/me/reports"
```

### Example 3: Using MCP with the SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const crystal = new Crystral();

// The agent config already has MCP servers defined in YAML.
// MCP connections are managed automatically during run().
const result = await crystal.run(
  'file-assistant',
  'Read the contents of src/index.ts and summarize it'
);

console.log(result.content);
```

---

## Troubleshooting

### Server fails to spawn

```
Error: MCP server 'filesystem' exited with code 1
```

**Causes and fixes:**
- The `command` is not installed or not in PATH. Verify with `which <command>`.
- The `args` are incorrect. Test the command manually: `npx -y @modelcontextprotocol/server-filesystem /path`.
- The server requires dependencies that are not installed. Run `npm install` if needed.

### Initialize fails

```
Error: MCP initialize failed: ...
```

**Causes and fixes:**
- The server does not support the `2024-11-05` protocol version. Check the server's documentation for supported versions.
- The server is not an MCP server. Verify it implements the MCP protocol.

### SSE connection refused

```
Error: MCP HTTP error from 'github': 401 Unauthorized
```

**Causes and fixes:**
- The server requires authentication. Check the server's documentation for required headers or tokens.
- The URL is incorrect. Verify the server is running and accessible.

### Tools not discovered

If `tools/list` returns an empty list:
- The server may not have any tools registered. Check the server's implementation.
- The server may require additional configuration or setup before tools are available.

### Tool call errors

```
MCP tool call failed: ...
```

**Causes and fixes:**
- The tool arguments are incorrect. The LLM may have passed wrong parameter types.
- The server-side tool implementation failed. Check the server logs.
- The server process crashed. The connection will be marked as closed and subsequent calls will fail.

### Performance issues

- **stdio servers** have low latency (no network overhead) but consume local resources. Each server is a separate process.
- **SSE servers** add network latency but can be shared across clients. Use SSE for remote or shared tools.
- Limit the number of MCP servers per agent. Each server adds tools to the LLM's context, which consumes tokens.

---

## Implementation Notes

Crystal AI's MCP client is implemented from scratch with zero external dependencies:

| Module | File | Purpose |
|--------|------|---------|
| `MCPClientManager` | `packages/core/src/mcp/client.ts` | Manages connections and tool routing |
| `StdioMCPConnection` | `packages/core/src/mcp/stdio.ts` | stdio transport via `child_process.spawn()` |
| `SSEMCPConnection` | `packages/core/src/mcp/sse.ts` | HTTP+SSE transport via `fetch` |
| JSON-RPC utilities | `packages/core/src/mcp/jsonrpc.ts` | Message creation, framing, parsing |

The decision to not use the official MCP SDK (`@modelcontextprotocol/sdk`) keeps the dependency footprint at zero and gives full control over connection lifecycle. Only Node.js built-ins are used: `child_process`, `fetch`, `events`.

---

## Related Documentation

- [Tools Guide](./tools.md) -- File-based tool configuration
- [Agents Guide](./agents.md) -- Agent configuration including MCP server setup
