import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { JsonRpcResponse } from './jsonrpc.js';
import {
  createRequest,
  createNotification,
  serializeWithHeaders,
  type MCPToolDefinition,
  type MCPToolResult,
} from './jsonrpc.js';

/**
 * MCP connection over stdio (child_process).
 *
 * Spawns the MCP server as a subprocess and communicates via
 * JSON-RPC 2.0 with Content-Length framed messages over stdin/stdout.
 */
export class StdioMCPConnection extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests = new Map<number | string, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();
  private serverName: string;
  private command: string;
  private args: string[];
  private env: Record<string, string> | undefined;

  constructor(name: string, command: string, args: string[] = [], env?: Record<string, string>) {
    super();
    this.serverName = name;
    this.command = command;
    this.args = args;
    if (env) {
      this.env = env;
    }
  }

  /**
   * Spawn the MCP server process and initialize the connection
   */
  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    // Handle stdout data with Content-Length framing
    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr for debugging but don't fail
      this.emit('stderr', chunk.toString());
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
      this.rejectAllPending(err);
    });

    this.process.on('close', (code) => {
      this.emit('close', code);
      this.rejectAllPending(new Error(`MCP server '${this.serverName}' exited with code ${code}`));
    });

    // Send initialize request
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
    this.sendNotification('notifications/initialized');
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
   * Close the connection and kill the subprocess
   */
  close(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.rejectAllPending(new Error('Connection closed'));
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error(`MCP server '${this.serverName}' stdin is not writable`));
        return;
      }

      const request = createRequest(method, params);
      this.pendingRequests.set(request.id, { resolve, reject });

      const message = serializeWithHeaders(request);
      this.process.stdin.write(message);
    });
  }

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process?.stdin?.writable) return;

    const notification = createNotification(method, params);
    const message = serializeWithHeaders(notification);
    this.process.stdin.write(message);
  }

  /**
   * Process the buffer for complete Content-Length framed messages
   */
  private processBuffer(): void {
    while (true) {
      // Look for Content-Length header
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match?.[1]) {
        // Skip malformed headers
        this.buffer = this.buffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.buffer.length < bodyEnd) {
        // Not enough data yet
        break;
      }

      const body = this.buffer.substring(bodyStart, bodyEnd);
      this.buffer = this.buffer.substring(bodyEnd);

      try {
        const message = JSON.parse(body) as JsonRpcResponse;
        this.handleMessage(message);
      } catch {
        // Skip malformed JSON
      }
    }
  }

  private handleMessage(message: JsonRpcResponse): void {
    if (message.id !== null && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        pending.resolve(message);
      }
    }
    // Notifications (no id) are ignored for now
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
