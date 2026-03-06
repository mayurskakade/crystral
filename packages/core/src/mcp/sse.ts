import { EventEmitter } from 'node:events';
import type { JsonRpcResponse } from './jsonrpc.js';
import {
  createRequest,
  createNotification,
  type MCPToolDefinition,
  type MCPToolResult,
} from './jsonrpc.js';

/**
 * MCP connection over HTTP+SSE.
 *
 * Sends JSON-RPC requests via HTTP POST and receives responses via SSE stream.
 * Uses the Streamable HTTP transport pattern:
 * - POST requests to the server endpoint with JSON-RPC body
 * - Server responds with SSE stream containing JSON-RPC responses
 */
export class SSEMCPConnection extends EventEmitter {
  private baseUrl: string;
  private serverName: string;
  private sessionId?: string;
  private pendingRequests = new Map<number | string, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor(name: string, url: string) {
    super();
    this.serverName = name;
    this.baseUrl = url;
  }

  /**
   * Initialize the MCP connection
   */
  async connect(): Promise<void> {
    const initResponse = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'crystral',
        version: '0.1.0',
      },
    });

    if (initResponse.error) {
      throw new Error(`MCP initialize failed: ${initResponse.error.message}`);
    }

    // Send initialized notification
    await this.sendNotification('notifications/initialized');
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    const response = await this.sendRequest('tools/list', {});

    if (response.error) {
      throw new Error(`MCP tools/list failed: ${response.error.message}`);
    }

    const result = response.result as { tools?: MCPToolDefinition[] } | undefined;
    return result?.tools ?? [];
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    if (response.error) {
      return {
        content: [{ type: 'text', text: `MCP tool error: ${response.error.message}` }],
        isError: true,
      };
    }

    return response.result as MCPToolResult;
  }

  /**
   * Close the connection
   */
  close(): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Send a JSON-RPC request via HTTP POST and parse SSE response
   */
  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const request = createRequest(method, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    // Store session ID from response headers
    const sessionHeader = response.headers.get('mcp-session-id');
    if (sessionHeader) {
      this.sessionId = sessionHeader;
    }

    if (!response.ok) {
      throw new Error(`MCP HTTP error from '${this.serverName}': ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Handle direct JSON response
    if (contentType.includes('application/json')) {
      const body = await response.json() as JsonRpcResponse;
      return body;
    }

    // Handle SSE response
    if (contentType.includes('text/event-stream')) {
      return this.parseSSEResponse(response, request.id);
    }

    // Fallback: try parsing as JSON
    const text = await response.text();
    try {
      return JSON.parse(text) as JsonRpcResponse;
    } catch {
      throw new Error(`MCP unexpected response from '${this.serverName}': ${text.slice(0, 200)}`);
    }
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const notification = createNotification(method, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    });
  }

  /**
   * Parse SSE stream to extract JSON-RPC response
   */
  private async parseSSEResponse(response: Response, requestId: number | string): Promise<JsonRpcResponse> {
    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as JsonRpcResponse;
          if (parsed.id === requestId) {
            return parsed;
          }
        } catch {
          // Skip malformed SSE data
        }
      }
    }

    throw new Error(`MCP SSE response from '${this.serverName}' did not contain expected response for request ${String(requestId)}`);
  }
}
