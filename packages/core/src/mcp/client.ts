import type { MCPServerConfig } from '../types/index.js';
import type { ToolDefinition } from '../types/runtime.js';
import type { ToolResult } from '../tools/executor.js';
import { StdioMCPConnection } from './stdio.js';
import { SSEMCPConnection } from './sse.js';
import type { MCPToolDefinition } from './jsonrpc.js';

/**
 * Internal connection wrapper
 */
interface MCPConnection {
  listTools(): Promise<MCPToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;
  close(): void;
}

/**
 * Manages connections to multiple MCP servers and exposes their tools
 * as standard Crystral ToolDefinitions.
 */
export class MCPClientManager {
  private connections = new Map<string, MCPConnection>();
  private toolMap = new Map<string, { serverName: string; originalName: string }>();
  private toolDefs: ToolDefinition[] = [];

  /**
   * Connect to all configured MCP servers and discover their tools
   */
  async connectAll(configs: MCPServerConfig[]): Promise<void> {
    for (const config of configs) {
      await this.connect(config);
    }
  }

  /**
   * Connect to a single MCP server
   */
  async connect(config: MCPServerConfig): Promise<void> {
    let connection: MCPConnection;

    if (config.transport === 'stdio') {
      const stdioConn = new StdioMCPConnection(
        config.name,
        config.command,
        config.args,
        config.env
      );
      await stdioConn.connect();
      connection = stdioConn;
    } else {
      const sseConn = new SSEMCPConnection(config.name, config.url);
      await sseConn.connect();
      connection = sseConn;
    }

    this.connections.set(config.name, connection);

    // Discover tools
    const tools = await connection.listTools();
    for (const tool of tools) {
      const prefixedName = `mcp_${config.name}_${tool.name}`;

      this.toolMap.set(prefixedName, {
        serverName: config.name,
        originalName: tool.name,
      });

      this.toolDefs.push({
        type: 'function',
        function: {
          name: prefixedName,
          description: tool.description ?? `MCP tool from ${config.name}: ${tool.name}`,
          parameters: {
            type: 'object',
            properties: tool.inputSchema?.properties ?? {},
            ...(tool.inputSchema?.required ? { required: tool.inputSchema.required } : {}),
          },
        },
      });
    }
  }

  /**
   * Get all discovered tools as ToolDefinitions
   */
  getAllTools(): ToolDefinition[] {
    return this.toolDefs;
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMCPTool(name: string): boolean {
    return this.toolMap.has(name);
  }

  /**
   * Call an MCP tool by its prefixed name
   */
  async callTool(fullName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const mapping = this.toolMap.get(fullName);
    if (!mapping) {
      return {
        content: `Unknown MCP tool: ${fullName}`,
        success: false,
        error: `Unknown MCP tool: ${fullName}`,
      };
    }

    const connection = this.connections.get(mapping.serverName);
    if (!connection) {
      return {
        content: `MCP server '${mapping.serverName}' is not connected`,
        success: false,
        error: `MCP server '${mapping.serverName}' is not connected`,
      };
    }

    try {
      const result = await connection.callTool(mapping.originalName, args);

      const textContent = result.content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text)
        .join('\n');

      return {
        content: textContent || '(empty result)',
        success: !result.isError,
        ...(result.isError ? { error: textContent } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `MCP tool call failed: ${message}`,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Close all MCP connections
   */
  closeAll(): void {
    for (const [, connection] of this.connections) {
      try {
        connection.close();
      } catch {
        // Ignore close errors
      }
    }
    this.connections.clear();
    this.toolMap.clear();
    this.toolDefs = [];
  }
}
