/**
 * JSON-RPC 2.0 types and utilities for MCP communication.
 * Zero external dependencies — uses only built-in types.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP tool definition as returned by tools/list
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP tool call result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

let nextId = 1;

/**
 * Generate a unique JSON-RPC request ID
 */
export function generateId(): number {
  return nextId++;
}

/**
 * Create a JSON-RPC 2.0 request message
 */
export function createRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: generateId(),
    method,
    ...(params !== undefined ? { params } : {}),
  };
}

/**
 * Create a JSON-RPC 2.0 notification (no id, no response expected)
 */
export function createNotification(method: string, params?: Record<string, unknown>): JsonRpcNotification {
  return {
    jsonrpc: '2.0',
    method,
    ...(params !== undefined ? { params } : {}),
  };
}

/**
 * Serialize a JSON-RPC message with Content-Length framing for stdio transport
 */
export function serializeWithHeaders(message: JsonRpcRequest | JsonRpcNotification): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

/**
 * Parse a JSON-RPC response, throwing on errors
 */
export function parseResponse(data: unknown): JsonRpcResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid JSON-RPC response: not an object');
  }

  const response = data as JsonRpcResponse;
  if (response.jsonrpc !== '2.0') {
    throw new Error('Invalid JSON-RPC response: missing jsonrpc 2.0');
  }

  return response;
}
